import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "../../../../lib/admin-auth";
import { prisma } from "../../../../lib/prisma";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const cases = await prisma.case.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ cases });
}
