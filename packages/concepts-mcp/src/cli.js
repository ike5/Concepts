import { createInterface } from "node:readline/promises";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { setup, status } from "./core.js";
import { AGENTS, installCommands } from "./agents.js";
import { DEFAULT_PROJECT_DIR, defaultLibraryDir, ensureDir } from "./config.js";
import { recordSchema, checkRecord } from "./schema.js";
import { renderCommit } from "./library.js";

export const usage = `concepts-mcp: hand-drawn diagrams of the concepts in your latest commits

  npx -y concepts-mcp@latest init      Set up this repository (asks where diagrams go)
  npx -y concepts-mcp@latest status    Show where diagrams go and how many commits are waiting
  npx -y concepts-mcp@latest render <concepts.json> [out-dir]
                                       Draw a diagram from a JSON file (for trying it out)
  concepts-mcp                         With no command and no terminal, runs the MCP server

init options: --output project|library  --dir <path>  --agents claude,cursor,codex,generic
              --hook | --no-hook  --backfill <n>  --yes (accept defaults)
Docs: https://ike5.github.io/concepts/`;

function parseFlags(args) {
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!a.startsWith("--")) continue;
    const [key, inline] = a.slice(2).split("=", 2);
    if (key.startsWith("no-")) flags[key.slice(3)] = false;
    else if (inline !== undefined) flags[key] = inline;
    else if (args[i + 1] && !args[i + 1].startsWith("--")) flags[key] = args[++i];
    else flags[key] = true;
  }
  return flags;
}

async function ask(rl, question, fallback) {
  if (!rl) return fallback;
  const answer = (await rl.question(`${question} `)).trim();
  return answer || fallback;
}

async function init(flags) {
  const interactive = process.stdin.isTTY && !flags.yes;
  const rl = interactive ? createInterface({ input: process.stdin, output: process.stdout }) : null;
  try {
    let output = flags.output;
    if (!output) {
      const pick = await ask(rl, `Where should concept diagrams go?\n  1) In this project (${DEFAULT_PROJECT_DIR}/)\n  2) In your learning library (${defaultLibraryDir()}/<repo>/)\nChoose 1 or 2 [1]:`, "1");
      output = pick.startsWith("2") || pick.startsWith("l") ? "library" : "project";
    }
    if (!["project", "library"].includes(output)) throw new Error('--output must be "project" or "library".');
    const dir = flags.dir ?? (await ask(rl, `Folder [${output === "project" ? DEFAULT_PROJECT_DIR : defaultLibraryDir()}]:`, undefined));
    const agentsRaw = flags.agents ?? (await ask(rl, `Agents to set up (${AGENTS.join(",")}) [all]:`, AGENTS.join(",")));
    const agents = String(agentsRaw).split(/[\s,]+/).map((a) => a.toLowerCase()).filter(Boolean);
    const bad = agents.filter((a) => !AGENTS.includes(a));
    if (bad.length) throw new Error(`Unknown agent: ${bad.join(", ")}. Use ${AGENTS.join(", ")}.`);
    const hookAnswer = flags.hook ?? (await ask(rl, "Add a post-commit reminder hook? It never calls an AI. [y/N]:", "n"));
    const gitHook = hookAnswer === true || /^y/i.test(String(hookAnswer));
    const backfill = Number(flags.backfill ?? (await ask(rl, "Also diagram how many recent commits? [0]:", "0"))) || 0;

    const result = await setup(process.cwd(), { output, dir, agents, gitHook, backfill });
    console.log(`\n✓ Set up in ${result.root}`);
    console.log(`  Diagrams go to ${result.outputDir}`);
    console.log(`  Updated ${result.changed.join(", ")}`);
    if (result.hook) console.log(result.hook.installed ? `  Hook: ${result.hook.path}` : `  Hook skipped: ${result.hook.reason}`);
    console.log("\nAdd the MCP server to your agent (once per machine):");
    for (const cmd of installCommands(agents)) console.log(`\n  ${cmd.label}:\n  ${cmd.command.split("\n").join("\n  ")}${cmd.note && cmd.agent !== "generic" ? `\n  ${cmd.note.split("\n").join("\n  ")}` : ""}`);
    console.log("\nThen commit as usual. Your agent diagrams each new commit, or ask it to \"update my concept diagrams\".");
  } finally {
    rl?.close();
  }
}

async function render(args) {
  const [file, out = "concepts-output"] = args;
  if (!file) throw new Error("render needs a JSON file: see examples/commit.json");
  const input = recordSchema.parse(JSON.parse(await readFile(file, "utf8")));
  const problems = checkRecord(input);
  if (problems.length) throw new Error(problems.join("\n"));
  const dir = await ensureDir(resolve(out));
  const commitLine = input.commitLine ?? `\`${input.commit.slice(0, 7)}\` · example`;
  const files = await renderCommit(dir, ".", { ...input, commitLine }, { newIds: new Set(input.concepts.map((c) => c.id)) });
  console.log(`SVG:        ${files.svg}\nExcalidraw: ${files.excalidraw}`);
}

export async function main(argv) {
  const [command, ...rest] = argv;
  try {
    if (command === "init") return await init(parseFlags(rest));
    if (command === "status") {
      const s = await status(process.cwd());
      if (!s.configured) return console.log(`Not set up in ${s.root}. Run: npx -y concepts-mcp@latest init`);
      return console.log(`${s.root}\n  Output:   ${s.outputDir} (${s.output})\n  Diagrams: ${s.diagrams}\n  Concepts: ${s.concepts}\n  Waiting:  ${s.pending} commit${s.pending === 1 ? "" : "s"}`);
    }
    if (command === "render") return await render(rest);
    console.log(usage);
    if (command && !["help", "--help", "-h"].includes(command)) process.exitCode = 1;
  } catch (error) {
    console.error(`concepts-mcp: ${error.message}`);
    process.exitCode = 1;
  }
}
