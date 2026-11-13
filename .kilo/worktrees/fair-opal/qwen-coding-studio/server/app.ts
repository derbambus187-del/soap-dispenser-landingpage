import express, { type ErrorRequestHandler } from "express";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assistants, findAssistant } from "./assistants.js";
import {
  ModelProviderError,
  requestModelCompletion,
  streamModelCompletion,
  type ChatTurn,
  type ModelConfig,
} from "./model-provider.js";
import { runCodingAgent } from "./agent.js";
import type { AgentProgress } from "./agent.js";
import { resolveWorkspaceRoot } from "./workspace-tools.js";

const MAX_PROMPT_LENGTH = 20_000;
const MAX_HISTORY_TURNS = 8;

type AppConfig = ModelConfig & {
  workspaceRoot?: string;
};

type ChatRequest = {
  assistantId?: unknown;
  prompt?: unknown;
  history?: unknown;
};

type AgentRunner = (
  config: ModelConfig,
  assistant: (typeof assistants)[number],
  prompt: string,
  history: ChatTurn[],
  workspaceRoot: string,
  onProgress?: (progress: AgentProgress) => void,
) => Promise<{ response: string; actions: Array<{ tool: string; summary: string }> }>;

type CompletionHandler = (
  config: ModelConfig,
  assistant: (typeof assistants)[number],
  prompt: string,
  history: ChatTurn[],
) => Promise<string>;

type PreparedAgentRequest =
  | { status: number; error: string }
  | {
      assistant: (typeof assistants)[number];
      prompt: string;
      history: ChatTurn[];
      workspaceRoot: string;
    };

function getProviderName(apiBaseUrl: string): string {
  try {
    const hostname = new URL(apiBaseUrl).hostname.toLowerCase();
    if (hostname === "api.x.ai") {
      return "Grok · xAI";
    }
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return "Lokales Modell";
    }
    return hostname;
  } catch {
    return "KI-Anbieter";
  }
}

