import { readFile, readdir, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { ensureDir } from "./config.js";
import { readState } from "./state.js";
import { buildScene } from "./scene.js";
import { toExcalidraw } from "./excalidraw.js";
import { toSvg } from "./svg.js";

const KEEP = "<!-- Your own notes below this line are kept when this file is regenerated. -->";

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "commit";
const day = (iso) => String(iso).slice(0, 10);
const posix = (p) => p.split(sep).join("/");
const md = (s) => String(s).replace(/([\\`*_[\]<>|])/g, "\\$1");
const fileRef = (f) => `\`${f.path.replace(/`/g, "")}${f.lines ? `:${f.lines.replace(/`/g, "")}` : ""}\``;

async function readOptional(path) {
  try { return await readFile(path, "utf8"); } catch (error) { if (error.code === "ENOENT") return null; throw error; }
}

export function commitFolder(meta, title) {
  return posix(join("commits", `${day(meta.date)}-${meta.shortSha}-${slug(title)}`));
}

/** Names of the diagram parts a concept is attached to, for the README ("where to look"). */
function partNames(views) {
  const names = new Map();
  for (const v of views) {
    if (v.type === "sequence") {
      for (const p of v.participants) names.set(p.id, p.label);
      for (const m of v.messages) if (m.id) names.set(m.id, `"${m.label}"`);
    } else {
      for (const g of v.groups) names.set(g.id, g.label);
      for (const n of v.nodes) names.set(n.id, n.label);
      const label = new Map(v.nodes.map((n) => [n.id, n.label]));
      for (const e of v.edges) if (e.id) names.set(e.id, e.label ? `"${e.label}"` : `${label.get(e.from)} → ${label.get(e.to)}`);
    }
  }
  return names;
}

/** Render one commit's diagram files into `dir/<folder>`. Returns the written paths. */
export async function renderCommit(dir, folder, record, { newIds }) {
  const abs = join(dir, folder);
  await ensureDir(abs);
  const noteLink = (c) => posix(relative(abs, join(dir, "notes", `${c.id}.md`)));
  const scene = buildScene(record, { newIds, noteLink });
  const excalidraw = join(abs, "concepts.excalidraw");
  const svg = join(abs, "concepts.svg");
  const readme = join(abs, "README.md");
  await writeFile(excalidraw, `${JSON.stringify(toExcalidraw(scene), null, 2)}\n`);
  await writeFile(svg, toSvg(scene));
  const names = partNames(record.views);
  const lines = [
    `# ${md(record.title)}`, "", `${record.commitLine}`, "", md(record.summary), "",
    "![Concept diagram](concepts.svg)", "",
    `_Views: ${record.views.map((v) => `${md(v.title)} (${v.type.replace("-", " ")})`).join(" · ")}. Numbered markers on the diagram match the concepts below. Edit it by opening \`concepts.excalidraw\` in [excalidraw.com](https://excalidraw.com), Obsidian, or the VS Code Excalidraw extension._`, "",
    "## Concepts", "",
  ];
  record.concepts.forEach((c, i) => {
    lines.push(`### ${i + 1}. [${md(c.name)}](${noteLink(c)})${newIds.has(c.id) ? " ✦ new" : ""}`, "", `_${c.kind.replace(/-/g, " ")} · ${c.level}_`, "", md(c.explanation), "", `**Why here:** ${md(c.whyHere)}`, "");
    if (c.appearsIn.length) lines.push(`**On the diagram:** ${c.appearsIn.map((r) => md(names.get(r) ?? r)).join(", ")}`, "");
    if (c.files.length) lines.push(`**Files:** ${c.files.map(fileRef).join(", ")}`, "");
  });
  await writeFile(readme, lines.join("\n"));
  return { folder: abs, excalidraw, svg, readme };
}

/** One note per concept, rebuilt from state; anything the user wrote below the marker survives. */
export async function writeNote(dir, id, concept) {
  await ensureDir(join(dir, "notes"));
  const path = join(dir, "notes", `${id}.md`);
  const existing = await readOptional(path);
  const kept = existing?.includes(KEEP) ? existing.slice(existing.indexOf(KEEP) + KEEP.length).replace(/^\n/, "") : "\n";
  const lines = [`# ${md(concept.name)}`, "", `_${concept.kind.replace(/-/g, " ")} · ${concept.level}_`, "", md(concept.explanation), ""];
  if (concept.prerequisites?.length) lines.push(`**Learn first:** ${concept.prerequisites.map(md).join(", ")}`, "");
  if (concept.learnMore?.length) lines.push("**Learn more:**", "", ...concept.learnMore.map((l) => `- [${md(l.title)}](<${l.url}>)`), "");
  lines.push(`## Where it showed up (${concept.sightings.length})`, "");
  for (const s of [...concept.sightings].reverse()) {
    lines.push(`### ${day(s.date)} · [${md(s.title)}](../${s.folder}/README.md) · \`${s.shortSha}\``, "", md(s.whyHere), "");
    if (s.files?.length) lines.push(`Files: ${s.files.map(fileRef).join(", ")}`, "");
  }
  lines.push("## My notes", "", KEEP, kept.trimEnd(), "");
  await writeFile(path, lines.join("\n"));
  return path;
}

/** The folder's front page: every diagram, newest first, then the concepts by kind. */
export async function writeIndex(dir, state, repoLabel) {
  const recorded = Object.entries(state.commits).filter(([, c]) => c.folder).sort((a, b) => String(b[1].date).localeCompare(String(a[1].date)));
  const skipped = Object.values(state.commits).filter((c) => c.skipped).length;
  const lines = [`# Concepts learned in ${md(repoLabel)}`, "", `${recorded.length} diagrams · ${Object.keys(state.concepts).length} concepts · ${skipped} commits skipped`, ""];
  if (recorded.length) {
    lines.push("## Diagrams", "", "| Date | Commit | What it built | Concepts |", "| --- | --- | --- | --- |");
    for (const [, c] of recorded) {
      const concepts = c.concepts.map((id) => `[${md(state.concepts[id]?.name ?? id)}](notes/${id}.md)`).join(", ");
      lines.push(`| ${day(c.date)} | \`${c.shortSha}\` | [${md(c.title)}](${c.folder}/README.md) | ${concepts} |`);
    }
    lines.push("");
  }
  const byKind = {};
  for (const [id, c] of Object.entries(state.concepts)) (byKind[c.kind] ??= []).push([id, c]);
  if (Object.keys(byKind).length) {
    lines.push("## Concepts", "");
    for (const kind of Object.keys(byKind).sort()) {
      lines.push(`**${kind.replace(/-/g, " ")}:** ${byKind[kind].sort((a, b) => a[1].name.localeCompare(b[1].name)).map(([id, c]) => `[${md(c.name)}](notes/${id}.md)${c.sightings.length > 1 ? ` ×${c.sightings.length}` : ""}`).join(" · ")}`, "");
    }
  }
  await writeFile(join(dir, "README.md"), lines.join("\n"));
}

/** In library mode, a front page for the whole library listing each repository. */
export async function writeLibraryIndex(libraryRoot) {
  const entries = await readdir(libraryRoot, { withFileTypes: true }).catch(() => []);
  const rows = [];
  for (const e of entries.filter((e) => e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    const state = await readState(join(libraryRoot, e.name)).catch(() => null);
    if (!state || !Object.keys(state.commits).length) continue;
    const diagrams = Object.values(state.commits).filter((c) => c.folder).length;
    rows.push(`| [${md(e.name)}](${e.name}/README.md) | ${diagrams} | ${Object.keys(state.concepts).length} |`);
  }
  await writeFile(join(libraryRoot, "README.md"), ["# Concept library", "", "Diagrams of the concepts used in your projects' commits, made by concepts-mcp.", "", "| Project | Diagrams | Concepts |", "| --- | --- | --- |", ...rows, ""].join("\n"));
}
