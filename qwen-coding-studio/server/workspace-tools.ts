import { spawn } from "node:child_process";
import {
  mkdir,
  lstat,
  open,
  readFile,
  readdir,
  realpath,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import type { ModelTool } from "./model-provider.js";

const MAX_FILE_BYTES = 128 * 1024;
const MAX_LISTED_FILES = 150;
const MAX_CHECK_RUNTIME_MS = 120_000;
const IGNORED_DIRECTORIES = new Set([".git", "node_modules", "dist", "build", "coverage", ".next", "bin", "obj"]);
const SECRET_FILE = /(^|\/)\.env(?:\.|$)|(^|\/)\.ssh(?:\/|$)|(^|\/)id_(?:rsa|ed25519)(?:$|\.)|\.(?:pem|key|p12|pfx)$/i;

export type WorkspaceAction = {
  tool: string;
  summary: string;
  phase: "inspect" | "edit" | "check" | "external";
  url?: string;
};

export type WorkspaceToolResult = {
  ok: boolean;
  output: string;
  action?: WorkspaceAction;
};

type ToolArguments = Record<string, unknown>;

export const workspaceModelTools: ModelTool[] = [
  {
    type: "function",
    function: {
      name: "list_files",
      description: "List project files under the configured workspace. Use this before reading or editing files.",
      parameters: {
        type: "object",
        properties: { path: { type: "string", description: "Optional relative directory, defaults to workspace root." } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read a UTF-8 project file by its workspace-relative path (up to 128 KB).",
      parameters: {
        type: "object",
        properties: { path: { type: "string", description: "Workspace-relative file path." } },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description: "Create a new UTF-8 project file inside the workspace. It will not overwrite an existing file.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Workspace-relative file path." },
          content: { type: "string", description: "Complete file content." },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "edit_file",
      description: "Replace one exact, unique text section in an existing UTF-8 project file. Read the file first.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Workspace-relative file path." },
          oldText: { type: "string", description: "Exact current text to replace; must match exactly once." },
          newText: { type: "string", description: "Replacement text." },
        },
        required: ["path", "oldText", "newText"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_directory",
      description: "Create a directory and any missing parent directories inside the configured workspace.",
      parameters: {
        type: "object",
        properties: { path: { type: "string", description: "Workspace-relative directory path." } },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_checks",
      description: "Run only a predefined project test, lint, type-check, or build script. No arbitrary shell commands are supported.",
      parameters: {
        type: "object",
        properties: { check: { type: "string", enum: ["test", "lint", "typecheck", "build"] } },
        required: ["check"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "open_website",
      description: "Open YouTube or Discord in the user's browser, or navigate to a channel link the user supplied. Use only when the user explicitly asks to open it.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "An HTTPS URL on youtube.com, youtu.be, discord.com, or discord.gg." },
        },
        required: ["url"],
      },
    },
  },
];

export function resolveAllowedWebsite(value: unknown): string {
  if (typeof value !== "string" || value.length > 2_000) {
    throw new Error("Bitte gib einen gültigen YouTube- oder Discord-Link an.");
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Der Link ist ungültig. Erlaubt sind sichere YouTube- oder Discord-Links.");
  }

  const allowedHosts = new Set([
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "youtu.be",
    "discord.com",
    "www.discord.com",
    "discord.gg",
  ]);
  if (
    url.protocol !== "https:" ||
    !allowedHosts.has(url.hostname.toLowerCase()) ||
    url.username ||
    url.password ||
    url.port
  ) {
    throw new Error("Erlaubt sind nur sichere HTTPS-Links zu YouTube oder Discord.");
  }
  if (
    url.hostname.toLowerCase().endsWith("discord.com") &&
    !/^\/(?:app|channels(?:\/|$)|invite\/)/.test(url.pathname)
  ) {
    throw new Error("Bei Discord sind nur App-, Channel- und Invite-Links erlaubt.");
  }
  if (
    url.hostname.toLowerCase() === "discord.gg" &&
    !/^\/[A-Za-z0-9-]+\/?$/.test(url.pathname)
  ) {
    throw new Error("Der Discord-Einladungslink ist ungültig.");
  }

  return url.href;
}

export async function resolveWorkspaceRoot(workspaceRoot: string | undefined): Promise<string | undefined> {
  if (!workspaceRoot?.trim()) {
    return undefined;
  }

  const resolved = await realpath(path.resolve(workspaceRoot));
  const info = await stat(resolved);
  if (!info.isDirectory()) {
    throw new Error("WORKSPACE_ROOT muss auf einen existierenden Projektordner zeigen.");
  }

  return resolved;
}

export async function ensureWorkspaceRoot(workspaceRoot: string): Promise<string> {
  const resolvedPath = path.resolve(workspaceRoot);
  await mkdir(resolvedPath, { recursive: true });
  const info = await lstat(resolvedPath);
  if (!info.isDirectory() || info.isSymbolicLink()) {
    throw new Error("Der automatische Workspace muss ein echtes Verzeichnis sein.");
  }

  return realpath(resolvedPath);
}

export async function executeWorkspaceTool(
  workspaceRoot: string,
  name: string,
  args: ToolArguments,
): Promise<WorkspaceToolResult> {
  try {
    switch (name) {
      case "list_files":
        return await listFiles(workspaceRoot, args.path);
      case "read_file":
        return await readWorkspaceFile(workspaceRoot, args.path);
      case "write_file":
        return await writeWorkspaceFile(workspaceRoot, args.path, args.content);
      case "edit_file":
        return await editWorkspaceFile(workspaceRoot, args.path, args.oldText, args.newText);
      case "create_directory":
        return await createWorkspaceDirectory(workspaceRoot, args.path);
      case "run_checks":
        return await runCheck(workspaceRoot, args.check);
      case "open_website":
        return openWebsite(args.url);
      default:
        return { ok: false, output: `Unbekanntes Tool: ${name}` };
    }
  } catch (error) {
    return {
      ok: false,
      output: error instanceof Error ? error.message : "Die Aktion ist fehlgeschlagen.",
    };
  }
}

function openWebsite(value: unknown): WorkspaceToolResult {
  const url = resolveAllowedWebsite(value);
  const host = new URL(url).hostname;
  return {
    ok: true,
    output: `Browseraktion bereit: ${url}`,
    action: {
      tool: "open_website",
      summary: `${host} im Browser geöffnet`,
      phase: "external",
      url,
    },
  };
}

async function safePath(root: string, value: unknown, allowRoot = false): Promise<string> {
  if (typeof value !== "string" || (!allowRoot && !value.trim())) {
    throw new Error("Bitte gib einen relativen Pfad im Projektordner an.");
  }

  const relative = value.trim().replaceAll("\\", "/");
  if (
    path.isAbsolute(relative) ||
    relative.split("/").includes("..") ||
    SECRET_FILE.test(relative) ||
    relative.split("/").some((part) => IGNORED_DIRECTORIES.has(part))
  ) {
    throw new Error("Dieser Pfad ist nicht innerhalb des freigegebenen Projektbereichs erlaubt.");
  }

  const candidate = path.resolve(root, relative || ".");
  const rootRelative = path.relative(root, candidate);
  if (rootRelative === ".." || rootRelative.startsWith(`..${path.sep}`) || path.isAbsolute(rootRelative)) {
    throw new Error("Der Pfad liegt außerhalb des freigegebenen Projektordners.");
  }

  let current = root;
  for (const part of rootRelative.split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    const info = await lstatIfExists(current);
    if (info?.isSymbolicLink()) {
      throw new Error("Symlinks sind im Agenten-Arbeitsbereich nicht erlaubt.");
    }
    if (info) {
      ensureInside(root, await realpath(current));
    }
  }

  return candidate;
}

async function listFiles(root: string, directory: unknown): Promise<WorkspaceToolResult> {
  const target = await safePath(root, directory ?? "", true);
  const targetRealPath = await realpath(target);
  ensureInside(root, targetRealPath);

  const files: string[] = [];
  async function visit(current: string, depth: number): Promise<void> {
    if (files.length >= MAX_LISTED_FILES || depth > 4) {
      return;
    }

    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      if (files.length >= MAX_LISTED_FILES) {
        break;
      }

      const relative = path.relative(root, path.join(current, entry.name)).replaceAll(path.sep, "/");
      if (entry.isSymbolicLink() || SECRET_FILE.test(relative) || IGNORED_DIRECTORIES.has(entry.name)) {
        continue;
      }
      if (entry.isDirectory()) {
        await visit(path.join(current, entry.name), depth + 1);
      } else if (entry.isFile()) {
        files.push(relative);
      }
    }
  }
  await visit(targetRealPath, 0);

  return {
    ok: true,
    output: files.join("\n") || "(Keine Projektdateien gefunden.)",
    action: { tool: "list_files", summary: `${files.length} Projektdateien aufgelistet`, phase: "inspect" },
  };
}

async function readWorkspaceFile(root: string, value: unknown): Promise<WorkspaceToolResult> {
  const target = await safePath(root, value);
  const info = await lstat(target);
  if (!info.isFile() || info.isSymbolicLink() || info.nlink > 1) {
    throw new Error("Nur reguläre Dateien im freigegebenen Projektordner können gelesen werden.");
  }
  ensureInside(root, await realpath(target));
  if (info.size > MAX_FILE_BYTES) {
    throw new Error("Die Datei ist größer als das Leselimit von 128 KB.");
  }

  const content = await readFile(target, "utf8");
  if (content.includes("\u0000")) {
    throw new Error("Binärdateien können nicht gelesen werden.");
  }

  return {
    ok: true,
    output: content,
    action: { tool: "read_file", summary: `${path.relative(root, target)} gelesen`, phase: "inspect" },
  };
}

async function writeWorkspaceFile(root: string, value: unknown, contentValue: unknown): Promise<WorkspaceToolResult> {
  const target = await safePath(root, value);
  if (typeof contentValue !== "string" || Buffer.byteLength(contentValue, "utf8") > MAX_FILE_BYTES) {
    throw new Error("Der Dateiinhalt muss Text sein und darf höchstens 128 KB umfassen.");
  }

  const parent = await lstatIfExists(path.dirname(target));
  if (!parent?.isDirectory() || parent.isSymbolicLink()) {
    throw new Error("Der Zielordner existiert nicht. Lege ihn zuerst mit create_directory an.");
  }
  ensureInside(root, await realpath(path.dirname(target)));
  const targetInfo = await lstatIfExists(target);
  if (targetInfo) {
    throw new Error("Die Datei existiert bereits. Verwende edit_file, nachdem du sie gelesen hast.");
  }

  await writeFile(target, contentValue, { encoding: "utf8", flag: "wx" });
  return {
    ok: true,
    output: `Datei gespeichert: ${path.relative(root, target)}`,
    action: { tool: "write_file", summary: `${path.relative(root, target)} angelegt`, phase: "edit" },
  };
}

async function editWorkspaceFile(
  root: string,
  value: unknown,
  oldTextValue: unknown,
  newTextValue: unknown,
): Promise<WorkspaceToolResult> {
  const target = await safePath(root, value);
  const info = await lstat(target);
  if (!info.isFile() || info.isSymbolicLink() || info.nlink > 1) {
    throw new Error("Nur reguläre Dateien im freigegebenen Projektordner können geändert werden.");
  }
  if (info.size > MAX_FILE_BYTES) {
    throw new Error("Die Datei ist größer als das Bearbeitungslimit von 128 KB.");
  }
  ensureInside(root, await realpath(target));

  if (typeof oldTextValue !== "string" || !oldTextValue || typeof newTextValue !== "string") {
    throw new Error("oldText muss ein nicht-leerer Text und newText ein Text sein.");
  }
  const newSize = Buffer.byteLength(newTextValue, "utf8");
  if (newSize > MAX_FILE_BYTES) {
    throw new Error("Der neue Dateiinhalt darf höchstens 128 KB umfassen.");
  }

  const current = await readFile(target, "utf8");
  const firstMatch = current.indexOf(oldTextValue);
  if (firstMatch < 0) {
    throw new Error("Der zu ersetzende Text wurde nicht gefunden. Lies die aktuelle Datei erneut.");
  }
  if (current.indexOf(oldTextValue, firstMatch + oldTextValue.length) >= 0) {
    throw new Error("Der zu ersetzende Text ist nicht eindeutig. Wähle einen größeren, eindeutigen Ausschnitt.");
  }

  const updated = current.slice(0, firstMatch) + newTextValue + current.slice(firstMatch + oldTextValue.length);
  if (Buffer.byteLength(updated, "utf8") > MAX_FILE_BYTES) {
    throw new Error("Die bearbeitete Datei darf höchstens 128 KB umfassen.");
  }

  const file = await open(target, "r+");
  try {
    await file.writeFile(updated, { encoding: "utf8" });
    await file.truncate(Buffer.byteLength(updated, "utf8"));
  } finally {
    await file.close();
  }
  return {
    ok: true,
    output: `Datei gezielt geändert: ${path.relative(root, target)}`,
    action: { tool: "edit_file", summary: `${path.relative(root, target)} gezielt geändert`, phase: "edit" },
  };
}

async function createWorkspaceDirectory(root: string, value: unknown): Promise<WorkspaceToolResult> {
  const target = await safePath(root, value);
  if (target === root) {
    throw new Error("Der Projektstamm existiert bereits.");
  }

  const existing = await lstatIfExists(target);
  if (existing) {
    if (existing.isDirectory()) {
      throw new Error("Der Ordner existiert bereits.");
    }
    throw new Error("Am Zielpfad existiert bereits eine Datei.");
  }

  await mkdir(target, { recursive: true });
  ensureInside(root, await realpath(target));
  const relativePath = path.relative(root, target);
  return {
    ok: true,
    output: `Ordner angelegt: ${relativePath}`,
    action: { tool: "create_directory", summary: `${relativePath}/ angelegt`, phase: "edit" },
  };
}

async function lstatIfExists(target: string) {
  try {
    return await lstat(target);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

async function runCheck(root: string, check: unknown): Promise<WorkspaceToolResult> {
  if (check !== "test" && check !== "lint" && check !== "typecheck" && check !== "build") {
    throw new Error("Erlaubt sind nur test, lint, typecheck und build.");
  }

  const packagePath = path.join(root, "package.json");
  const csproj = await findProjectFile(root, [".csproj", ".sln", ".slnx"]);
  const packageInfo = await lstatIfExists(packagePath);
  let command: string;
  let args: string[];
  let summary: string;

  if (packageInfo?.isFile()) {
    const packageJson = JSON.parse(await readFile(packagePath, "utf8")) as {
      scripts?: Record<string, string>;
    };
    if (packageJson.scripts?.[check]) {
      command = "npm";
      args = check === "test" ? ["test"] : ["run", check];
      summary = check === "test" ? "npm test" : `npm run ${check}`;
    } else if (check === "typecheck" && packageJson.scripts?.["type-check"]) {
      command = "npm";
      args = ["run", "type-check"];
      summary = "npm run type-check";
    } else {
      throw new Error(`Im package.json ist kein passendes ${check}-Skript definiert.`);
    }
  } else if (csproj && (check === "test" || check === "build")) {
    command = "dotnet";
    args = [check];
    summary = `dotnet ${check}`;
  } else {
    throw new Error("Kein passendes Prüfsystem oder Skript für dieses Projekt gefunden.");
  }

  const result = await runProcess(command, args, root);
  const output = `${result.output}\nExit-Code: ${result.exitCode}${result.timedOut ? "\nZeitlimit erreicht." : ""}`;
  return {
    ok: result.exitCode === 0 && !result.timedOut,
    output,
    action: {
      tool: "run_checks",
      summary: `${summary}: ${result.exitCode === 0 ? "erfolgreich" : "fehlgeschlagen"}`,
      phase: "check",
    },
  };
}

async function findProjectFile(root: string, extensions: string[]): Promise<string | undefined> {
  const entries = await readdir(root, { withFileTypes: true });
  return entries.find((entry) => entry.isFile() && extensions.some((extension) => entry.name.endsWith(extension)))?.name;
}

function runProcess(command: string, args: string[], cwd: string): Promise<{
  exitCode: number;
  output: string;
  timedOut: boolean;
}> {
  return new Promise((resolve, reject) => {
    const env: NodeJS.ProcessEnv = { CI: "1" };
    for (const key of [
      "PATH",
      "Path",
      "PATHEXT",
      "SYSTEMROOT",
      "WINDIR",
      "COMSPEC",
      "HOME",
      "USERPROFILE",
      "TMP",
      "TEMP",
      "TMPDIR",
      "DOTNET_ROOT",
      "NUGET_PACKAGES",
    ]) {
      if (process.env[key] !== undefined) {
        env[key] = process.env[key];
      }
    }

    const child = spawn(command, args, {
      cwd,
      shell: process.platform === "win32" && command === "npm",
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    let timedOut = false;
    const append = (chunk: Buffer) => {
      output = `${output}${chunk.toString("utf8")}`.slice(-12_000);
    };
    child.stdout.on("data", append);
    child.stderr.on("data", append);
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, MAX_CHECK_RUNTIME_MS);
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(new Error(`Prüfung konnte nicht gestartet werden: ${error.message}`));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ exitCode: code ?? 1, output: output || "(Keine Konsolenausgabe.)", timedOut });
    });
  });
}

function ensureInside(root: string, target: string): void {
  const relative = path.relative(root, target);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error("Der aufgelöste Pfad liegt außerhalb des freigegebenen Projektordners.");
  }
}
