import type { Assistant } from "./assistants.js";
import type { ChatTurn, ModelConfig, ModelMessage, ModelReply, ModelTool } from "./model-provider.js";
import { ModelProviderError, requestModelToolCompletion } from "./model-provider.js";
import { executeWorkspaceTool, workspaceModelTools, type WorkspaceAction } from "./workspace-tools.js";

const MAX_AGENT_ROUNDS = 10;
const MAX_TOOL_CALLS = 10;

const planTool: ModelTool = {
  type: "function",
  function: {
    name: "report_plan",
    description: "Share a short user-visible implementation plan after inspecting the project and before changing files.",
    parameters: {
      type: "object",
      properties: {
        steps: {
          type: "array",
          items: { type: "string" },
          description: "Two to five concise steps describing how you will complete the requested work.",
        },
      },
      required: ["steps"],
    },
  },
};

export type AgentResult = {
  response: string;
  actions: WorkspaceAction[];
};

export type AgentProgress = {
  phase: "inspect" | "plan" | "edit" | "check" | "external";
  summary: string;
};

type ToolCompletion = (
  config: ModelConfig,
  messages: ModelMessage[],
  tools: ModelTool[],
) => Promise<ModelReply>;

export async function runCodingAgent(
  config: ModelConfig,
  assistant: Assistant,
  prompt: string,
  history: ChatTurn[],
  workspaceRoot: string,
  onProgress: (progress: AgentProgress) => void = () => undefined,
  complete: ToolCompletion = requestModelToolCompletion,
): Promise<AgentResult> {
  const actions: WorkspaceAction[] = [];
  const messages: ModelMessage[] = [
    {
      role: "system",
      content: [
        assistant.systemPrompt,
        "Du bist im autonomen Coding-Modus. Arbeite an der Nutzeraufgabe, nicht nur mit Ratschlägen.",
        "Arbeite wie ein sorgfältiger Entwickler: verstehe erst Aufgabe und Projekt, melde mit report_plan einen knappen Plan, ändere gezielt nur nötige Dateien, prüfe die Änderungen und iteriere bei Fehlern.",
        "Der freigegebene Ordner ist die einzige Projektumgebung. Starte immer mit list_files und lies den relevanten Code vor Änderungen.",
        "Rufe report_plan mit zwei bis fünf kurzen, konkreten Schritten auf, nachdem du den Projektkontext untersucht hast und bevor du Dateien erstellst oder änderst.",
        "Verwende edit_file für gezielte Änderungen (oldText muss eindeutig sein), write_file nur zum Anlegen neuer Dateien und create_directory für nötige Ordner.",
        "Führe nach Änderungen passende run_checks (test, lint, typecheck oder build) aus. Bei fehlgeschlagenen Checks: lies die Ausgabe, behebe die Ursache und führe den Check erneut aus.",
        "open_website ist nur für explizit vom Nutzer gewünschte Links gedacht und akzeptiert ausschließlich YouTube-/Discord-HTTPS-Links.",
        "Vermeide unnötige Änderungen, bewahre bestehendes Verhalten und fasse echte Testergebnisse am Ende zusammen.",
        "Du darfst keine anderen Shell-Befehle, Netzwerkaktionen, externen Ziele oder Zugriffe außerhalb des Projektordners ausführen.",
        "Wenn du fertig bist, fasse Änderungen und tatsächliche Prüfergebnisse knapp zusammen. Erfinde keine ausgeführten Aktionen.",
      ].join("\n"),
    },
    ...history.map(({ role, content }) => ({ role, content })),
    { role: "user", content: prompt },
  ];

  let toolCallCount = 0;
  let projectInspected = false;
  let planReported = false;
  for (let round = 0; round < MAX_AGENT_ROUNDS; round += 1) {
    onProgress({
      phase: round === 0 ? "inspect" : "plan",
      summary: round === 0 ? "Projekt und Aufgabe werden untersucht" : "Nächster Arbeitsschritt wird geplant",
    });
    const reply = await complete(config, messages, [...workspaceModelTools, planTool]);
    if (reply.toolCalls.length === 0) {
      if (!reply.content) {
        throw new ModelProviderError("Der Agent hat keine abschließende Antwort geliefert.");
      }

      const actionSummary = actions.length
        ? `\n\n**Tatsächlich ausgeführt:**\n${actions.map(({ summary }) => `- ${summary}`).join("\n")}`
        : "\n\nEs wurden keine Dateien geändert und keine Prüfungen gestartet.";
      return { response: `${reply.content}${actionSummary}`, actions };
    }

    toolCallCount += reply.toolCalls.length;
    if (toolCallCount > MAX_TOOL_CALLS) {
      throw new ModelProviderError("Der Agent hat das Aktionslimit erreicht. Bitte prüfe den bisherigen Stand und starte bei Bedarf einen neuen Auftrag.");
    }

    messages.push({
      role: "assistant",
      content: reply.content || null,
      tool_calls: reply.toolCalls,
    });

    for (const call of reply.toolCalls) {
      let output: string;
      try {
        const args: unknown = JSON.parse(call.function.arguments);
        if (typeof args !== "object" || args === null || Array.isArray(args)) {
          output = "Fehler: Tool-Argumente müssen ein JSON-Objekt sein.";
        } else if (call.function.name === "report_plan") {
          const steps = "steps" in args ? args.steps : undefined;
          if (!projectInspected) {
            output = "Fehler: Liste zuerst mit list_files die Projektdateien auf und untersuche den relevanten Code, bevor du den Plan meldest.";
          } else if (
            !Array.isArray(steps) ||
            steps.length < 2 ||
            steps.length > 5 ||
            !steps.every((step) => typeof step === "string" && step.trim())
          ) {
            output = "Fehler: Der Plan muss zwei bis fünf kurze Textschritte enthalten.";
          } else {
            planReported = true;
            for (const step of steps) {
              onProgress({ phase: "plan", summary: step.trim().slice(0, 180) });
            }
            output = `Plan erfasst:\n${steps.map((step) => `- ${step.trim()}`).join("\n")}`;
          }
        } else {
          const changesFile = ["write_file", "edit_file", "create_directory"].includes(call.function.name);
          if (call.function.name === "read_file" && !projectInspected) {
            output = "Fehler: Liste zuerst mit list_files die Projektdateien auf, bevor du Dateien liest.";
          } else if (changesFile && !planReported) {
            output = "Fehler: Untersuche erst den relevanten Code und melde mit report_plan deinen konkreten Plan, bevor du Dateien änderst.";
          } else {
            const result = await executeWorkspaceTool(
              workspaceRoot,
              call.function.name,
              args as Record<string, unknown>,
            );
            output = result.output;
            if (result.action) {
              actions.push(result.action);
              onProgress(result.action);
              if (result.action.tool === "list_files") {
                projectInspected = true;
              }
            }
            if (!result.ok) {
              output = `Fehler: ${output}`;
            }
          }
        }
      } catch {
        output = "Fehler: Ungültige Tool-Argumente.";
      }

      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: output.slice(0, 12_000),
      });
    }
  }

  throw new ModelProviderError("Der Agent hat das Rundenlimit erreicht, ohne die Aufgabe abzuschließen.");
}
