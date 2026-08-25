import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "../../../../../lib/admin-auth";
import {
  sendCaseFinalizedNotification,
  sendCaseResolutionCheckin,
} from "../../../../../lib/notifications";
import { prisma } from "../../../../../lib/prisma";

const VALID_STATUSES = [
  "PENDIENTE",
  "EN_REVISION",
  "EN_PROCESO",
  "RESUELTO",
  "FINALIZADO",
  "REABIERTO",
] as const;
type CaseStatus = (typeof VALID_STATUSES)[number];

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/admin/cases/[id]">,
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const { id } = await ctx.params;

  const caseRecord = await prisma.case.findUnique({
    where: { id },
    include: {
      statusHistory: { orderBy: { changedAt: "asc" } },
      conversation: {
        include: { messages: { orderBy: { createdAt: "asc" } } },
      },
    },
  });

  if (!caseRecord) {
    return NextResponse.json({ error: "Caso no encontrado." }, { status: 404 });
  }

  return NextResponse.json({ case: caseRecord });
}

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/admin/cases/[id]">,
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const { id } = await ctx.params;
  const body = (await request.json()) as { status?: string };

  if (!body.status || !VALID_STATUSES.includes(body.status as CaseStatus)) {
    return NextResponse.json({ error: "Estado inválido." }, { status: 400 });
  }

  const newStatus = body.status as CaseStatus;

  const existing = await prisma.case.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Caso no encontrado." }, { status: 404 });
  }

  const updated = await prisma.case.update({
    where: { id },
    data: {
      status: newStatus,
      statusHistory: {
        create: { fromStatus: existing.status, toStatus: newStatus },
      },
    },
  });

  const notificationPayload = {
    caseId: updated.id,
    citizenName: updated.citizenName,
    citizenContact: updated.citizenContact,
    description: updated.description,
  };

  try {
    if (newStatus === "RESUELTO" && existing.status !== "RESUELTO") {
      // Dispara el check-in: le pregunta al ciudadano si se solucionó, en
      // vez de finalizar directamente.
      await sendCaseResolutionCheckin(notificationPayload);
    } else if (newStatus === "FINALIZADO" && existing.status !== "FINALIZADO") {
      // Cierre directo por el admin, sin pasar por el check-in del ciudadano.
      await sendCaseFinalizedNotification(notificationPayload);
    }
  } catch (error) {
    console.error(`[admin/cases] Falló la notificación del caso ${id}:`, error);
  }

  return NextResponse.json({ case: updated });
}
