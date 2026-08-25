import { NextResponse } from "next/server";
import { processIncomingMessage } from "../../../lib/chat-engine";
import type { ChatRequestBody, ChatResponseBody } from "../../../types/chat";

export async function POST(request: Request) {
  const body = (await request.json()) as ChatRequestBody;

  if (!body.message || typeof body.message !== "string") {
    return NextResponse.json({ error: "Falta 'message'." }, { status: 400 });
  }

  const result = await processIncomingMessage({
    message: body.message,
    conversationId: body.conversationId,
    citizenContact: body.citizenContact,
  });

  const response: ChatResponseBody = result;
  return NextResponse.json(response);
}
