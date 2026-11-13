import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { Response as SupertestResponse } from "supertest";
import { createApp } from "../server/app.js";
import { ModelProviderError } from "../server/model-provider.js";

const configured = {
  apiBaseUrl: "https://example.test/v1",
  apiKey: "test-key",
  model: "qwen-coder-test",
};
let workspace = "";

afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  if (workspace) {
    await rm(workspace, { recursive: true, force: true });
    workspace = "";
  }
});

describe("GET /api/health", () => {
  it("reports Grok connectivity without exposing the API key", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [{ id: "grok-4-1-fast" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await request(createApp({
      ...configured,
      apiBaseUrl: "https://api.x.ai/v1",
      model: "grok-4-1-fast",
    })).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      provider: "Grok · xAI",
      model: "grok-4-1-fast",
      providerConnected: true,
      modelAvailable: true,
    });
    expect(JSON.stringify(response.body)).not.toContain(configured.apiKey);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.x.ai/v1/models",
      expect.objectContaining({ headers: { Authorization: `Bearer ${configured.apiKey}` } }),
    );
  });
});

describe("GET /api/assistants", () => {
  it("lists the two coding assistants without exposing their system prompts", async () => {
    const response = await request(createApp(configured)).get("/api/assistants");

    expect(response.status).toBe(200);
    expect(response.body.assistants.map((assistant: { id: string }) => assistant.id)).toEqual([
      "builder",
      "reviewer",
    ]);
    expect(response.body.assistants[0]).toMatchObject({
      name: "Builder",
      model: "qwen-coder-test",
      status: "ready",
    });
    expect(response.body.assistants[0]).not.toHaveProperty("systemPrompt");
  });
});

describe("POST /api/chat", () => {
  it("forwards the selected assistant and recent context to the configured model", async () => {
    const complete = vi.fn().mockResolvedValue("Try this implementation.");
    const response = await request(createApp(configured, complete))
      .post("/api/chat")
      .send({
        assistantId: "builder",
        prompt: "Write a typed helper",
        history: [{ role: "user", content: "Use TypeScript" }],
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ response: "Try this implementation." });
    expect(complete).toHaveBeenCalledWith(
      configured,
      expect.objectContaining({ id: "builder" }),
      "Write a typed helper",
      [{ role: "user", content: "Use TypeScript" }],
    );
  });

  it("rejects invalid input without calling the provider", async () => {
    const complete = vi.fn();
    const response = await request(createApp(configured, complete))
      .post("/api/chat")
      .send({ assistantId: "unknown", prompt: "Help" });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/Assistenten/);
    expect(complete).not.toHaveBeenCalled();
  });

  it("allows keyless local-model chat and returns the actual provider response", async () => {
    const complete = vi.fn().mockResolvedValue("A local-model answer.");
    const response = await request(createApp({ ...configured, apiKey: "" }, complete))
      .post("/api/chat")
      .send({ assistantId: "builder", prompt: "Help" });

    expect(response.status).toBe(200);
    expect(response.body.response).toBe("A local-model answer.");
    expect(complete).toHaveBeenCalledOnce();
  });

  it("surfaces provider errors as a gateway error", async () => {
    const complete = vi.fn().mockRejectedValue(new ModelProviderError("Model provider unavailable."));
    const response = await request(createApp(configured, complete))
      .post("/api/chat")
      .send({ assistantId: "reviewer", prompt: "Review this" });

    expect(response.status).toBe(502);
    expect(response.body.error).toMatch(/provider unavailable/i);
  });
});

describe("POST /api/agent", () => {
  it("refuses autonomous work until a project folder is explicitly configured", async () => {
    const runAgent = vi.fn();
    const response = await request(createApp(configured, undefined, runAgent))
      .post("/api/agent")
      .send({ assistantId: "builder", prompt: "Fix the bug" });

    expect(response.status).toBe(503);
    expect(response.body.error).toMatch(/WORKSPACE_ROOT/);
    expect(runAgent).not.toHaveBeenCalled();
  });

  it("passes only the configured project folder to the coding agent", async () => {
    workspace = await mkdtemp(path.join(os.tmpdir(), "qwen-agent-api-"));
    const runAgent = vi.fn().mockResolvedValue({ response: "Done.", actions: [] });
    const response = await request(createApp({ ...configured, workspaceRoot: workspace }, undefined, runAgent))
      .post("/api/agent")
      .send({ assistantId: "reviewer", prompt: "Review this project" });

    expect(response.status).toBe(200);
    expect(response.body.response).toBe("Done.");
    expect(runAgent).toHaveBeenCalledWith(
      configured,
      expect.objectContaining({ id: "reviewer" }),
      "Review this project",
      [],
      workspace,
    );
  });

  it("streams visible progress and the completed result", async () => {
    workspace = await mkdtemp(path.join(os.tmpdir(), "qwen-agent-stream-"));
    const runAgent = vi.fn(async (_config, _assistant, _prompt, _history, _root, onProgress) => {
      onProgress?.({ phase: "inspect", summary: "Projekt wird untersucht" });
      onProgress?.({ phase: "edit", summary: "src/app.ts gezielt geändert" });
      return { response: "Umsetzung abgeschlossen.", actions: [] };
    });
    const response = await request(createApp({ ...configured, workspaceRoot: workspace }, undefined, runAgent))
      .post("/api/agent/stream")
      .buffer(true)
      .parse((stream, callback) => {
      let body = "";
        stream.setEncoding("utf8");
        stream.on("data", (chunk: string) => { body += chunk; });
        stream.on("end", () => callback(null, body));
      })
      .send({ assistantId: "builder", prompt: "Fix the project" });

    expect(response.status).toBe(200);
    expect(response.body).toContain('"phase":"inspect"');
    expect(response.body).toContain("src/app.ts gezielt geändert");
    expect(response.body).toContain('"type":"done"');
    expect(response.body).toContain("Umsetzung abgeschlossen.");
  });

  it("streams model tokens before the full answer is complete", async () => {
    const encoder = new TextEncoder();
    const fetchMock = vi.fn().mockResolvedValue(new Response(new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"Schnell "}}]}\n\n'));
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"da"}}]}\n\n'));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const parseStream = (stream: SupertestResponse, callback: (error: Error | null, body: string) => void) => {
      let body = "";
      stream.setEncoding("utf8");
      stream.on("data", (chunk: string) => { body += chunk; });
      stream.on("end", () => callback(null, body));
    };

    const response = await request(createApp(configured))
      .post("/api/chat/stream")
      .buffer(true)
      .parse(parseStream)
      .send({ assistantId: "builder", prompt: "Sag etwas Kurzes" });

    expect(response.status).toBe(200);
    expect(response.body).toContain('"content":"Schnell "');
    expect(response.body).toContain('"content":"da"');
    expect(response.body).toContain('"type":"done"');
  });
});
