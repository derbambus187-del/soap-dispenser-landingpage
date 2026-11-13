import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
import { ensureWorkspaceRoot } from "./workspace-tools.js";

const port = Number(process.env.PORT ?? 3001);
const config = {
  apiBaseUrl: process.env.MODEL_API_BASE_URL ?? "http://127.0.0.1:11434/v1",
  apiKey: process.env.MODEL_API_KEY ?? "",
  model: process.env.MODEL_NAME ?? "phi4-mini",
  workspaceRoot: process.env.WORKSPACE_ROOT?.trim(),
};

if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error("PORT must be a valid TCP port.");
}

const appDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = await ensureWorkspaceRoot(config.workspaceRoot || path.join(appDirectory, "workspace"));
createApp({ ...config, workspaceRoot }).listen(port, "127.0.0.1", () => {
  console.log(`Local Forge API listening on http://127.0.0.1:${port}`);
  console.log(`Model: ${config.model} via ${config.apiBaseUrl}`);
  console.log(`Autonomous workspace: ${workspaceRoot}`);
});
