import type { Assistant } from "./assistants.js";

export type ChatTurn = {
  role: "user" | "assistant";
  content: string;
};

export type ModelConfig = {
  apiBaseUrl: string;
  apiKey: string;
  model: string;
};

function usesOllamaOptions(config: ModelConfig): boolean {
  try {
    const url = new URL(config.apiBaseUrl);
    return (url.hostname === "localhost" || url.hostname === "127.0.0.1") && url.port === "11434";
  } catch {
    return false;
  }
}

export type ModelMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
};

export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type ModelTool = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
};

export type ModelReply = {
  content: string;
  toolCalls: ToolCall[];
};

export class ModelProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ModelProviderError";
  }
}

type CompletionResponse = {
  choices?: Array<{
    message?: {
      content?: unknown;
      tool_calls?: Array<{
        id?: unknown;
        type?: unknown;
        function?: {
          name?: unknown;
          arguments?: unknown;
        };
      }>;
    };
    delta?: {
      content?: unknown;
    };
  }>;
};

function extractText(content: unknown): string {
  if (typeof content === "string") {
    return content.trim();
  }

  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .map((part) => {
      if (typeof part === "object" && part !== null && "text" in part && typeof part.text === "string") {
        return part.text;
      }

      return "";
    })
    .join("")
    .trim();
}

export async function requestModelCompletion(
  config: ModelConfig,
  assistant: Assistant,
  prompt: string,
  history: ChatTurn[],
): Promise<string> {
  let response: Response;

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (config.apiKey) {
      headers.Authorization = `Bearer ${config.apiKey}`;
    }

    response = await fetch(`${config.apiBaseUrl.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: "system", content: assistant.systemPrompt },
          ...history.map(({ role, content }) => ({ role, content })),
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 1200,
        keep_alive: "15m",
        options: {
          num_ctx: 8192,
          num_predict: 1200,
        },
      }),
      signal: AbortSignal.timeout(90_000),
    });
  } catch {
    throw new ModelProviderError("Das KI-Modell ist gerade nicht erreichbar. Prüfe die Verbindung und versuche es erneut.");
  }

  if (!response.ok) {
    throw new ModelProviderError(
      response.status === 401 || response.status === 403
        ? "Der Anbieter hat die Anfrage abgelehnt. Prüfe API-Key und Modellzugriff."
        : `Das Modell konnte die Anfrage nicht verarbeiten (HTTP ${response.status}).`,
    );
  }

  let payload: CompletionResponse;
  try {
    payload = (await response.json()) as CompletionResponse;
  } catch {
    throw new ModelProviderError("Der Modellanbieter hat eine ungültige Antwort zurückgegeben.");
  }

  const content = extractText(payload.choices?.[0]?.message?.content);
  if (!content) {
    throw new ModelProviderError("Das Modell hat keine Antwort zurückgegeben. Versuche es bitte erneut.");
  }

  return content;
}

export async function* streamModelCompletion(
  config: ModelConfig,
  assistant: Assistant,
  prompt: string,
  history: ChatTurn[],
): AsyncGenerator<string> {
  let response: Response;
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (config.apiKey) {
      headers.Authorization = `Bearer ${config.apiKey}`;
    }
    const ollamaOptions = usesOllamaOptions(config)
      ? { keep_alive: "15m", options: { num_ctx: 8192, num_predict: 1200 } }
      : {};

    response = await fetch(`${config.apiBaseUrl.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: "system", content: assistant.systemPrompt },
          ...history.map(({ role, content }) => ({ role, content })),
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 1200,
        ...ollamaOptions,
        stream: true,
      }),
      signal: AbortSignal.timeout(90_000),
    });
  } catch {
    throw new ModelProviderError("Der KI-Anbieter ist nicht erreichbar. Prüfe Verbindung und Konfiguration.");
  }

  if (!response.ok) {
    throw new ModelProviderError(
      response.status === 401 || response.status === 403
        ? "Der Modellanbieter hat den Zugriff abgelehnt. Prüfe Modellname und API-Key."
        : `Das Modell konnte die Anfrage nicht verarbeiten (HTTP ${response.status}).`,
    );
  }
  if (!response.body) {
    throw new ModelProviderError("Der Modellanbieter unterstützt keine gestreamten Antworten.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let sentContent = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data:")) {
          continue;
        }
        const data = line.slice(5).trim();
        if (!data || data === "[DONE]") {
          continue;
        }

        let payload: CompletionResponse;
        try {
          payload = JSON.parse(data) as CompletionResponse;
        } catch {
          throw new ModelProviderError("Das Modell hat einen ungültigen Antwort-Stream gesendet.");
        }
        const chunk = payload.choices?.[0]?.delta?.content;
        const content = typeof chunk === "string" ? chunk : extractText(chunk);
        if (content) {
          sentContent = true;
          yield content;
        }
      }

      if (done) {
        if (buffer.startsWith("data:") && buffer.slice(5).trim() !== "[DONE]") {
          try {
            const payload = JSON.parse(buffer.slice(5).trim()) as CompletionResponse;
            const chunk = payload.choices?.[0]?.delta?.content;
            const content = typeof chunk === "string" ? chunk : extractText(chunk);
            if (content) {
              sentContent = true;
              yield content;
            }
          } catch (error) {
            if (error instanceof ModelProviderError) {
              throw error;
            }
            throw new ModelProviderError("Das Modell hat einen ungültigen Antwort-Stream gesendet.");
          }
        }
        break;
      }
    }
  } catch (error) {
    if (error instanceof ModelProviderError) {
      throw error;
    }
    throw new ModelProviderError("Der Modell-Stream wurde unerwartet unterbrochen.");
  } finally {
    reader.releaseLock();
  }

  if (!sentContent) {
    throw new ModelProviderError("Das Modell hat keine Antwort zurückgegeben.");
  }
}

