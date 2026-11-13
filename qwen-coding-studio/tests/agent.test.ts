import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { assistants } from "../server/assistants.js";
import { runCodingAgent } from "../server/agent.js";
import type { ModelConfig, ModelMessage, ModelReply, ModelTool } from "../server/model-provider.js";

let root = "";

afterEach(async () => {
  vi.restoreAllMocks();
  if (root) {
    await rm(root, { recursive: true, force: true });
    root = "";
  }
});

describe("runCodingAgent", () => {
  it("inspects, edits, and reports only actions it actually performed", async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "qwen-agent-"));
    await mkdir(path.join(root, "src"));
    await writeFile(path.join(root, "src", "old.ts"), "export const old = true;");

    const config: ModelConfig = {
      apiBaseUrl: "http://127.0.0.1:11434/v1",
      apiKey: "",
      model: "qwen3:8b",
    };
    const complete = vi.fn<
      (config: ModelConfig, messages: ModelMessage[], tools: ModelTool[]) => Promise<ModelReply>
    >();
    complete
      .mockResolvedValueOnce({
        content: "",
        toolCalls: [{
          id: "list",
          type: "function",
          function: { name: "list_files", arguments: "{\"path\":\"\"}" },
        }],
      })
      .mockResolvedValueOnce({
        content: "",
        toolCalls: [{
          id: "read",
          type: "function",
          function: { name: "read_file", arguments: "{\"path\":\"src/old.ts\"}" },
        }],
      })
      .mockResolvedValueOnce({
        content: "",
        toolCalls: [{
          id: "plan",
          type: "function",
          function: {
            name: "report_plan",
            arguments: "{\"steps\":[\"Vorhandenen Code berücksichtigen\",\"Neue Datei ergänzen\"]}",
          },
        }],
      })
      .mockResolvedValueOnce({
        content: "",
        toolCalls: [{
          id: "write",
          type: "function",
          function: {
            name: "write_file",
            arguments: "{\"path\":\"src/new.ts\",\"content\":\"export const fresh = true;\"}",
          },
        }],
      })
      .mockResolvedValueOnce({ content: "Die Datei wurde ergänzt.", toolCalls: [] });

    const result = await runCodingAgent(
      config,
      assistants[0],
      "Ergänze eine Datei.",
      [],
      root,
      undefined,
      complete,
    );

    expect(await readFile(path.join(root, "src", "new.ts"), "utf8")).toContain("fresh");
    expect(result.response).toContain("src/new.ts angelegt");
    expect(result.actions).toHaveLength(3);
    expect(complete).toHaveBeenCalledTimes(5);
  });

  it("uses a failed test result to make a fix and reruns the test", async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "qwen-agent-check-"));
    await writeFile(
      path.join(root, "package.json"),
      JSON.stringify({ scripts: { test: "node test.js" } }),
    );
    await writeFile(path.join(root, "test.js"), "process.exit(1);\n");

    const config: ModelConfig = {
      apiBaseUrl: "http://127.0.0.1:11434/v1",
      apiKey: "",
      model: "qwen3:8b",
    };
    const complete = vi.fn<
      (config: ModelConfig, messages: ModelMessage[], tools: ModelTool[]) => Promise<ModelReply>
    >();
    complete
      .mockResolvedValueOnce({
        content: "",
        toolCalls: [{
          id: "list",
          type: "function",
          function: { name: "list_files", arguments: "{\"path\":\"\"}" },
        }],
      })
      .mockResolvedValueOnce({
        content: "",
        toolCalls: [{
          id: "read",
          type: "function",
          function: { name: "read_file", arguments: "{\"path\":\"package.json\"}" },
        }],
      })
      .mockResolvedValueOnce({
        content: "",
        toolCalls: [{
          id: "read-test",
          type: "function",
          function: { name: "read_file", arguments: "{\"path\":\"test.js\"}" },
        }],
      })
      .mockResolvedValueOnce({
        content: "",
        toolCalls: [{
          id: "plan",
          type: "function",
          function: {
            name: "report_plan",
            arguments: "{\"steps\":[\"Vorhandenen Test prüfen\",\"Fehlerursache korrigieren\"]}",
          },
        }],
      })
      .mockResolvedValueOnce({
        content: "",
        toolCalls: [{
          id: "test-first",
          type: "function",
          function: { name: "run_checks", arguments: "{\"check\":\"test\"}" },
        }],
      })
      .mockResolvedValueOnce({
        content: "",
        toolCalls: [{
          id: "fix",
          type: "function",
          function: {
            name: "edit_file",
            arguments: JSON.stringify({
              path: "test.js",
              oldText: "process.exit(1);",
              newText: "process.exit(0);",
            }),
          },
        }],
      })
      .mockResolvedValueOnce({
        content: "",
        toolCalls: [{
          id: "test-again",
          type: "function",
          function: { name: "run_checks", arguments: "{\"check\":\"test\"}" },
        }],
      })
      .mockResolvedValueOnce({
        content: "Der Test schlug zuerst fehl. Ich habe den Fehler behoben und erneut geprüft.",
        toolCalls: [],
      });

    const result = await runCodingAgent(
      config,
      assistants[0],
      "Repariere den fehlgeschlagenen Test.",
      [],
      root,
      undefined,
      complete,
    );

    const checks = result.actions.filter(({ tool }) => tool === "run_checks");
    expect(checks).toHaveLength(2);
    expect(checks[0].summary).toContain("fehlgeschlagen");
    expect(checks[1].summary).toContain("erfolgreich");
    expect(result.response).toContain("npm test: fehlgeschlagen");
    expect(result.response).toContain("npm test: erfolgreich");
  });

  it("opens only explicitly requested, allowlisted websites in the client browser", async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "qwen-agent-open-"));
    const config: ModelConfig = {
      apiBaseUrl: "http://127.0.0.1:11434/v1",
      apiKey: "",
      model: "qwen3:8b",
    };
    const complete = vi.fn<
      (config: ModelConfig, messages: ModelMessage[], tools: ModelTool[]) => Promise<ModelReply>
    >();
    complete
      .mockResolvedValueOnce({
        content: "",
        toolCalls: [{
          id: "list",
          type: "function",
          function: { name: "list_files", arguments: "{\"path\":\"\"}" },
        }],
      })
      .mockResolvedValueOnce({
        content: "",
        toolCalls: [{
          id: "plan",
          type: "function",
          function: { name: "report_plan", arguments: "{\"steps\":[\"YouTube sicher im Browser öffnen\",\"Ergebnis bestätigen\"]}" },
        }],
      })
      .mockResolvedValueOnce({
        content: "",
        toolCalls: [{
          id: "open",
          type: "function",
          function: { name: "open_website", arguments: "{\"url\":\"https://www.youtube.com/\"}" },
        }],
      })
      .mockResolvedValueOnce({ content: "YouTube im Browser geöffnet.", toolCalls: [] });

    const result = await runCodingAgent(
      config,
      assistants[0],
      "Öffne YouTube im Browser.",
      [],
      root,
      undefined,
      complete,
    );

    expect(result.actions).toContainEqual(expect.objectContaining({
      tool: "open_website",
      phase: "external",
      url: "https://www.youtube.com/",
    }));
    expect(result.response).toContain("youtube.com im Browser geöffnet");
  });
});
