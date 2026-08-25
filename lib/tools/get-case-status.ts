import type Anthropic from "@anthropic-ai/sdk";
import { normalizeContact } from "../phone";
import { prisma } from "../prisma";

export const getCaseStatusTool: Anthropic.Tool = {
  name: "get_case_status",
  description:
    "Consulta el estado de un caso/reclamo ya registrado. Se puede buscar por ID de caso, o por el contacto (email/teléfono) del ciudadano para listar sus casos.",
  input_schema: {
    type: "object",
    properties: {
      caseId: {
        type: "string",
        description: "ID del caso a consultar, si el ciudadano lo tiene.",
      },
      citizenContact: {
        type: "string",
        description: "Email o teléfono del ciudadano, si no tiene el ID del caso.",
      },
    },
  },
};

export interface GetCaseStatusInput {
  caseId?: string;
  citizenContact?: string;
}

export async function executeGetCaseStatus(input: GetCaseStatusInput) {
  if (input.caseId) {
    const found = await prisma.case.findUnique({ where: { id: input.caseId } });
    if (!found) {
      return { found: false, message: "No se encontró ningún caso con ese ID." };
    }
    return {
      found: true,
      cases: [
        {
          caseId: found.id,
          status: found.status,
          description: found.description,
          createdAt: found.createdAt,
          updatedAt: found.updatedAt,
        },
      ],
    };
  }

  if (input.citizenContact) {
    const cases = await prisma.case.findMany({
      where: { citizenContact: normalizeContact(input.citizenContact) },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    if (cases.length === 0) {
      return { found: false, message: "No se encontraron casos para ese contacto." };
    }
    return {
      found: true,
      cases: cases.map((c) => ({
        caseId: c.id,
        status: c.status,
        description: c.description,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })),
    };
  }

  return {
    found: false,
    message: "Se necesita el ID del caso o el contacto del ciudadano para buscar.",
  };
}
