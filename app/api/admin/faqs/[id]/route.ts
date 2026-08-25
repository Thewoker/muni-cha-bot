import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "../../../../../lib/admin-auth";
import { prisma } from "../../../../../lib/prisma";

interface FaqInput {
  question?: string;
  answer?: string;
  category?: string;
  keywords?: string[];
}

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/admin/faqs/[id]">,
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const { id } = await ctx.params;
  const body = (await request.json()) as FaqInput;

  if (body.keywords !== undefined) {
    if (!Array.isArray(body.keywords) || body.keywords.some((k) => typeof k !== "string")) {
      return NextResponse.json({ error: "'keywords' debe ser un array de strings." }, { status: 400 });
    }
  }

  const existing = await prisma.faqEntry.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "FAQ no encontrada." }, { status: 404 });
  }

  const faq = await prisma.faqEntry.update({
    where: { id },
    data: {
      question: body.question ?? undefined,
      answer: body.answer ?? undefined,
      category: body.category ?? undefined,
      keywords: body.keywords ?? undefined,
    },
  });

  return NextResponse.json({ faq });
}

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/admin/faqs/[id]">,
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const { id } = await ctx.params;

  const existing = await prisma.faqEntry.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "FAQ no encontrada." }, { status: 404 });
  }

  await prisma.faqEntry.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
