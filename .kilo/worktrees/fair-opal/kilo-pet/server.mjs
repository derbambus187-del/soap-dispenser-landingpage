import { createServer } from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const port = Number(process.env.KILO_PET_PORT ?? 4174);
const labels = {
  idle: "Wartet auf Kilo",
  reading: "Kilo liest deinen Auftrag",
  planning: "Kilo plant die nächsten Schritte",
  working: "Kilo setzt die Änderungen um",
  testing: "Kilo prüft die Änderungen",
  done: "Alles erledigt!",
  interrupted: "Die Aufgabe wurde unterbrochen"
};
let state = { status: "idle", label: labels.idle, updatedAt: new Date().toISOString() };

function publish(status) {
  state = { status, label: labels[status], updatedAt: new Date().toISOString() };
}

const web = createServer((request, response) => {
  if (request.method !== "GET") {
    response.writeHead(405).end();
    return;
  }

  if (request.url === "/api/state") {
    response.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
    response.end(JSON.stringify(state));
    return;
  }

  response.writeHead(404).end();
});

web.listen(port, "127.0.0.1", () => {
  console.error(`Kilo Pet status service listening on 127.0.0.1:${port}`);
});

const mcp = new McpServer({ name: "kilo-pet", version: "1.0.0" });

function registerStatusTool(name, description, status, message) {
  mcp.tool(name, description, {}, async () => {
    publish(status);
    return { content: [{ type: "text", text: message }] };
  });
}

registerStatusTool("pet_start", "Show that Kilo is reading a new task.", "reading", "Kilo Pet is reading the task.");
registerStatusTool("pet_done", "Celebrate that Kilo has finished a prompt.", "done", "Kilo Pet celebrated task completion.");
registerStatusTool("pet_interrupted", "Show that a prompt was interrupted or could not be completed.", "interrupted", "Kilo Pet marked the task as interrupted.");

mcp.tool(
  "pet_update",
  "Show a safe, generic task stage in Kilo Pet without including prompt or code content.",
  { stage: z.enum(["reading", "planning", "working", "testing"]) },
  async ({ stage }) => {
    publish(stage);
    return { content: [{ type: "text", text: `Kilo Pet status: ${labels[stage]}.` }] };
  }
);

const transport = new StdioServerTransport();
await mcp.connect(transport);