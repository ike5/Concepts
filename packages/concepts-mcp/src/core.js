import { dirname, resolve } from "node:path";
import { CONFIG_FILE, DEFAULT_PROJECT_DIR, contractHome, defaultLibraryDir, ensureDir, expandHome, outputDir, outputDirInRepo, readConfig, writeConfig } from "./config.js";
import { changedFiles, commitDiff, commitMeta, commitsSince, git, headSha, isAncestor, repoName, repoRoot } from "./git.js";
import { readState, writeState } from "./state.js";
import { AGENTS, installCommands, installHook, writeAgentFiles } from "./agents.js";
import { commitFolder, renderCommit, writeIndex, writeLibraryIndex, writeNote } from "./library.js";
import { checkRecord } from "./schema.js";

export class NotConfiguredError extends Error {}

async function load(repoPath) {
  const root = await repoRoot(resolve(repoPath || process.cwd()));
  const config = await readConfig(root);
  if (!config) {
    throw new NotConfiguredError(`concepts-mcp isn't set up in ${root}. Ask the user whether to keep diagrams in this project (${DEFAULT_PROJECT_DIR}/) or in their learning library (${defaultLibraryDir()}/), then call setup_concepts.`);
  }
  const dir = await outputDir(root, config);
  return { root, config, dir, state: await readState(dir) };
}

/** Commits that change nothing but concept output or agent setup aren't worth a diagram. */
function onlySetupFiles(files, outRel) {
  const setup = new Set([CONFIG_FILE, "AGENTS.md", "CLAUDE.md"]);
  return files.length > 0 && files.every((f) => setup.has(f.path) || (outRel && (f.path === outRel || f.path.startsWith(`${outRel}/`))));
}

export async function setup(repoPath, { output = "project", dir, agents = AGENTS, gitHook = false, backfill = 0 } = {}) {
  const root = await repoRoot(resolve(repoPath || process.cwd()));
  if (!["project", "library"].includes(output)) throw new Error('output must be "project" or "library".');
  const chosen = output === "project" ? (dir || DEFAULT_PROJECT_DIR).replace(/^\.\/+/, "").replace(/\/+$/, "") : contractHome(resolve(expandHome(dir || defaultLibraryDir())));
  const previous = await readConfig(root).catch(() => null);
  const head = await headSha(root);

  // Start after HEAD (or `backfill` commits before it), so setting up doesn't diagram the whole history.
  let baseline = previous?.baseline ?? "start";
  if (!previous) {
    if (head) {
      const back = Math.max(0, Math.min(50, backfill));
      const target = (await git(root, ["rev-parse", "--verify", "-q", `HEAD~${back}`], { allowFail: true }))?.trim();
      baseline = target || "start";
    }
  }
  const config = { version: 1, output, dir: chosen, baseline };
  if (output === "library") config.repoName = previous?.repoName || (await repoName(root));
  await writeConfig(root, config);
  const out = await ensureDir(await outputDir(root, config));

  const changed = [CONFIG_FILE, ...(await writeAgentFiles(root, agents))];
  const hook = gitHook ? await installHook(root) : null;
  const state = await readState(out);
  await writeState(out, state);
  await writeIndex(out, state, config.repoName || (await repoName(root)));
  if (output === "library") await writeLibraryIndex(dirname(out));
  return { root, outputDir: out, config, changed, hook, install: installCommands(agents) };
}

export async function pending(repoPath, { limit = 3, maxDiffChars = 24000 } = {}) {
  const { root, config, dir, state } = await load(repoPath);
  const outRel = outputDirInRepo(root, dir);
  let baseline = config.baseline === "start" ? null : config.baseline;
  let note = null;
  if (baseline && !(await isAncestor(root, baseline))) {
    note = "The setup baseline commit is no longer in this branch's history (rebase or branch switch), so only recent commits are listed.";
    baseline = null;
  }
  const cap = config.baseline === "start" ? 200 : undefined;
  const shas = (await commitsSince(root, baseline, cap)).filter((sha) => !state.commits[sha]);

  const commits = [];
  let autoSkipped = 0;
  const remaining = [];
  for (const sha of shas) {
    // Check every commit for auto-skip (cheap), so counts are right even when only a few diffs are returned.
    const files = await changedFiles(root, sha);
    if (onlySetupFiles(files, outRel)) {
      const meta = await commitMeta(root, sha);
      state.commits[sha] = { shortSha: meta.shortSha, date: meta.date, subject: meta.subject, skipped: "Only concept output or agent setup files changed" };
      autoSkipped++;
      continue;
    }
    if (commits.length >= limit) { remaining.push(sha); continue; }
    const meta = await commitMeta(root, sha);
    const { diff, truncated, omitted } = await commitDiff(root, sha, { maxChars: maxDiffChars, excludeDirs: outRel ? [outRel] : [] });
    commits.push({ ...meta, files, diff, truncatedFiles: truncated, omittedFiles: omitted });
  }
  if (autoSkipped) await writeState(dir, state);
  return { repoRoot: root, outputDir: dir, pendingTotal: commits.length + remaining.length, returned: commits.length, autoSkipped, note, commits };
}

