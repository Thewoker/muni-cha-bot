import type Anthropic from "@anthropic-ai/sdk";
import { prisma } from "../prisma";

export const confirmCaseResolutionTool: Anthropic.Tool = {
  name: "confirm_case_resolution",
  description:
    "Registra la respuesta del ciudadano al check-in de un caso en estado RESUELTO (cuando se le pregunta si su problema quedó solucionado). Usar SOLO cuando el ciudadano está respondiendo esa pregunta puntual, con 'resolved: true' si confirma que se solucionó (el caso pasa a FINALIZADO) o 'resolved: false' si dice que sigue sin solucionarse (el caso vuelve a EN_PROCESO como REABIERTO).",
  input_schema: {
    type: "object",
    properties: {
      caseId: {
        type: "string",
        description: "ID del caso sobre el que el ciudadano está confirmando.",
      },
      resolved: {
        type: "boolean",
        description: "true si el ciudadano confirma que el problema se solucionó, false si no.",
      },
    },
    required: ["caseId", "resolved"],
  },
};

export interface ConfirmCaseResolutionInput {
  caseId: string;
  resolved: boolean;
}

export async function executeConfirmCaseResolution(
  input: ConfirmCaseResolutionInput,
) {
  const existing = await prisma.case.findUnique({ where: { id: input.caseId } });
  if (!existing) {
    return { ok: false, message: "No se encontró el caso." };
  }
  if (existing.status !== "RESUELTO") {
    return {
      ok: false,
      message: `El caso no está esperando confirmación (estado actual: ${existing.status}).`,
    };
  }

  const newStatus = input.resolved ? "FINALIZADO" : "REABIERTO";

  const updated = await prisma.case.update({
    where: { id: input.caseId },
    data: {
      status: newStatus,
      statusHistory: {
        create: {
          fromStatus: "RESUELTO",
          toStatus: newStatus,
          note: input.resolved
            ? "Ciudadano confirmó la resolución por chat/WhatsApp."
            : "Ciudadano indicó que el problema persiste; caso reabierto.",
        },
      },
    },
  });

  return {
    ok: true,
    caseId: updated.id,
    status: updated.status,
    message: input.resolved
      ? "Genial, gracias por confirmar. El caso quedó finalizado."
      : "Entendido, reabrimos el caso para seguir trabajando en la solución.",
  };
}
