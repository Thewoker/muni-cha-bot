import { Boom } from "@hapi/boom";
import makeWASocket, {
  Browsers,
  DisconnectReason,
  useMultiFileAuthState as loadMultiFileAuthState,
  type WAMessage,
  type WASocket,
} from "@whiskeysockets/baileys";
import { rm } from "fs/promises";
import path from "path";
import { pino } from "pino";
import QRCode from "qrcode";
import { processIncomingMessage } from "../chat-engine";
import { findLatestConversationIdByContact } from "../conversation-history";
import { normalizeArgentinePhone } from "../phone";

export type WhatsAppStatus =
  | "disconnected"
  | "connecting"
  | "qr"
  | "connected";

interface WhatsAppState {
  status: WhatsAppStatus;
  qrDataUrl: string | null;
  phoneNumber: string | null;
  sock: WASocket | null;
}

const AUTH_DIR = path.join(process.cwd(), "whatsapp-auth");

const globalForWhatsApp = globalThis as unknown as {
  __whatsappState: WhatsAppState | undefined;
};

const state: WhatsAppState = globalForWhatsApp.__whatsappState ?? {
  status: "disconnected",
  qrDataUrl: null,
  phoneNumber: null,
  sock: null,
};
globalForWhatsApp.__whatsappState = state;

export interface WhatsAppStatusSnapshot {
  status: WhatsAppStatus;
  qrDataUrl: string | null;
  phoneNumber: string | null;
}

export function getWhatsAppStatus(): WhatsAppStatusSnapshot {
  return {
    status: state.status,
    qrDataUrl: state.qrDataUrl,
    phoneNumber: state.phoneNumber,
  };
}

function jidToPhone(jid: string): string {
  return jid.split("@")[0].split(":")[0];
}

/**
 * Baileys 7 puede entregar `remoteJid` como un LID (identificador interno de
 * WhatsApp, ej. "140411272167525@lid") en vez del JID con el número real
 * ("549...@s.whatsapp.net"). Cuando eso pasa, el número real viene en
 * `remoteJidAlt`. Si no está disponible, devolvemos null en vez de guardar
 * el LID como si fuera un teléfono (rompería la normalización y el
 * matching contra los casos).
 */
function resolvePhoneJid(message: WAMessage): string | null {
  const key = message.key;
  if (!key?.remoteJid) return null;
  if (key.remoteJid.endsWith("@lid")) {
    return key.remoteJidAlt ?? null;
  }
  return key.remoteJid;
}

function extractText(message: WAMessage): string | null {
  const content = message.message;
  if (!content) return null;
  return (
    content.conversation ??
    content.extendedTextMessage?.text ??
    content.imageMessage?.caption ??
    content.videoMessage?.caption ??
    null
  );
}

async function handleIncomingMessages(sock: WASocket, messages: WAMessage[]) {
  for (const message of messages) {
    const remoteJid = message.key?.remoteJid;
    if (!remoteJid) continue;
    if (message.key?.fromMe) continue;
    if (remoteJid.endsWith("@g.us") || remoteJid.endsWith("@broadcast")) continue;

    const text = extractText(message);
    if (!text) continue;

    const phoneJid = resolvePhoneJid(message);
    if (!phoneJid) {
      console.warn(
        `[whatsapp] No se pudo resolver el número real para ${remoteJid} (LID sin remoteJidAlt); se omite el mensaje.`,
      );
      continue;
    }

    // Normalizado a +549<resto> para que coincida con el formato en que se
    // guardan los casos (ver lib/tools/create-case.ts).
    const contact = normalizeArgentinePhone(jidToPhone(phoneJid));

    try {
      const conversationId = await findLatestConversationIdByContact(contact);
      const result = await processIncomingMessage({
        message: text,
        conversationId,
        citizenContact: contact,
      });
      await sock.sendMessage(remoteJid, { text: result.reply });
    } catch (error) {
      console.error("[whatsapp] Error procesando mensaje entrante:", error);
      await sock
        .sendMessage(remoteJid, {
          text: "Perdón, tuvimos un problema técnico. Probá de nuevo en un momento.",
        })
        .catch(() => {});
    }
  }
}

export async function startWhatsAppConnection(): Promise<void> {
  if (state.status === "connecting" || state.status === "connected") return;

  state.status = "connecting";
  state.qrDataUrl = null;

  const { state: authState, saveCreds } = await loadMultiFileAuthState(AUTH_DIR);

  const sock = makeWASocket({
    auth: authState,
    printQRInTerminal: false,
    browser: Browsers.ubuntu("Chatbot Municipal"),
    logger: pino({ level: "silent" }),
  });

  state.sock = sock;

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, qr, lastDisconnect } = update;

    if (qr) {
      state.status = "qr";
      state.qrDataUrl = await QRCode.toDataURL(qr);
    }

    if (connection === "open") {
      state.status = "connected";
      state.qrDataUrl = null;
      state.phoneNumber = sock.user?.id ? jidToPhone(sock.user.id) : null;
    }

    if (connection === "close") {
      const statusCode = (lastDisconnect?.error as Boom | undefined)?.output
        ?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;

      state.sock = null;
      state.qrDataUrl = null;
      state.phoneNumber = null;

      if (loggedOut) {
        state.status = "disconnected";
        await rm(AUTH_DIR, { recursive: true, force: true }).catch(() => {});
      } else {
        state.status = "disconnected";
        // Reconexión simple: reintenta una vez. Para producción real conviene
        // backoff exponencial; alcanza para el piloto.
        void startWhatsAppConnection();
      }
    }
  });

  sock.ev.on("messages.upsert", ({ messages, type }) => {
    if (type !== "notify") return;
    void handleIncomingMessages(sock, messages);
  });
}

export async function stopWhatsAppConnection(): Promise<void> {
  if (state.sock) {
    await state.sock.logout().catch(() => {});
    state.sock = null;
  }
  state.status = "disconnected";
  state.qrDataUrl = null;
  state.phoneNumber = null;
  await rm(AUTH_DIR, { recursive: true, force: true }).catch(() => {});
}

export async function sendWhatsAppMessage(
  phoneNumber: string,
  text: string,
): Promise<boolean> {
  if (state.status !== "connected" || !state.sock) return false;
  const jid = `${phoneNumber}@s.whatsapp.net`;
  await state.sock.sendMessage(jid, { text });
  return true;
}

export function isWhatsAppConnected(): boolean {
  return state.status === "connected";
}
