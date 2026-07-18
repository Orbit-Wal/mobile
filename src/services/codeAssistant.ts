import type { ChatMessage, CodeAssistantResponse } from "@/types/chat";

const apiUrl = process.env.EXPO_PUBLIC_API_URL;

/**
 * Sends chat history to a server-side AI proxy. API keys must stay on the server,
 * never in the mobile bundle. When no proxy is configured, a useful local response
 * keeps the screen usable for development and demos.
 */
export async function askCodeAssistant(messages: ChatMessage[]): Promise<CodeAssistantResponse> {
  if (apiUrl && !apiUrl.includes("localhost")) {
    const response = await fetch(`${apiUrl.replace(/\/$/, "")}/api/code-assistant/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: messages.map(({ role, content }) => ({ role, content })),
      }),
    });

    if (!response.ok) {
      throw new Error("The code assistant could not respond. Please try again.");
    }

    return response.json() as Promise<CodeAssistantResponse>;
  }

  const prompt = messages[messages.length - 1]?.content.trim() ?? "";
  return getDemoResponse(prompt);
}

function getDemoResponse(prompt: string): CodeAssistantResponse {
  const lowerPrompt = prompt.toLowerCase();

  if (lowerPrompt.includes("hello") || lowerPrompt.includes("help")) {
    return {
      message:
        "I can help generate, explain, refactor, and debug code. Ask me about a language, paste an error, or describe what you want to build.",
    };
  }

  if (lowerPrompt.includes("typescript") || lowerPrompt.includes("function")) {
    return {
      message: "Here is a small, typed example. Tell me the input and output you need and I can adapt it.",
      language: "typescript",
      code: `type User = { id: string; name: string };\n\nexport function findUser(users: User[], id: string): User | undefined {\n  return users.find((user) => user.id === id);\n}`,
    };
  }

  return {
    message:
      "I received your request. Connect EXPO_PUBLIC_API_URL to a server-side AI proxy for generated answers; API keys should never be included in a mobile app. In the meantime, ask for a TypeScript function or paste code you want reviewed.",
  };
}
