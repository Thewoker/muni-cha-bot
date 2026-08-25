import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "../../../../../lib/admin-auth";
import {
  getWhatsAppStatus,
  stopWhatsAppConnection,
} from "../../../../../lib/whatsapp/baileys-client";

export async function POST() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  await stopWhatsAppConnection();
  return NextResponse.json(getWhatsAppStatus());
}
