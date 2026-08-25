import { prisma } from "./prisma";

const STOPWORDS = new Set([
  "el", "la", "los", "las", "un", "una", "unos", "unas", "de", "del", "en",
  "y", "o", "a", "por", "para", "que", "es", "como", "cómo", "cual", "cuál",
  "donde", "dónde", "mi", "me", "necesito", "quiero", "hola", "buenas",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita acentos
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOPWORDS.has(word));
}

export interface FaqMatch {
  question: string;
  answer: string;
  category: string;
  score: number;
}

/**
 * Búsqueda simple por solapamiento de keywords (sin pgvector).
 * Trae candidatos por overlap en `keywords` y también matchea contra
 * la pregunta, y rankea localmente por cantidad de tokens en común.
 */
export async function searchFaqs(
  userMessage: string,
  limit = 5,
): Promise<FaqMatch[]> {
  const queryTokens = tokenize(userMessage);
  if (queryTokens.length === 0) return [];

  const candidates = await prisma.faqEntry.findMany({
    where: {
      OR: [
        { keywords: { hasSome: queryTokens } },
        ...queryTokens.map((token) => ({
          question: { contains: token, mode: "insensitive" as const },
        })),
      ],
    },
    take: 50,
  });

  const scored = candidates.map((entry) => {
    const entryTokens = new Set([
      ...entry.keywords.map((keyword) => keyword.toLowerCase()),
      ...tokenize(entry.question),
    ]);
    const overlap = queryTokens.filter((token) => entryTokens.has(token)).length;
    return {
      question: entry.question,
      answer: entry.answer,
      category: entry.category,
      score: overlap,
    };
  });

  return scored
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
