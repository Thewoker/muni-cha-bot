import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "../../../../lib/admin-auth";
import { prisma } from "../../../../lib/prisma";

interface FaqInput {
  question?: string;
  answer?: string;
  category?: string;
  keywords?: string[];
}

function validate(body: FaqInput): string | null {
  if (!body.question || typeof body.question !== "string") return "Falta 'question'.";
  if (!body.answer || typeof body.answer !== "string") return "Falta 'answer'.";
  if (!body.category || typeof body.category !== "string") return "Falta 'category'.";
  if (!Array.isArray(body.keywords) || body.keywords.some((k) => typeof k !== "string")) {
    return "'keywords' debe ser un array de strings.";
  }
  return null;
}

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const faqs = await prisma.faqEntry.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ faqs });
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const body = (await request.json()) as FaqInput;
  const error = validate(body);
  if (error) return NextResponse.json({ error }, { status: 400 });

  const faq = await prisma.faqEntry.create({
    data: {
      question: body.question!,
      answer: body.answer!,
      category: body.category!,
      keywords: body.keywords!,
    },
  });

  return NextResponse.json({ faq }, { status: 201 });
}
