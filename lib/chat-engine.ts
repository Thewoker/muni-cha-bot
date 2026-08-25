import type Anthropic from "@anthropic-ai/sdk";
import {
  CHAT_MAX_TOKENS,
  CHAT_MODEL,
  anthropic,
  buildSystemBlocks,
  getTools,
} from "./anthropic";
import { loadConversationMessages } from "./conversation-history";
import { searchFaqs } from "./faq-search";
import { prisma } from "./prisma";
import {
  executeCreateCase,
  type CreateCaseInput,
} from "./tools/create-case";
import {
  executeGetCaseStatus,
  type GetCaseStatusInput,
} from "./tools/get-case-status";
import {
  executeConfirmCaseResolution,
  type ConfirmCaseResolutionInput,
} from "./tools/confirm-case-resolution";

const MAX_TOOL_ITERATIONS = 4;

export interface ProcessMessageInput {
  message: string;
  conversationId?: string;
  citizenContact?: string;
}

export interface ProcessMessageResult {
  conversationId: string;
  reply: string;
}

function buildFaqContext(
  matches: Awaited<ReturnType<typeof searchFaqs>>,
): string {
  if (matches.length === 0) return "";

  const entries = matches
    .map(
      (m, i) =>
        `${i + 1}. [${m.category}] P: ${m.question}\n   R: ${m.answer}`,
    )
    .join("\n");

  return `Contexto de preguntas frecuentes relevantes para este mensaje (usalo si aplica, no lo repitas literalmente):\n${entries}`;
}

interface PendingCheckin {
  text: string;
  caseIds: string[];
}

async function buildPendingCheckinContext(
  citizenContact: string | null | undefined,
): Promise<PendingCheckin> {
  if (!citizenContact) return { text: "", caseIds: [] };

  const pendingCases = await prisma.case.findMany({
    where: { citizenContact, status: "RESUELTO" },
    orderBy: { updatedAt: "desc" },
  });

  if (pendingCases.length === 0) return { text: "", caseIds: [] };

  const entries = pendingCases
    .map((c) => `- ID ${c.id}: "${c.description}"`)
    .join("\n");

  const text = `Este ciudadano tiene caso(s) marcados como RESUELTOS esperando que confirme si el problema quedó solucionado:\n${entries}\nPreguntale (si no se lo preguntaste antes en la conversación) y usá confirm_case_resolution cuando responda.`;

  return { text, caseIds: pendingCases.map((c) => c.id) };
}

/**
 * Heurística de respaldo: si el modelo no llamó confirm_case_resolution
 * (por ejemplo porque ya venía respondiendo en texto en turnos anteriores de
 * la misma conversación y repite el patrón), detectamos una confirmación o
 * negación explícita en el mensaje para no dejar el caso trabado en
 * RESUELTO. Solo se usa cuando hay exactamente un caso pendiente — con más
 * de uno la ambigüedad de a cuál se refiere no vale la pena arriesgarla.
 */
function classifyResolutionReply(message: string): boolean | null {
  const normalized = message
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

  const negative = /\b(no|todavia no|sigue igual|sigue sin|no se soluciono|no funciono|no anduvo|nada de nada)\b/;
  if (negative.test(normalized)) return false;

  const positive = /\b(si|ya esta|ya se soluciono|solucionado|solucionó|se soluciono|arreglado|arreglaron|resuelto|listo|perfecto|todo bien|quedo bien|ya lo resolvieron)\b/;
  if (positive.test(normalized)) return true;

  return null;
}

async function executeTool(
  toolUse: Anthropic.ToolUseBlock,
  conversationId: string,
): Promise<{ resultText: string; wasConfirmCaseResolution: boolean }> {
  if (toolUse.name === "create_case") {
    const result = await executeCreateCase(
      toolUse.input as CreateCaseInput,
      conversationId,
    );
    return { resultText: JSON.stringify(result), wasConfirmCaseResolution: false };
  }

  if (toolUse.name === "get_case_status") {
    const result = await executeGetCaseStatus(
      toolUse.input as GetCaseStatusInput,
    );
    return { resultText: JSON.stringify(result), wasConfirmCaseResolution: false };
  }

  if (toolUse.name === "confirm_case_resolution") {
    const result = await executeConfirmCaseResolution(
      toolUse.input as ConfirmCaseResolutionInput,
    );
    return { resultText: JSON.stringify(result), wasConfirmCaseResolution: true };
  }

  return {
    resultText: JSON.stringify({ error: `Tool desconocida: ${toolUse.name}` }),
    wasConfirmCaseResolution: false,
  };
}

