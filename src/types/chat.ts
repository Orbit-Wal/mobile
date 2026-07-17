export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
  code?: string;
  language?: string;
}

export interface CodeAssistantResponse {
  message: string;
  code?: string;
  language?: string;
}
