import { Resend } from "resend";
import { isPhoneLike } from "./phone";
import { isWhatsAppConnected, sendWhatsAppMessage } from "./whatsapp/baileys-client";

export interface CaseNotificationPayload {
  caseId: string;
  citizenName: string;
  citizenContact: string;
  description: string;
}

function looksLikeEmail(contact: string): boolean {
  return contact.includes("@");
}

/**
 * Envía un mensaje al ciudadano por el mejor canal disponible: WhatsApp (si
 * el contacto es un teléfono y hay sesión conectada) con fallback a email
 * vía Resend. Único punto de extensión para cambiar de canal más adelante
 * (ej. WhatsApp Business API oficial) sin tocar el resto del sistema.
 */
async function sendCitizenMessage(
  caseId: string,
  contact: string,
  subject: string,
  text: string,
): Promise<void> {
  const trimmed = contact.trim();

  if (isPhoneLike(trimmed) && isWhatsAppConnected()) {
    const digitsOnly = trimmed.replace(/[^\d]/g, "");
    const sent = await sendWhatsAppMessage(digitsOnly, text);
    if (sent) return;
  }

  if (!looksLikeEmail(trimmed)) {
    console.warn(
      `[notifications] Caso ${caseId}: no se pudo notificar (contacto "${trimmed}" no es email ni WhatsApp disponible).`,
    );
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(
      `[notifications] RESEND_API_KEY no configurada, se omite el envío para el caso ${caseId}.`,
    );
    return;
  }

  const resend = new Resend(apiKey);
  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev",
    to: trimmed,
    subject,
    text,
  });
}

/**
 * Se dispara cuando un caso pasa a RESUELTO: le pregunta al ciudadano si el
 * problema quedó solucionado. La respuesta se procesa en el motor de chat
 * (tool confirm_case_resolution) cuando el ciudadano contesta.
 */
export async function sendCaseResolutionCheckin(
  payload: CaseNotificationPayload,
): Promise<void> {
  const text = [
    `Hola ${payload.citizenName},`,
    "",
    `Tu reclamo (ID: ${payload.caseId}) fue marcado como resuelto por el municipio.`,
    "",
    `Descripción original: ${payload.description}`,
    "",
    "¿Tu problema quedó solucionado? Respondé por este mismo medio y lo confirmamos.",
  ].join("\n");

  await sendCitizenMessage(
    payload.caseId,
    payload.citizenContact,
    `¿Se solucionó tu reclamo #${payload.caseId}?`,
    text,
  );
}

/**
 * Se dispara cuando un caso pasa a FINALIZADO (directamente, sin pasar por
 * el check-in — por ejemplo si el admin lo cierra a mano).
 */
export async function sendCaseFinalizedNotification(
  payload: CaseNotificationPayload,
): Promise<void> {
  const text = [
    `Hola ${payload.citizenName},`,
    "",
    `Te informamos que tu reclamo (ID: ${payload.caseId}) fue marcado como finalizado.`,
    "",
    `Descripción original: ${payload.description}`,
    "",
    "Gracias por contactarte con el municipio.",
  ].join("\n");

  await sendCitizenMessage(
    payload.caseId,
    payload.citizenContact,
    `Tu reclamo #${payload.caseId} fue finalizado`,
    text,
  );
}
