import dagre from "@dagrejs/dagre";
import { emWidth } from "./metrics.js";

// Excalidraw's own pastel palette, one per kind, so the colors carry meaning across every diagram.
export const KIND_COLORS = {
  pattern: "#a5d8ff", algorithm: "#ffc9c9", "data-structure": "#ffd8a8", architecture: "#d0bfff",
  library: "#b2f2bb", framework: "#96f2d7", "language-feature": "#ffec99", protocol: "#99e9f2",
  tooling: "#e9ecef", testing: "#c3fae8", security: "#ffa8a8", performance: "#fcc2d7", concept: "#eebefa",
};
export const INK = "#1e1e1e";
export const MUTED = "#757575";
export const ACCENT = "#e03131";
export const FONT = { title: 28, sub: 14, body: 16, name: 20, meta: 13, small: 14, edge: 14 };
const LINE = 1.25;
const NODE_W = 300;
const PAD = 16;

/** Width of text in the bundled hand-drawn font (the same metrics Excalidraw uses for Virgil). */
export function textWidth(text, size) {
  return Math.ceil(emWidth(text) * size);
}

/** Greedy word wrap to `width` pixels; words longer than a line are split. */
export function wrap(text, size, width) {
  const fits = (s) => textWidth(s, size) <= width;
  const lines = [];
  for (const para of String(text).split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (fits(next)) { line = next; continue; }
      if (line) lines.push(line);
      line = word;
      while (!fits(line)) {
        let cut = line.length - 1;
        while (cut > 1 && !fits(`${line.slice(0, cut)}-`)) cut--;
        lines.push(`${line.slice(0, cut)}-`);
        line = line.slice(cut);
      }
    }
    lines.push(line);
  }
  return lines;
}

/** Where the line between two box centers leaves each box, so edges are straight and end at the border. */
function straightEdge(a, b) {
  const ca = [a.x + a.width / 2, a.y + a.height / 2];
  const cb = [b.x + b.width / 2, b.y + b.height / 2];
  const exit = (box, [cx, cy], [tx, ty]) => {
    const dx = tx - cx;
    const dy = ty - cy;
    const t = Math.min(dx ? (box.width / 2) / Math.abs(dx) : Infinity, dy ? (box.height / 2) / Math.abs(dy) : Infinity);
    return [cx + dx * t, cy + dy * t];
  };
  return [exit(a, ca, cb), exit(b, cb, ca)];
}

/** The first sentence or two that fits in a box; the full explanation lives in the concept's note. */
export function brief(text, limit = 170) {
  const sentences = String(text).match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) ?? [String(text)];
  let out = "";
  for (const s of sentences) {
    if ((out + s).trim().length > limit) break;
    out += s;
  }
  out = out.trim() || String(text).slice(0, limit - 1).trim() + "…";
  return out;
}

function block(lines, size, color, x, y, extra = {}) {
  return { type: "text", lines, size, color, x, y, width: Math.max(0, ...lines.map((l) => textWidth(l, size))), height: lines.length * size * LINE, ...extra };
}

/**
 * Lay out one commit's concepts. Returns plain shapes (text blocks, nodes, edges) in absolute
 * coordinates that both the .excalidraw and the SVG writers draw from.
 */
