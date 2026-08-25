import type Anthropic from "@anthropic-ai/sdk";
import { prisma } from "./prisma";

const MAX_RAW_TURNS = 20;

/**
 * Carga el historial de una conversación y lo convierte a mensajes para la
 * API de Anthropic.
 *
 * TODO (optimización de costos): si `messages.length` supera MAX_RAW_TURNS,
 * resumir los turnos más viejos (por ejemplo con una llamada aparte y barata
 * al modelo, o con una heurística) y reemplazarlos por un único mensaje de
 * resumen al principio del array, en vez de reenviar todo el historial crudo.
 * Por ahora se trunca a los últimos MAX_RAW_TURNS mensajes.
 */
export async function loadConversationMessages(
  conversationId: string,
): Promise<Anthropic.MessageParam[]> {
  const recentDesc = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    take: MAX_RAW_TURNS,
  });
  const messages = recentDesc.reverse();

  return messages.map((m) => ({
    role: m.role === "USER" ? "user" : "assistant",
    content: m.content,
  }));
}

/**
 * Busca la conversación más reciente asociada a un contacto (usado por el
 * canal de WhatsApp para retomar el hilo en vez de crear una conversación
 * nueva en cada mensaje).
 */
export async function findLatestConversationIdByContact(
  citizenContact: string,
): Promise<string | undefined> {
  const conversation = await prisma.conversation.findFirst({
    where: { citizenContact },
    orderBy: { createdAt: "desc" },
  });
  return conversation?.id;
}
