import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const faqs = [
  {
    question: "¿Cuál es el horario de atención de la municipalidad?",
    answer:
      "La atención al público es de lunes a viernes de 8:00 a 14:00 hs en la sede central.",
    category: "horarios",
    keywords: ["horario", "horarios", "atencion", "atención", "abren", "cierran"],
  },
  {
    question: "¿Cómo saco el registro de conducir?",
    answer:
      "Debés sacar turno online, presentar DNI, certificado de grupo sanguíneo y aprobar el examen teórico-práctico. El costo se abona el día del turno.",
    category: "tramites",
    keywords: ["registro", "conducir", "licencia", "carnet", "manejar"],
  },
  {
    question: "¿Qué necesito para habilitar un comercio?",
    answer:
      "Necesitás: DNI, constancia de CUIT, plano del local, y certificado de uso conforme. El trámite se inicia en la Dirección de Comercio.",
    category: "tramites",
    keywords: ["habilitacion", "habilitación", "comercio", "negocio", "local"],
  },
  {
    question: "¿Dónde pago la tasa municipal?",
    answer:
      "Podés pagarla online en el portal de pagos, por débito automático, o en las cajas de la municipalidad de 8:00 a 13:00 hs.",
    category: "pagos",
    keywords: ["tasa", "pago", "pagar", "impuesto", "boleta"],
  },
  {
    question: "¿Cómo hago un reclamo por alumbrado público?",
    answer:
      "Podés reclamar directamente por este chat contándonos la dirección y el problema, o llamando al 0800-555-0000.",
    category: "reclamos",
    keywords: ["alumbrado", "luz", "lampara", "lámpara", "poste", "reclamo"],
  },
];

async function main() {
  for (const faq of faqs) {
    await prisma.faqEntry.create({ data: faq });
  }
  console.log(`Seed OK: ${faqs.length} FAQs creadas.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