export function createApp(
  config: AppConfig,
  complete: CompletionHandler = requestModelCompletion,
  runAgent: AgentRunner = runCodingAgent,
) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", async (_request, response) => {
    const provider = getProviderName(config.apiBaseUrl);
    let providerConnected = false;
    let modelAvailable = false;
    let connectionMessage = "";
    try {
      const modelResponse = await fetch(`${config.apiBaseUrl.replace(/\/+$/, "")}/models`, {
        headers: config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : undefined,
        signal: AbortSignal.timeout(2_000),
      });
      providerConnected = modelResponse.ok;
      if (modelResponse.ok) {
        const payload = (await modelResponse.json()) as { data?: Array<{ id?: unknown }> };
        modelAvailable = payload.data?.some((model) => model.id === config.model || model.id === `ollama/${config.model}`) ?? false;
        if (!modelAvailable) {
          connectionMessage = `Modell ${config.model} wurde bei ${provider} nicht gefunden.`;
        }
      } else {
        connectionMessage = modelResponse.status === 401 || modelResponse.status === 403
          ? `Der Zugriff auf ${provider} wurde abgelehnt. Prüfe den API-Key.`
          : `${provider} antwortet mit HTTP ${modelResponse.status}.`;
      }
    } catch {
      connectionMessage = `${provider} ist nicht erreichbar. Prüfe die Verbindung.`;
    }

    let workspaceAvailable = false;
    try {
      workspaceAvailable = Boolean(await resolveWorkspaceRoot(config.workspaceRoot));
    } catch (error) {
      connectionMessage = error instanceof Error ? error.message : "Der Projektordner ist ungültig.";
    }

    response.json({
      status: "ok",
      provider,
      providerConnected,
      model: config.model,
      modelAvailable,
      workspaceAvailable,
      agentEnabled: providerConnected && modelAvailable && workspaceAvailable,
      message: connectionMessage,
    });
  });

  app.get("/api/assistants", (_request, response) => {
    response.json({
      assistants: assistants.map(({ systemPrompt: _systemPrompt, ...assistant }) => ({
        ...assistant,
        model: config.model,
        status: "ready",
      })),
    });
  });

  app.post("/api/chat", async (request, response) => {
    const body = request.body as ChatRequest;
    const assistant = findAssistant(body?.assistantId);
    if (!assistant) {
      response.status(400).json({ error: "Bitte wähle einen gültigen Assistenten aus." });
      return;
    }

    if (typeof body?.prompt !== "string" || !body.prompt.trim() || body.prompt.length > MAX_PROMPT_LENGTH) {
      response.status(400).json({
        error: `Die Nachricht muss zwischen 1 und ${MAX_PROMPT_LENGTH} Zeichen lang sein.`,
      });
      return;
    }

    const history = parseHistory(body?.history);
    if (!history) {
      response.status(400).json({
        error: `Der Gesprächskontext darf höchstens ${MAX_HISTORY_TURNS} Nachrichten enthalten.`,
      });
      return;
    }

    try {
      const answer = await complete(config, assistant, body.prompt.trim(), history);
      response.json({ response: answer });
    } catch (error) {
      if (error instanceof ModelProviderError) {
        response.status(502).json({ error: error.message });
        return;
      }

      console.error("Unexpected chat completion error", error);
      response.status(500).json({ error: "Die Anfrage ist fehlgeschlagen. Bitte versuche es erneut." });
    }
  });

  app.post("/api/chat/stream", async (request, response) => {
    const body = request.body as ChatRequest;
    const assistant = findAssistant(body?.assistantId);
    if (!assistant) {
      response.status(400).json({ error: "Bitte wähle einen gültigen Assistenten aus." });
      return;
    }
    if (typeof body?.prompt !== "string" || !body.prompt.trim() || body.prompt.length > MAX_PROMPT_LENGTH) {
      response.status(400).json({
        error: `Die Nachricht muss zwischen 1 und ${MAX_PROMPT_LENGTH} Zeichen lang sein.`,
      });
      return;
    }

    const history = parseHistory(body?.history);
    if (!history) {
      response.status(400).json({
        error: `Der Gesprächskontext darf höchstens ${MAX_HISTORY_TURNS} Nachrichten enthalten.`,
      });
      return;
    }

    response.status(200);
    response.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    response.setHeader("Cache-Control", "no-cache, no-transform");
    response.setHeader("Connection", "keep-alive");
    response.flushHeaders();
    const sendEvent = (event: unknown) => response.write(`data: ${JSON.stringify(event)}\n\n`);

    try {
      for await (const content of streamModelCompletion(config, assistant, body.prompt.trim(), history)) {
        sendEvent({ type: "delta", content });
      }
      sendEvent({ type: "done" });
    } catch (error) {
      if (error instanceof ModelProviderError) {
        sendEvent({ type: "error", error: error.message });
      } else {
        console.error("Unexpected streaming chat error", error);
        sendEvent({ type: "error", error: "Die Anfrage ist fehlgeschlagen. Bitte versuche es erneut." });
      }
    } finally {
      response.end();
    }
  });

  app.post("/api/agent", async (request, response) => {
    const prepared = await prepareAgentRequest(config, request.body as ChatRequest);
    if ("error" in prepared) {
      response.status(prepared.status).json({ error: prepared.error });
      return;
    }
    try {
      const result = await runAgent(
        { apiBaseUrl: config.apiBaseUrl, apiKey: config.apiKey, model: config.model },
        prepared.assistant,
        prepared.prompt,
        prepared.history,
        prepared.workspaceRoot,
      );
      response.json(result);
    } catch (error) {
      if (error instanceof ModelProviderError) {
        response.status(502).json({ error: error.message });
        return;
      }

      console.error("Unexpected autonomous coding error", error);
      response.status(500).json({ error: "Der Coding-Auftrag ist fehlgeschlagen. Bitte prüfe den Projektordner." });
    }
  });

  app.post("/api/agent/stream", async (request, response) => {
    const prepared = await prepareAgentRequest(config, request.body as ChatRequest);
    if ("error" in prepared) {
      response.status(prepared.status).json({ error: prepared.error });
      return;
    }

    response.status(200);
    response.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    response.setHeader("Cache-Control", "no-cache, no-transform");
    response.setHeader("Connection", "keep-alive");
    response.flushHeaders();
    const sendEvent = (event: unknown) => response.write(`data: ${JSON.stringify(event)}\n\n`);

    try {
      const result = await runAgent(
        { apiBaseUrl: config.apiBaseUrl, apiKey: config.apiKey, model: config.model },
        prepared.assistant,
        prepared.prompt,
        prepared.history,
        prepared.workspaceRoot,
        (progress) => sendEvent({ type: "progress", progress }),
      );
      sendEvent({ type: "done", response: result.response, actions: result.actions });
    } catch (error) {
      if (error instanceof ModelProviderError) {
        sendEvent({ type: "error", error: error.message });
      } else {
        console.error("Unexpected autonomous coding error", error);
        sendEvent({
          type: "error",
          error: "Der Coding-Auftrag ist fehlgeschlagen. Bitte prüfe den Projektordner.",
        });
      }
    } finally {
      response.end();
    }
  });

  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const projectArchive = path.resolve(currentDir, "../../laptop-projects.zip");
  app.get("/api/download/projects.zip", (_request, response) => {
    if (!existsSync(projectArchive)) {
      response.status(404).json({ error: "Das Projektarchiv ist gerade nicht verfügbar." });
      return;
    }

    response.download(projectArchive, "laptop-projects.zip", (error) => {
      if (error && !response.headersSent) {
        console.error("Could not send project archive", error);
        response.status(500).json({ error: "Der Download konnte nicht gestartet werden." });
      }
    });
  });

  const builtFrontend = path.resolve(currentDir, "../dist");
  if (existsSync(builtFrontend)) {
    app.use(express.static(builtFrontend));
    app.get("*", (_request, response) => {
      response.sendFile(path.join(builtFrontend, "index.html"));
    });
  }

  const jsonErrorHandler: ErrorRequestHandler = (error, _request, response, next) => {
    if (error instanceof SyntaxError && "body" in error) {
      response.status(400).json({ error: "Die Anfrage enthält ungültiges JSON." });
      return;
    }

    next(error);
  };
  app.use(jsonErrorHandler);

  return app;
}

