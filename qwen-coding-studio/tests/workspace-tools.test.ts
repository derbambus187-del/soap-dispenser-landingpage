import { link, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  executeWorkspaceTool,
  ensureWorkspaceRoot,
  resolveAllowedWebsite,
  resolveWorkspaceRoot,
} from "../server/workspace-tools.js";

let root = "";
let outsideFile = "";

afterEach(async () => {
  if (outsideFile) {
    await rm(outsideFile, { force: true });
    outsideFile = "";
  }
  if (root) {
    await rm(root, { recursive: true, force: true });
    root = "";
  }
});

async function createWorkspace(): Promise<string> {
  root = await mkdtemp(path.join(os.tmpdir(), "qwen-forge-"));
  return root;
}

describe("workspace tools", () => {
  it("reads and creates files inside the configured project only", async () => {
    const workspace = await createWorkspace();
    await mkdir(path.join(workspace, "src"));
    const written = await executeWorkspaceTool(workspace, "write_file", {
      path: "src/example.ts",
      content: "export const answer = 42;",
    });

    expect(written.ok).toBe(true);
    expect(await readFile(path.join(workspace, "src/example.ts"), "utf8")).toContain("42");

    const read = await executeWorkspaceTool(workspace, "read_file", { path: "src/example.ts" });
    expect(read).toMatchObject({ ok: true, action: { tool: "read_file" } });
  });

  it("applies an exact edit once and refuses ambiguous replacements", async () => {
    const workspace = await createWorkspace();
    const sourcePath = path.join(workspace, "source.ts");
    await writeFile(sourcePath, "const value = 1;\nconst value2 = value + 1;\n");

    const edit = await executeWorkspaceTool(workspace, "edit_file", {
      path: "source.ts",
      oldText: "const value = 1;",
      newText: "const value = 2;",
    });
    const ambiguous = await executeWorkspaceTool(workspace, "edit_file", {
      path: "source.ts",
      oldText: "value",
      newText: "changed",
    });

    expect(edit.ok).toBe(true);
    expect(ambiguous.ok).toBe(false);
    expect(await readFile(sourcePath, "utf8")).toBe("const value = 2;\nconst value2 = value + 1;\n");
  });

  it("creates nested project folders without following symlinks", async () => {
    const workspace = await createWorkspace();
    const created = await executeWorkspaceTool(workspace, "create_directory", { path: "src/components" });
    const duplicate = await executeWorkspaceTool(workspace, "create_directory", { path: "src/components" });

    expect(created.ok).toBe(true);
    expect(duplicate.ok).toBe(false);
  });

  it("blocks traversal, secrets, ignored folders, and symlinks", async () => {
    const workspace = await createWorkspace();
    outsideFile = path.join(path.dirname(workspace), `${path.basename(workspace)}-outside.txt`);
    await writeFile(outsideFile, "private");
    await symlink(outsideFile, path.join(workspace, "linked.txt"));
    await link(outsideFile, path.join(workspace, "hard-linked.txt"));
    await mkdir(path.join(workspace, "node_modules"));
    await writeFile(path.join(workspace, "node_modules", "package.js"), "ignored");
    await writeFile(path.join(workspace, ".env"), "private");

    const traversal = await executeWorkspaceTool(workspace, "read_file", { path: "../outside.txt" });
    const secret = await executeWorkspaceTool(workspace, "read_file", { path: ".env" });
    const linked = await executeWorkspaceTool(workspace, "read_file", { path: "linked.txt" });
    const hardLink = await executeWorkspaceTool(workspace, "read_file", { path: "hard-linked.txt" });
    const list = await executeWorkspaceTool(workspace, "list_files", { path: "" });

    expect(traversal.ok).toBe(false);
    expect(secret.ok).toBe(false);
    expect(linked.ok).toBe(false);
    expect(hardLink.ok).toBe(false);
    expect(list.output).not.toContain("node_modules");
    expect(list.output).not.toContain(".env");
  });

  it("resolves an empty workspace configuration as disabled", async () => {
    expect(await resolveWorkspaceRoot("")).toBeUndefined();
  });

  it("creates and resolves a workspace root", async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "qwen-forge-auto-"));
    const workspacePath = path.join(root, "workspace");

    const workspace = await ensureWorkspaceRoot(workspacePath);

    expect(workspace).toBe(workspacePath);
    expect(await resolveWorkspaceRoot(workspace)).toBe(workspace);
  });

  it("allows explicit YouTube and Discord links but rejects other destinations", async () => {
    expect(resolveAllowedWebsite("https://www.youtube.com/")).toBe("https://www.youtube.com/");
    expect(resolveAllowedWebsite("https://discord.com/channels/123/456"))
      .toBe("https://discord.com/channels/123/456");
    expect(() => resolveAllowedWebsite("https://example.com/")).toThrow(/YouTube oder Discord/);
    expect(() => resolveAllowedWebsite("javascript:alert(1)")).toThrow(/HTTPS/);
    expect(() => resolveAllowedWebsite("https://discord.com/settings")).toThrow(/App-, Channel-/);
  });

  it("returns an explicit browser action for an allowed website request", async () => {
    const workspace = await createWorkspace();
    const action = await executeWorkspaceTool(workspace, "open_website", {
      url: "https://discord.com/channels/123/456",
    });

    expect(action).toMatchObject({
      ok: true,
      action: {
        tool: "open_website",
        phase: "external",
        url: "https://discord.com/channels/123/456",
      },
    });
  });

  it("does not pass the model API key to project check scripts", async () => {
    const workspace = await createWorkspace();
    const previousKey = process.env.MODEL_API_KEY;
    process.env.MODEL_API_KEY = "server-secret";
    await writeFile(
      path.join(workspace, "package.json"),
      JSON.stringify({ scripts: { test: "node test.js" } }),
    );
    await writeFile(path.join(workspace, "test.js"), "process.exit(process.env.MODEL_API_KEY ? 1 : 0);\n");

    try {
      const result = await executeWorkspaceTool(workspace, "run_checks", { check: "test" });
      expect(result.ok).toBe(true);
    } finally {
      if (previousKey === undefined) {
        delete process.env.MODEL_API_KEY;
      } else {
        process.env.MODEL_API_KEY = previousKey;
      }
    }
  });
});
