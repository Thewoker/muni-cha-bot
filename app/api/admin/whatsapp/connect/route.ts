import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "../../../../../lib/admin-auth";
import {
  getWhatsAppStatus,
  startWhatsAppConnection,
} from "../../../../../lib/whatsapp/baileys-client";

export async function POST() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  await startWhatsAppConnection();
  return NextResponse.json(getWhatsAppStatus());
}
