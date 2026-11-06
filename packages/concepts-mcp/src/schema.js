import { z } from "zod";

export const KINDS = ["pattern", "algorithm", "data-structure", "architecture", "library", "framework", "language-feature", "protocol", "tooling", "testing", "security", "performance", "concept"];
export const LEVELS = ["beginner", "intermediate", "advanced"];
const id = z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/, "lowercase slug, e.g. optimistic-updates");

export const conceptSchema = z.object({
  id: id.describe("Stable slug. Reuse the id from get_concept_library when the concept is already known."),
  name: z.string().min(1).max(60).describe("Short display name, e.g. 'Optimistic updates'"),
  kind: z.enum(KINDS),
  level: z.enum(LEVELS).describe("How advanced the concept is for a working developer"),
  explanation: z.string().min(1).max(600).describe("What it is, in 1-3 plain sentences, for someone who has never met it"),
  whyHere: z.string().min(1).max(400).describe("Why this commit needed it, in 1-2 sentences"),
  files: z.array(z.object({ path: z.string().min(1).max(300), lines: z.string().max(40).optional() })).max(8).default([]),
  prerequisites: z.array(z.string().min(1).max(60)).max(6).default([]).describe("Concepts worth knowing first"),
  learnMore: z.array(z.object({ title: z.string().min(1).max(120), url: z.url({ protocol: /^https?$/ }) })).max(3).default([]),
});

export const relationSchema = z.object({
  from: id,
  to: id,
  label: z.string().min(1).max(40).describe("Verb phrase read as 'from <label> to', e.g. 'uses', 'is built on', 'replaces'"),
});

export const recordInput = {
  repoPath: z.string().max(2000).optional().describe("Absolute path of the repository root. Defaults to the server's working directory."),
  commit: z.string().regex(/^[0-9a-f]{7,40}$/i).describe("Commit SHA from get_unprocessed_commits"),
  skipReason: z.string().min(1).max(200).optional().describe("Set instead of concepts for commits with nothing to learn (typos, formatting, version bumps)"),
  title: z.string().min(1).max(80).optional().describe("Diagram title: what the commit built, e.g. 'Retrying failed webhooks with backoff'"),
  summary: z.string().min(1).max(500).optional().describe("1-3 sentences: what the commit does and the main idea to take away"),
  concepts: z.array(conceptSchema).max(10).optional(),
  relations: z.array(relationSchema).max(30).optional(),
};

export const recordSchema = z.object(recordInput);

/** Cross-field checks zod can't express per field. Returns a list of problems. */
export function checkRecord(input) {
  if (input.skipReason) return input.concepts?.length ? ["Pass either skipReason or concepts, not both."] : [];
  const problems = [];
  if (!input.title) problems.push("title is required unless skipReason is set.");
  if (!input.summary) problems.push("summary is required unless skipReason is set.");
  const concepts = input.concepts ?? [];
  if (!concepts.length) problems.push("Add at least one concept, or set skipReason.");
  const ids = new Set();
  for (const c of concepts) {
    if (ids.has(c.id)) problems.push(`Concept id "${c.id}" is used twice.`);
    ids.add(c.id);
  }
  for (const r of input.relations ?? []) {
    for (const end of [r.from, r.to]) if (!ids.has(end)) problems.push(`Relation ${r.from} → ${r.to} refers to "${end}", which isn't one of this commit's concepts (${[...ids].join(", ")}).`);
    if (r.from === r.to) problems.push(`Relation ${r.from} → ${r.to} points at itself.`);
  }
  return problems;
}
