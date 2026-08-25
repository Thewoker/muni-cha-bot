import type Anthropic from "@anthropic-ai/sdk";
import { normalizeContact } from "../phone";
import { prisma } from "../prisma";

export const createCaseTool: Anthropic.Tool = {
  name: "create_case",
  description:
    "Registra un nuevo caso/reclamo del ciudadano en el sistema municipal, con estado inicial PENDIENTE. Usar cuando el mensaje del ciudadano es una queja o reclamo (no una consulta de información general).",
  input_schema: {
    type: "object",
    properties: {
      citizenName: {
        type: "string",
        description: "Nombre del ciudadano que hace el reclamo.",
      },
      citizenContact: {
        type: "string",
        description: "Email o teléfono de contacto del ciudadano.",
      },
      description: {
        type: "string",
        description: "Descripción del reclamo, con la mayor cantidad de detalle posible (dirección, problema, etc.).",
      },
    },
    required: ["citizenName", "citizenContact", "description"],
  },
};

export interface CreateCaseInput {
  citizenName: string;
  citizenContact: string;
  description: string;
}

export async function executeCreateCase(
  input: CreateCaseInput,
  conversationId: string,
) {
  const citizenContact = normalizeContact(input.citizenContact);

  const createdCase = await prisma.case.create({
    data: {
      citizenName: input.citizenName,
      citizenContact,
      description: input.description,
      status: "PENDIENTE",
      conversationId,
      statusHistory: {
        create: { toStatus: "PENDIENTE", note: "Caso creado por el chatbot" },
      },
    },
  });

  return {
    caseId: createdCase.id,
    status: createdCase.status,
    message: `Caso registrado con ID ${createdCase.id}, estado PENDIENTE.`,
  };
}