export async function library(repoPath) {
  const { root, dir, state } = await load(repoPath);
  const concepts = Object.entries(state.concepts).map(([id, c]) => ({ id, name: c.name, kind: c.kind, level: c.level, seen: c.sightings.length }));
  return { repoRoot: root, outputDir: dir, diagrams: Object.values(state.commits).filter((c) => c.folder).length, concepts };
}

export async function record(input) {
  const problems = checkRecord(input);
  if (problems.length) throw new Error(problems.join("\n"));
  const { root, config, dir, state } = await load(input.repoPath);
  const sha = (await git(root, ["rev-parse", "--verify", "-q", `${input.commit}^{commit}`], { allowFail: true }))?.trim();
  if (!sha) throw new Error(`Commit ${input.commit} isn't in ${root}.`);
  const meta = await commitMeta(root, sha);

  if (input.skipReason) {
    state.commits[sha] = { shortSha: meta.shortSha, date: meta.date, subject: meta.subject, skipped: input.skipReason };
    await writeState(dir, state);
    await writeIndex(dir, state, config.repoName || (await repoName(root)));
    return { commit: meta.shortSha, skipped: true, outputDir: dir };
  }

  // Re-recording a commit replaces its earlier sightings instead of counting them twice.
  const previous = state.commits[sha];
  if (previous?.concepts) {
    for (const id of previous.concepts) {
      const c = state.concepts[id];
      if (!c) continue;
      c.sightings = c.sightings.filter((s) => s.sha !== sha);
      if (!c.sightings.length) delete state.concepts[id];
    }
  }
  const newIds = new Set(input.concepts.filter((c) => !state.concepts[c.id]).map((c) => c.id));
  const folder = previous?.folder || commitFolder(meta, input.title);
  const commitLine = `\`${meta.shortSha}\` · ${meta.date.slice(0, 10)} · ${meta.subject}`;
  const files = await renderCommit(dir, folder, { ...input, commit: sha, commitLine }, { newIds });

  for (const c of input.concepts) {
    const entry = state.concepts[c.id] ?? { name: c.name, kind: c.kind, level: c.level, explanation: c.explanation, prerequisites: [], learnMore: [], sightings: [] };
    entry.prerequisites = [...new Set([...entry.prerequisites, ...c.prerequisites])].slice(0, 8);
    const urls = new Set(entry.learnMore.map((l) => l.url));
    entry.learnMore = [...entry.learnMore, ...c.learnMore.filter((l) => !urls.has(l.url))].slice(0, 6);
    entry.sightings.push({ sha, shortSha: meta.shortSha, date: meta.date, title: input.title, folder, whyHere: c.whyHere, files: c.files });
    entry.sightings.sort((a, b) => String(a.date).localeCompare(String(b.date)));
    state.concepts[c.id] = entry;
  }
  state.commits[sha] = { shortSha: meta.shortSha, date: meta.date, subject: meta.subject, title: input.title, folder, concepts: input.concepts.map((c) => c.id) };
  await writeState(dir, state);
  for (const c of input.concepts) await writeNote(dir, c.id, state.concepts[c.id]);
  await writeIndex(dir, state, config.repoName || (await repoName(root)));
  if (config.output === "library") await writeLibraryIndex(dirname(dir));
  return {
    commit: meta.shortSha, outputDir: dir, folder: files.folder, svg: files.svg, excalidraw: files.excalidraw, readme: files.readme,
    newConcepts: [...newIds], insideRepo: Boolean(outputDirInRepo(root, dir)),
  };
}

export async function status(repoPath) {
  const root = await repoRoot(resolve(repoPath || process.cwd()));
  const config = await readConfig(root);
  if (!config) return { root, configured: false };
  const info = await pending(root, { limit: 0 });
  const lib = await library(root);
  return { root, configured: true, output: config.output, outputDir: info.outputDir, pending: info.pendingTotal, diagrams: lib.diagrams, concepts: lib.concepts.length };
}
