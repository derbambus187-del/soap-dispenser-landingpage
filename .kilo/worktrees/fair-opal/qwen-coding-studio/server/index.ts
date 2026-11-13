import "dotenv/config";
import { createApp } from "./app.js";
import { resolveWorkspaceRoot } from "./workspace-tools.js";

const port = Number(process.env.PORT ?? 3001);
const config = {
  apiBaseUrl: process.env.MODEL_API_BASE_URL ?? "https://api.x.ai/v1",
  apiKey: process.env.MODEL_API_KEY ?? "",
  model: process.env.MODEL_NAME ?? "grok-4-1-fast",
  workspaceRoot: process.env.WORKSPACE_ROOT,
};

if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error("PORT must be a valid TCP port.");
}

const workspaceRoot = await resolveWorkspaceRoot(config.workspaceRoot);
createApp({ ...config, workspaceRoot }).listen(port, "127.0.0.1", () => {
  console.log(`Local Forge API listening on http://127.0.0.1:${port}`);
  console.log(`Model: ${config.model} via ${config.apiBaseUrl}`);
  console.log(workspaceRoot ? `Autonomous workspace: ${workspaceRoot}` : "Autonomous workspace is not configured.");
});
