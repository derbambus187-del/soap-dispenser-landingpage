import { afterEach, describe, expect, it, vi } from "vitest";
import { assistants } from "../server/assistants.js";
import {
  ModelProviderError,
  requestModelCompletion,
  requestModelToolCompletion,
  streamModelCompletion,
} from "../server/model-provider.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("requestModelCompletion", () => {
  it("uses the configured compatible endpoint and keeps the key in the server request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: "Use a typed function." } }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const answer = await requestModelCompletion(
      { apiBaseUrl: "https://provider.test/v1/", apiKey: "server-secret", model: "custom-coder" },
      assistants[0],
      "Help me code",
      [{ role: "user", content: "Use TypeScript" }],
    );

    expect(answer).toBe("Use a typed function.");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://provider.test/v1/chat/completions",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer server-secret" }),
        body: expect.stringContaining('"model":"custom-coder"'),
      }),
    );
  });

  describe("requestModelToolCompletion", () => {
    it("supports Ollama without an API key and returns tool calls", async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [{
              message: {
                content: null,
                tool_calls: [{
                  id: "call-1",
                  type: "function",
                  function: { name: "list_files", arguments: "{\"path\":\"\"}" },
                }],
              },
            }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
      vi.stubGlobal("fetch", fetchMock);

      const result = await requestModelToolCompletion(
        { apiBaseUrl: "http://127.0.0.1:11434/v1", apiKey: "", model: "qwen3:8b" },
        [{ role: "user", content: "Inspect this project" }],
        [],
      );

      expect(result.toolCalls[0]).toMatchObject({
        id: "call-1",
        function: { name: "list_files" },
      });
      expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty("Authorization");
    });

    it("omits Ollama-only options for hosted providers", async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ choices: [{ message: { content: "Ready." } }] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
      vi.stubGlobal("fetch", fetchMock);

      await requestModelToolCompletion(
        { apiBaseUrl: "https://api.x.ai/v1", apiKey: "server-secret", model: "grok-4-1-fast" },
        [{ role: "user", content: "Inspect this project" }],
        [],
      );

      const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body as string) as Record<string, unknown>;
      expect(requestBody).not.toHaveProperty("keep_alive");
      expect(requestBody).not.toHaveProperty("options");
    });
  });

  describe("streamModelCompletion", () => {
    it("streams text as it arrives and bounds context for faster local replies", async () => {
      const encoder = new TextEncoder();
      const chunks = [
        'data: {"choices":[{"delta":{"content":"Hallo "}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"Welt"}}]}\n\n',
        "data: [DONE]\n\n",
      ];
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          for (const chunk of chunks) {
            controller.enqueue(encoder.encode(chunk));
          }
          controller.close();
        },
      });
      const fetchMock = vi.fn().mockResolvedValue(new Response(body, { status: 200 }));
      vi.stubGlobal("fetch", fetchMock);

      const received: string[] = [];
      for await (const content of streamModelCompletion(
        { apiBaseUrl: "http://127.0.0.1:11434/v1", apiKey: "", model: "qwen3:8b" },
        assistants[0],
        "Sag hallo",
        [],
      )) {
        received.push(content);
      }

      expect(received).toEqual(["Hallo ", "Welt"]);
      const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body as string) as {
        keep_alive: string;
        options: { num_ctx: number; num_predict: number };
        max_tokens: number;
        stream: boolean;
      };
      expect(requestBody).toMatchObject({
        keep_alive: "15m",
        max_tokens: 1200,
        options: { num_ctx: 8192, num_predict: 1200 },
        stream: true,
      });
    });
  });

  it("turns provider authentication failures into a helpful setup error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 401 })));

    await expect(
      requestModelCompletion(
        { apiBaseUrl: "https://provider.test/v1", apiKey: "invalid", model: "custom-coder" },
        assistants[0],
        "Help me code",
        [],
      ),
    ).rejects.toThrow(ModelProviderError);
  });
});