export async function requestModelToolCompletion(
  config: ModelConfig,
  messages: ModelMessage[],
  tools: ModelTool[],
): Promise<ModelReply> {
  let response: Response;

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (config.apiKey) {
      headers.Authorization = `Bearer ${config.apiKey}`;
    }
    const ollamaOptions = usesOllamaOptions(config)
      ? { keep_alive: "15m", options: { num_ctx: 8192, num_predict: 1600 } }
      : {};

    response = await fetch(`${config.apiBaseUrl.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: config.model,
        messages,
        tools,
        tool_choice: "auto",
        temperature: 0.2,
        max_tokens: 1600,
        ...ollamaOptions,
      }),
      signal: AbortSignal.timeout(90_000),
    });
  } catch {
    throw new ModelProviderError("Der KI-Anbieter ist nicht erreichbar. Prüfe Verbindung und Konfiguration.");
  }

  if (!response.ok) {
    throw new ModelProviderError(
      response.status === 401 || response.status === 403
        ? "Der Modellanbieter hat den Zugriff abgelehnt. Prüfe Modellname und API-Key."
        : `Das Modell konnte die Anfrage nicht verarbeiten (HTTP ${response.status}).`,
    );
  }

  let payload: CompletionResponse;
  try {
    payload = (await response.json()) as CompletionResponse;
  } catch {
    throw new ModelProviderError("Der Modellanbieter hat eine ungültige Antwort zurückgegeben.");
  }

  const message = payload.choices?.[0]?.message;
  const content = extractText(message?.content);
  const toolCalls = (message?.tool_calls ?? []).flatMap((call): ToolCall[] => {
    if (
      typeof call.id !== "string" ||
      call.type !== "function" ||
      typeof call.function?.name !== "string" ||
      typeof call.function.arguments !== "string"
    ) {
      return [];
    }

    return [{
      id: call.id,
      type: "function",
      function: {
        name: call.function.name,
        arguments: call.function.arguments,
      },
    }];
  });

  if (!content && toolCalls.length === 0) {
    throw new ModelProviderError("Das Modell hat weder Text noch eine Aktion zurückgegeben.");
  }

  return { content, toolCalls };
}
