import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { pending, library, record, setup, NotConfiguredError } from "./core.js";
import { AGENTS, WORKFLOW } from "./agents.js";
import { recordInput } from "./schema.js";
import { DEFAULT_PROJECT_DIR, defaultLibraryDir } from "./config.js";

export const instructions = "concepts-mcp turns a repository's recent commits into hand-drawn Excalidraw diagrams of the concepts they use, so the user can learn from code an AI wrote. After committing, or when asked to update concepts, call get_concepts_instructions once and follow it. You do the analysis; these tools read git and write the files.";

const repoPath = z.string().max(2000).optional().describe("Absolute path of the repository root. Defaults to the server's working directory.");

function reply(data, text) {
  return { content: [{ type: "text", text: text ?? JSON.stringify(data, null, 2) }], structuredContent: data };
}

function fail(error) {
  const notConfigured = error instanceof NotConfiguredError;
  return { isError: true, content: [{ type: "text", text: notConfigured ? error.message : `concepts-mcp: ${error.message}` }], structuredContent: { error: error.message, notConfigured } };
}

export function createServer(version) {
  const server = new McpServer({ name: "concepts", version }, { instructions });

  server.registerTool("get_concepts_instructions", {
    title: "Get the concept diagram workflow",
    description: "Call first. Returns the steps for turning new commits into concept diagrams.",
    inputSchema: z.object({}),
    annotations: { readOnlyHint: true },
  }, async () => reply({ workflow: WORKFLOW, version }, WORKFLOW.map((s, i) => `${i + 1}. ${s}`).join("\n")));

  server.registerTool("setup_concepts", {
    title: "Set up concept diagrams in a repository",
    description: `Configure a repository once. Ask the user first where diagrams should go: "project" keeps them in the repo (default ${DEFAULT_PROJECT_DIR}/), "library" keeps them in a learning library folder on this computer (default ${defaultLibraryDir()}/<repo>/). Writes .concepts.json, adds the workflow to AGENTS.md (and an @AGENTS.md import to CLAUDE.md for Claude Code), and optionally a post-commit reminder hook.`,
    inputSchema: z.object({
      repoPath,
      output: z.enum(["project", "library"]),
      dir: z.string().max(500).optional().describe("Folder inside the repo (project) or the library root (library). Omit for the default."),
      agents: z.array(z.enum(AGENTS)).min(1).default(AGENTS).describe("Agents to write instructions for"),
      gitHook: z.boolean().default(false).describe("Add a post-commit hook that reminds people and agents when a commit is waiting"),
      backfill: z.number().int().min(0).max(20).default(0).describe("Also diagram this many commits from before setup"),
    }),
  }, async ({ repoPath, ...options }) => {
    try {
      const result = await setup(repoPath, options);
      return reply(result, `Set up in ${result.root}. Diagrams go to ${result.outputDir}. Changed: ${result.changed.join(", ")}.${result.hook ? ` Hook: ${result.hook.installed ? result.hook.path : result.hook.reason}` : ""}`);
    } catch (error) { return fail(error); }
  });

  server.registerTool("get_unprocessed_commits", {
    title: "Get commits that need a concept diagram",
    description: "Returns commits since setup that have no diagram yet, oldest first, each with its message, changed files and a trimmed diff (lockfiles and generated files removed). Call record_commit_concepts for each one.",
    inputSchema: z.object({
      repoPath,
      limit: z.number().int().min(1).max(10).default(3).describe("How many commits to return at once"),
      maxDiffChars: z.number().int().min(2000).max(100000).default(24000).describe("Diff budget per commit"),
    }),
    annotations: { readOnlyHint: true },
  }, async ({ repoPath, limit, maxDiffChars }) => {
    try {
      const result = await pending(repoPath, { limit, maxDiffChars });
      if (!result.commits.length) return reply(result, `Nothing to diagram: every commit since setup has a diagram or was skipped.${result.note ? ` ${result.note}` : ""}`);
      return reply(result);
    } catch (error) { return fail(error); }
  });

  server.registerTool("get_concept_library", {
    title: "List concepts already in the library",
    description: "Returns every concept recorded for this repository (id, name, kind, level, times seen). Reuse these ids so a concept's note keeps growing instead of being duplicated.",
    inputSchema: z.object({ repoPath }),
    annotations: { readOnlyHint: true },
  }, async ({ repoPath }) => {
    try { return reply(await library(repoPath)); } catch (error) { return fail(error); }
  });

  server.registerTool("record_commit_concepts", {
    title: "Draw a commit's concept diagram",
    description: "Save one commit as system-design diagrams. Views (architecture, sequence, flow, state, data-model) are laid out and drawn for you in Excalidraw style; each concept becomes a numbered marker on the parts where it lives, with names in a key beside the diagram. Writes concepts.excalidraw, a concepts.svg preview and a README, updates one Markdown note per concept, and marks the commit done. Pass skipReason instead for commits with nothing to learn.",
    inputSchema: z.object(recordInput),
  }, async (input) => {
    try {
      const result = await record(input);
      if (result.skipped) return reply(result, `Skipped ${result.commit}.`);
      const tail = result.insideRepo ? " These files are inside the repo: commit them on their own (e.g. `docs(concepts): <sha>`); that commit is skipped automatically." : "";
      return reply(result, `Diagram for ${result.commit}: ${result.svg}\nEditable: ${result.excalidraw}\nNew concepts: ${result.newConcepts.length ? result.newConcepts.join(", ") : "none"}.${tail}`);
    } catch (error) { return fail(error); }
  });

  return server;
}