/**
 * Punto de entrada único del motor de chat: recibe un mensaje del ciudadano
 * (venga del endpoint HTTP o de WhatsApp), corre el loop de tool use contra
 * Claude y persiste la conversación. Usado por app/api/chat/route.ts y por
 * el handler de mensajes entrantes de Baileys.
 */
export async function processIncomingMessage(
  input: ProcessMessageInput,
): Promise<ProcessMessageResult> {
  const conversation = input.conversationId
    ? await prisma.conversation.findUnique({ where: { id: input.conversationId } })
    : null;

  const conversationId =
    conversation?.id ??
    (
      await prisma.conversation.create({
        data: { citizenContact: input.citizenContact },
      })
    ).id;

  // El contacto que reporta el canal en este mensaje (input.citizenContact)
  // es más confiable que el que haya quedado guardado en su momento — por
  // ejemplo, si una versión anterior del bot guardó un identificador interno
  // de WhatsApp en vez del teléfono real. Si difieren, autocorregimos.
  if (
    conversation &&
    input.citizenContact &&
    conversation.citizenContact !== input.citizenContact
  ) {
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { citizenContact: input.citizenContact },
    });
  }

  await prisma.message.create({
    data: { conversationId, role: "USER", content: input.message },
  });

  const history = await loadConversationMessages(conversationId);
  const faqMatches = await searchFaqs(input.message, 5);
  const faqContext = buildFaqContext(faqMatches);
  const checkin = await buildPendingCheckinContext(
    input.citizenContact ?? conversation?.citizenContact,
  );
  const dynamicContext = [faqContext, checkin.text].filter(Boolean).join("\n\n");

  const messages: Anthropic.MessageParam[] = [...history];

  let response = await anthropic.messages.create({
    model: CHAT_MODEL,
    max_tokens: CHAT_MAX_TOKENS,
    system: buildSystemBlocks(dynamicContext),
    tools: getTools(),
    messages,
  });

  let iterations = 0;
  let confirmCaseResolutionCalled = false;

  while (response.stop_reason === "tool_use" && iterations < MAX_TOOL_ITERATIONS) {
    iterations += 1;
    messages.push({ role: "assistant", content: response.content });

    const toolUseBlocks = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
    );

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const toolUse of toolUseBlocks) {
      const { resultText, wasConfirmCaseResolution } = await executeTool(
        toolUse,
        conversationId,
      );
      if (wasConfirmCaseResolution) confirmCaseResolutionCalled = true;
      toolResults.push({
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: resultText,
      });
    }

    messages.push({ role: "user", content: toolResults });

    response = await anthropic.messages.create({
      model: CHAT_MODEL,
      max_tokens: CHAT_MAX_TOKENS,
      system: buildSystemBlocks(dynamicContext),
      tools: getTools(),
      messages,
    });
  }

  // Red de seguridad: el modelo tenía un check-in pendiente sin ambigüedad
  // (un solo caso) pero terminó el turno sin llamar la tool — no dejamos el
  // caso trabado en RESUELTO solo porque el modelo "contestó lindo" en texto.
  if (!confirmCaseResolutionCalled && checkin.caseIds.length === 1) {
    const resolved = classifyResolutionReply(input.message);
    if (resolved !== null) {
      await executeConfirmCaseResolution({
        caseId: checkin.caseIds[0],
        resolved,
      });
    }
  }

  const replyText = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();

  await prisma.message.create({
    data: { conversationId, role: "ASSISTANT", content: replyText },
  });

  return { conversationId, reply: replyText };
}
