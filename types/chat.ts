export interface ChatRequestBody {
  message: string;
  conversationId?: string;
  citizenContact?: string;
}

export interface ChatResponseBody {
  conversationId: string;
  reply: string;
}
