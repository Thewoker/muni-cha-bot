import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

/**
 * Historial de una conversación pública (widget de chat, no admin). No
 * requiere auth: el conversationId funciona como el "secreto" — es un cuid
 * aleatorio guardado en el localStorage del navegador de ese ciudadano, el
 * mismo modelo de confianza que un token de sesión de checkout.
 */
export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/chat/[conversationId]">,
) {
  const { conversationId } = await ctx.params;

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });

  if (!conversation) {
    return NextResponse.json({ error: "Conversación no encontrada." }, { status: 404 });
  }

  return NextResponse.json({
    messages: conversation.messages.map((m) => ({
      role: m.role,
      content: m.content,
      createdAt: m.createdAt,
    })),
  });
}
