import { z } from "zod";

export const KINDS = ["pattern", "algorithm", "data-structure", "architecture", "library", "framework", "language-feature", "protocol", "tooling", "testing", "security", "performance", "concept"];
export const LEVELS = ["beginner", "intermediate", "advanced"];
export const VIEW_TYPES = ["architecture", "sequence", "flow", "state", "data-model"];
export const SHAPES = [
  "service", "module", "function", "process", "config", "client", "user", "database", "cache", "storage",
  "queue", "event", "external", "decision", "start", "end", "state", "entity", "document",
];
export const STATUSES = ["new", "changed", "existing"];
export const EDGE_STYLES = ["sync", "async", "data", "dependency"];

const slug = z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/, "lowercase slug, e.g. retry-worker");
// Labels are names, not sentences: the diagram teaches through structure and the explanations live beside it.
const label = (max) => z.string().min(1).max(max);
const status = z.enum(STATUSES).default("existing").describe("new = added by this commit, changed = modified by it, existing = context the reader needs");

const graphView = z.object({
  type: z.enum(["architecture", "flow", "state", "data-model"]),
  title: label(60).describe("What this view shows, e.g. 'Where retries fit'"),
  direction: z.enum(["right", "down"]).optional().describe("Layout direction; defaults to right, or down for flow"),
  groups: z.array(z.object({ id: slug, label: label(32) })).max(16).default([]).describe("Boundaries such as services, layers or trust zones"),
  nodes: z.array(z.object({
    id: slug,
    label: label(32).describe("A name, 1-4 words"),
    shape: z.enum(SHAPES),
    group: slug.optional(),
    status,
    fields: z.array(label(40)).max(14).optional().describe("data-model entities only: 'id: uuid', 'email: text'"),
  })).min(1).max(48),
  edges: z.array(z.object({
    id: slug.optional().describe("Needed only to attach a concept to this edge"),
    from: slug,
    to: slug,
    label: label(28).optional().describe("A verb or message name, e.g. 'enqueue', 'POST /hooks', '1..*'"),
    style: z.enum(EDGE_STYLES).default("sync").describe("sync call, async message/event, data flow, or dependency"),
    status,
  })).max(120).default([]),
});

const sequenceView = z.object({
  type: z.literal("sequence"),
  title: label(60),
  participants: z.array(z.object({
    id: slug,
    label: label(28),
    shape: z.enum(["user", "client", "service", "database", "cache", "queue", "external", "function"]).default("service"),
    status,
  })).min(1).max(12),
  messages: z.array(z.object({
    id: slug.optional(),
    from: slug,
    to: slug,
    label: label(36).describe("The call or message, e.g. 'POST /charge', 'retry in 4s'"),
    style: z.enum(["sync", "async", "reply"]).default("sync"),
    status,
  })).min(1).max(60),
});

export const viewSchema = z.discriminatedUnion("type", [graphView, sequenceView]);

export const conceptSchema = z.object({
  id: slug.describe("Stable slug. Reuse the id from get_concept_library when the concept is already known."),
  name: label(60).describe("Short display name, e.g. 'Exponential backoff'"),
  kind: z.enum(KINDS),
  level: z.enum(LEVELS).describe("How advanced the concept is for a working developer"),
  appearsIn: z.array(slug).max(16).default([]).describe("Ids of the nodes, edges, participants or messages where this concept lives; each gets a numbered marker"),
  explanation: z.string().min(1).max(800).describe("What it is, for someone who has never met it. Shown beside the diagram, not in it."),
  whyHere: z.string().min(1).max(500).describe("Why this commit needed it"),
  files: z.array(z.object({ path: z.string().min(1).max(300), lines: z.string().max(40).optional() })).max(12).default([]),
  prerequisites: z.array(label(60)).max(8).default([]).describe("Concepts worth knowing first"),
  learnMore: z.array(z.object({ title: label(120), url: z.url({ protocol: /^https?$/ }) })).max(3).default([]),
});

export const recordInput = {
  repoPath: z.string().max(2000).optional().describe("Absolute path of the repository root. Defaults to the server's working directory."),
  commit: z.string().regex(/^[0-9a-f]{7,40}$/i).describe("Commit SHA from get_unprocessed_commits"),
  skipReason: z.string().min(1).max(200).optional().describe("Set instead of a diagram for commits with nothing to learn (typos, formatting, version bumps)"),
  title: label(80).optional().describe("What the commit built, e.g. 'Retrying failed webhooks'"),
  summary: z.string().min(1).max(1200).optional().describe("A short paragraph on what changed and the main idea. Goes in the README beside the diagram."),
  views: z.array(viewSchema).max(8).optional().describe("One or more system-design views; as many as the change needs"),
  concepts: z.array(conceptSchema).max(80).optional().describe("Every concept worth learning in this commit; no fixed number"),
};

export const recordSchema = z.object(recordInput);

/** Cross-field checks zod can't express per field. Returns a list of problems. */
export function checkRecord(input) {
  if (input.skipReason) return input.concepts?.length || input.views?.length ? ["Pass either skipReason or a diagram, not both."] : [];
  const problems = [];
  if (!input.title) problems.push("title is required unless skipReason is set.");
  if (!input.summary) problems.push("summary is required unless skipReason is set.");
  if (!input.views?.length) problems.push("Add at least one view, or set skipReason.");
  if (!input.concepts?.length) problems.push("Add at least one concept, or set skipReason.");
  const refs = new Set();
  const claim = (id, what) => {
    if (refs.has(id)) problems.push(`Id "${id}" (${what}) is used twice; ids must be unique across all views.`);
    refs.add(id);
  };
  for (const [i, view] of (input.views ?? []).entries()) {
    const where = `view ${i + 1} "${view.title}"`;
    if (view.type === "sequence") {
      const ids = new Set(view.participants.map((p) => p.id));
      view.participants.forEach((p) => claim(p.id, `participant in ${where}`));
      for (const m of view.messages) {
        if (m.id) claim(m.id, `message in ${where}`);
        for (const end of [m.from, m.to]) if (!ids.has(end)) problems.push(`Message "${m.label}" in ${where} refers to "${end}", which isn't a participant there.`);
      }
    } else {
      const ids = new Set(view.nodes.map((n) => n.id));
      const groups = new Set(view.groups.map((g) => g.id));
      view.groups.forEach((g) => claim(g.id, `group in ${where}`));
      for (const n of view.nodes) {
        claim(n.id, `node in ${where}`);
        if (n.group && !groups.has(n.group)) problems.push(`Node "${n.id}" in ${where} is in group "${n.group}", which isn't defined there.`);
      }
      for (const e of view.edges) {
        if (e.id) claim(e.id, `edge in ${where}`);
        for (const end of [e.from, e.to]) if (!ids.has(end)) problems.push(`Edge ${e.from} → ${e.to} in ${where} refers to "${end}", which isn't a node there.`);
      }
    }
  }
  const conceptIds = new Set();
  for (const c of input.concepts ?? []) {
    if (conceptIds.has(c.id)) problems.push(`Concept id "${c.id}" is used twice.`);
    conceptIds.add(c.id);
    for (const ref of c.appearsIn) if (!refs.has(ref)) problems.push(`Concept "${c.id}" appears in "${ref}", which isn't a node, edge, participant or message id.`);
  }
  return problems;
}