async function prepareAgentRequest(config: AppConfig, body: ChatRequest): Promise<PreparedAgentRequest> {
  const assistant = findAssistant(body?.assistantId);
  if (!assistant) {
    return { status: 400, error: "Bitte wähle einen gültigen Assistenten aus." } as const;
  }
  if (typeof body?.prompt !== "string" || !body.prompt.trim() || body.prompt.length > MAX_PROMPT_LENGTH) {
    return {
      status: 400,
      error: `Der Auftrag muss zwischen 1 und ${MAX_PROMPT_LENGTH} Zeichen lang sein.`,
    } as const;
  }

  const history = parseHistory(body?.history);
  if (!history) {
    return {
      status: 400,
      error: `Der Gesprächskontext darf höchstens ${MAX_HISTORY_TURNS} Nachrichten enthalten.`,
    } as const;
  }

  let workspaceRoot: string | undefined;
  try {
    workspaceRoot = await resolveWorkspaceRoot(config.workspaceRoot);
  } catch (error) {
    return {
      status: 500,
      error: error instanceof Error ? error.message : "Der konfigurierte Projektordner ist ungültig.",
    } as const;
  }
  if (!workspaceRoot) {
    return {
      status: 503,
      error: "Autonomes Arbeiten ist deaktiviert. Trage den freigegebenen Projektordner in WORKSPACE_ROOT ein.",
    } as const;
  }

  return {
    assistant,
    prompt: body.prompt.trim(),
    history,
    workspaceRoot,
  } as const;
}

function parseHistory(value: unknown): ChatTurn[] | undefined {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value) || value.length > MAX_HISTORY_TURNS) {
    return undefined;
  }

  const turns: ChatTurn[] = [];
  for (const turn of value) {
    if (
      typeof turn !== "object" ||
      turn === null ||
      !("role" in turn) ||
      !("content" in turn) ||
      (turn.role !== "user" && turn.role !== "assistant") ||
      typeof turn.content !== "string" ||
      !turn.content.trim() ||
      turn.content.length > 8_000
    ) {
      return undefined;
    }
    turns.push({ role: turn.role, content: turn.content });
  }

  return turns;
}
