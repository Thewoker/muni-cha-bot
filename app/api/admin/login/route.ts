import { NextResponse } from "next/server";
import { setAdminSessionCookie, verifyAdminPassword } from "../../../../lib/admin-auth";

export async function POST(request: Request) {
  const body = (await request.json()) as { password?: string };

  if (!body.password || !verifyAdminPassword(body.password)) {
    return NextResponse.json({ error: "Clave incorrecta." }, { status: 401 });
  }

  await setAdminSessionCookie();
  return NextResponse.json({ ok: true });
}