export function buildScene(record, { newIds = new Set(), noteLink = () => null } = {}) {
  const nodes = record.concepts.map((c) => {
    const isNew = newIds.has(c.id);
    const meta = `${c.kind.replace(/-/g, " ")} · ${c.level}${isNew ? " · NEW" : ""}`;
    const nameLines = wrap(c.name, FONT.name, NODE_W - PAD * 2);
    const bodyLines = wrap(brief(c.explanation), FONT.small, NODE_W - PAD * 2);
    const height = PAD + nameLines.length * FONT.name * LINE + 6 + FONT.meta * LINE + 10 + bodyLines.length * FONT.small * LINE + PAD;
    return { concept: c, isNew, meta, nameLines, bodyLines, width: NODE_W, height: Math.ceil(height) };
  });

  const linked = new Set((record.relations ?? []).flatMap((r) => [r.from, r.to]));
  const g = new dagre.graphlib.Graph({ multigraph: true });
  g.setGraph({ rankdir: "TB", nodesep: 80, ranksep: 120, edgesep: 40, marginx: 0, marginy: 0 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const n of nodes) if (linked.has(n.concept.id)) g.setNode(n.concept.id, { width: n.width, height: n.height });
  (record.relations ?? []).forEach((r, i) => {
    // No label size here: dagre would route the edge through a dummy label node and bend it. Labels sit at the midpoint instead.
    g.setEdge(r.from, r.to, { label: r.label }, `e${i}`);
  });
  dagre.layout(g);

  const byId = new Map(nodes.map((n) => [n.concept.id, n]));
  let graphW = 0;
  let graphH = 0;
  for (const id of g.nodes()) {
    const { x, y } = g.node(id);
    const n = byId.get(id);
    n.x = x - n.width / 2;
    n.y = y - n.height / 2;
    graphW = Math.max(graphW, n.x + n.width);
    graphH = Math.max(graphH, n.y + n.height);
  }
  const edges = g.edges().map((e) => {
    const data = g.edge(e);
    const a = byId.get(e.v);
    const b = byId.get(e.w);
    const points = straightEdge(a, b);
    return { from: e.v, to: e.w, label: data.label, points, labelX: (points[0][0] + points[1][0]) / 2, labelY: (points[0][1] + points[1][1]) / 2 };
  });

  // Concepts with no relations go in a grid under the graph instead of one very wide row.
  const loose = nodes.filter((n) => !linked.has(n.concept.id));
  if (loose.length) {
    const cols = Math.min(3, loose.length);
    const top = graphH ? graphH + 90 : 0;
    let rowY = top;
    for (let i = 0; i < loose.length; i += cols) {
      const row = loose.slice(i, i + cols);
      row.forEach((n, j) => { n.x = j * (NODE_W + 50); n.y = rowY; });
      rowY += Math.max(...row.map((n) => n.height)) + 50;
    }
    graphW = Math.max(graphW, cols * (NODE_W + 50) - 50);
    graphH = rowY - 50;
  }

  // Header above the graph: title, commit line, takeaway.
  const contentW = Math.max(graphW, 640);
  const shapes = [];
  let y = 0;
  const title = block(wrap(record.title, FONT.title, contentW), FONT.title, INK, 0, y, { role: "title" });
  shapes.push(title);
  y += title.height + 8;
  const sub = block([String(record.commitLine).replace(/`/g, "")], FONT.sub, MUTED, 0, y, { role: "commit" });
  shapes.push(sub);
  y += sub.height + 14;
  const summary = block(wrap(record.summary, FONT.body, Math.min(contentW, 760)), FONT.body, INK, 0, y, { role: "summary" });
  shapes.push(summary);
  y += summary.height + 50;

  const offsetX = (contentW - graphW) / 2;
  for (const n of nodes) { n.x += offsetX; n.y += y; n.link = noteLink(n.concept); }
  for (const e of edges) {
    e.points = e.points.map(([px, py]) => [px + offsetX, py + y]);
    e.labelX += offsetX;
    e.labelY += y;
  }
  y += graphH + 50;

  // Legend for the kinds that appear, plus the "new" marker.
  const kinds = [...new Set(record.concepts.map((c) => c.kind))];
  const legend = [];
  let lx = 0;
  for (const kind of kinds) {
    const label = kind.replace(/-/g, " ");
    legend.push({ kind, label, x: lx, y, color: KIND_COLORS[kind] });
    lx += 28 + textWidth(label, FONT.meta) + 24;
  }
  if (nodes.some((n) => n.isNew)) legend.push({ kind: "new", label: "NEW = first time in your library", x: lx, y, color: null });
  const height = y + FONT.meta * LINE;
  const width = Math.max(contentW, lx + 180);
  return { width, height, shapes, nodes, edges, legend };
}
