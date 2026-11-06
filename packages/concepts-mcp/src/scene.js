import dagre from "@dagrejs/dagre";
import { emWidth } from "./metrics.js";

// Colors from Excalidraw's palette. Fill says what a part *is*; the outline says whether this commit added it.
export const INK = "#1e1e1e";
export const MUTED = "#757575";
export const FAINT = "#adb5bd";
export const ACCENT = "#e03131";
export const CHANGED = "#1971c2";
export const PAPER = "#ffffff";
const FILL = {
  service: "#a5d8ff", module: "#a5d8ff", function: "#a5d8ff", process: "#a5d8ff", state: "#a5d8ff", config: "#e9ecef",
  client: "#d0bfff", user: "#d0bfff", database: "#b2f2bb", storage: "#b2f2bb", cache: "#c3fae8", queue: "#ffd8a8",
  event: "#ffd8a8", external: "#e9ecef", decision: "#ffec99", start: "#c3fae8", end: "#c3fae8", entity: "#fff3bf", document: "#ffffff",
};
const LINE = 1.25;
const LABEL = 16;
const SMALL = 14;

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

function lighten(hex, t) {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c) => Math.round(c + (255 - c) * t).toString(16).padStart(2, "0");
  return `#${mix(n >> 16)}${mix((n >> 8) & 255)}${mix(n & 255)}`;
}

function look(status, fill) {
  if (status === "new") return { stroke: INK, strokeWidth: 2.5, fill };
  if (status === "changed") return { stroke: CHANGED, strokeWidth: 2.5, fill };
  return { stroke: FAINT, strokeWidth: 1, fill: lighten(fill, 0.55), textColor: MUTED };
}

const EDGE = {
  sync: { dash: "solid", head: "arrow", word: "call" },
  async: { dash: "dashed", head: "arrow", word: "async message / event" },
  data: { dash: "solid", head: "triangle", word: "data flow" },
  dependency: { dash: "dotted", head: "arrow", word: "depends on" },
  reply: { dash: "dashed", head: "arrow", word: "reply" },
};

/** Collects drawing primitives. Both writers (.excalidraw and SVG) draw exactly this list. */
class Canvas {
  constructor(prefix) { this.prefix = prefix; this.items = []; this.n = 0; }
  key(name) { return `${this.prefix}:${name ?? this.n++}`; }
  add(item) { this.items.push(item); return item; }
  text(lines, size, color, x, y, extra = {}) {
    const w = Math.max(1, ...lines.map((l) => textWidth(l, size)));
    return this.add({ kind: "text", key: this.key(extra.name), lines, size, color, x, y, w, h: lines.length * size * LINE, align: "left", ...extra });
  }
  bounds() {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const it of this.items) {
      const pts = it.points ?? [[it.x, it.y], [it.x + it.w, it.y + it.h]];
      for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    }
    return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
  }
  shift(dx, dy) {
    for (const it of this.items) {
      if (it.points) it.points = it.points.map(([x, y]) => [x + dx, y + dy]);
      if (it.x !== undefined) { it.x += dx; it.y += dy; }
    }
    for (const a of Object.values(this.anchors ?? {})) for (const p of a) { p.x += dx; p.y += dy; }
  }
}

function labelLines(label, max = 170) {
  const lines = wrap(label, LABEL, max);
  return { lines, w: Math.max(...lines.map((l) => textWidth(l, LABEL))), h: lines.length * LABEL * LINE };
}

/** Size a node so its label fits its shape. */
export function nodeSize(node) {
  const { w: lw, h: lh } = labelLines(node.label);
  switch (node.shape) {
    case "user": return { w: Math.max(90, lw + 24), h: 66 + lh };
    case "database": case "storage": case "cache": return { w: Math.max(110, lw + 40), h: lh + 58 };
    case "queue": return { w: Math.max(140, lw + 84), h: Math.max(60, lh + 30) };
    case "event": case "start": case "end": return { w: Math.max(110, lw + 64), h: Math.max(58, lh + 36) };
    case "decision": return { w: Math.max(140, Math.ceil(lw * 1.5) + 40), h: Math.max(84, Math.ceil(lh * 1.6) + 44) };
    case "entity": {
      const fields = node.fields ?? [];
      const fw = Math.max(0, ...fields.map((f) => textWidth(f, SMALL)));
      return { w: Math.max(170, lw + 36, fw + 32), h: lh + 22 + (fields.length ? fields.length * SMALL * LINE + 16 : 0) };
    }
    case "client": return { w: Math.max(130, lw + 40), h: Math.max(70, lh + 44) };
    default: return { w: Math.max(120, lw + 40), h: Math.max(60, lh + 30) };
  }
}

/** Draw one node with its shape. Returns the key of the element arrows attach to. */
function drawNode(c, node, x, y, w, h) {
  const st = look(node.status, FILL[node.shape] ?? FILL.service);
  const group = c.key(`g-${node.id}`);
  const body = c.key(`node-${node.id}`);
  const { lines, h: lh } = labelLines(node.label);
  const textColor = st.textColor ?? INK;
  const base = { stroke: st.stroke, strokeWidth: st.strokeWidth, fill: st.fill, dash: "solid", group };
  const centered = (top) => {
    const t = c.text(lines, LABEL, textColor, x + w / 2, top, { align: "center", group });
    t.x -= t.w / 2;
    return t;
  };
  const bound = () => {
    const t = c.text(lines, LABEL, textColor, x + w / 2, y + h / 2 - lh / 2, { align: "center", group, container: body });
    t.x -= t.w / 2;
    return t;
  };
  const line = (pts, extra = {}) => c.add({ kind: "line", key: c.key(), points: pts, stroke: st.stroke, strokeWidth: st.strokeWidth, dash: "solid", group, ...extra });

  switch (node.shape) {
    case "user": {
      c.add({ kind: "rect", key: body, x, y, w, h, stroke: "transparent", strokeWidth: 1, fill: "transparent", dash: "solid", group });
      const cx = x + w / 2;
      c.add({ kind: "ellipse", key: c.key(), x: cx - 11, y: y + 2, w: 22, h: 22, ...base });
      line([[cx, y + 24], [cx, y + 46]]);
      line([[cx - 17, y + 32], [cx + 17, y + 32]]);
      line([[cx, y + 46], [cx - 14, y + 62]]);
      line([[cx, y + 46], [cx + 14, y + 62]]);
      centered(y + 66);
      break;
    }
    case "database": case "storage": case "cache": {
      const ry = 10;
      c.add({ kind: "ellipse", key: c.key(), x, y: y + h - ry * 2, w, h: ry * 2, ...base });
      c.add({ kind: "rect", key: body, x, y: y + ry, w, h: h - ry * 2, ...base, stroke: "transparent" });
      line([[x, y + ry], [x, y + h - ry]]);
      line([[x + w, y + ry], [x + w, y + h - ry]]);
      c.add({ kind: "ellipse", key: c.key(), x, y, w, h: ry * 2, ...base });
      centered(y + ry * 2 + (h - ry * 3 - lh) / 2);
      break;
    }
    case "event": case "start": case "end":
      c.add({ kind: "ellipse", key: body, x, y, w, h, ...base });
      if (node.shape === "end") c.add({ kind: "ellipse", key: c.key(), x: x + 5, y: y + 5, w: w - 10, h: h - 10, ...base, fill: "transparent" });
      bound();
      break;
    case "decision":
      c.add({ kind: "diamond", key: body, x, y, w, h, ...base });
      bound();
      break;
    case "entity": {
      c.add({ kind: "rect", key: body, x, y, w, h, ...base, rounded: false });
      const t = c.text(lines, LABEL, textColor, x + w / 2, y + 10, { align: "center", group });
      t.x -= t.w / 2;
      const fields = node.fields ?? [];
      if (fields.length) {
        line([[x, y + lh + 20], [x + w, y + lh + 20]]);
        c.text(fields, SMALL, textColor, x + 14, y + lh + 28, { group });
      }
      break;
    }
    default: {
      const dash = node.shape === "external" ? "dashed" : "solid";
      c.add({ kind: "rect", key: body, x, y, w, h, ...base, dash, rounded: !["module", "document", "config"].includes(node.shape) });
      if (node.shape === "client") line([[x, y + 16], [x + w, y + 16]]);
      if (node.shape === "document") line([[x + w - 18, y], [x + w, y + 18]]);
      if (node.shape === "queue") for (const off of [14, 24, 34]) line([[x + w - off, y + 9], [x + w - off, y + h - 9]]);
      if (node.shape === "client") {
        const t = c.text(lines, LABEL, textColor, x + w / 2, y + 16 + (h - 16 - lh) / 2, { align: "center", group, container: body });
        t.x -= t.w / 2;
      } else bound();
    }
  }
  return body;
}

function arrowStyle(style, status) {
  const e = EDGE[style] ?? EDGE.sync;
  if (status === "new") return { ...e, stroke: INK, strokeWidth: 2 };
  if (status === "changed") return { ...e, stroke: CHANGED, strokeWidth: 2 };
  return { ...e, stroke: FAINT, strokeWidth: 1.5, textColor: MUTED };
}

const GROUP_PAD = { left: 18, right: 18, top: 34, bottom: 18 };

/** A boundary's box: its members' extent plus room for the title strip. */
function groupBox(members, pos, sizes) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const n of members) {
    const p = pos.get(n.id), s = sizes.get(n.id);
    x0 = Math.min(x0, p.x - s.w / 2); y0 = Math.min(y0, p.y - s.h / 2);
    x1 = Math.max(x1, p.x + s.w / 2); y1 = Math.max(y1, p.y + s.h / 2);
  }
  return { x: x0 - GROUP_PAD.left, y: y0 - GROUP_PAD.top, w: x1 - x0 + GROUP_PAD.left + GROUP_PAD.right, h: y1 - y0 + GROUP_PAD.top + GROUP_PAD.bottom };
}

/**
 * dagre doesn't know boundaries need a title strip and padding, so padded boxes can collide. Where two do,
 * open a gap between them along the axis where they overlap least: everything past the gap moves over,
 * edge routes included, which keeps the layout's arrangement and only adds space.
 */
function separateGroups(boxes, pos, routes, sizes) {
  const overlap = (a, b) => ({ x: Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), y: Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) });
  for (let pass = 0; pass < 40; pass++) {
    let fixed = false;
    for (let i = 0; i < boxes.length && !fixed; i++) for (let j = i + 1; j < boxes.length && !fixed; j++) {
      const o = overlap(boxes[i], boxes[j]);
      if (o.x <= 0 || o.y <= 0) continue;
      const axis = o.x < o.y ? "x" : "y";
      const size = axis === "x" ? "w" : "h";
      const [first, second] = boxes[i][axis] <= boxes[j][axis] ? [boxes[i], boxes[j]] : [boxes[j], boxes[i]];
      // The cut sits between the first box's members and the second box's members.
      const firstEnd = first[axis] + first[size] - (axis === "x" ? GROUP_PAD.right : GROUP_PAD.bottom);
      const secondStart = second[axis] + (axis === "x" ? GROUP_PAD.left : GROUP_PAD.top);
      if (secondStart < firstEnd) continue; // members interleave; moving one side can't separate them
      const cut = (firstEnd + secondStart) / 2;
      const delta = (axis === "x" ? o.x : o.y) + 24;
      const k = axis === "x" ? 0 : 1;
      const moved = new Set([...pos].filter(([, p]) => p[axis] > cut).map(([id]) => id));
      for (const id of moved) pos.get(id)[axis] += delta;
      for (const r of routes) {
        // Ends follow their own node, so arrows stay attached even to a node that straddles the cut.
        const last = r.points.length - 1;
        r.points = r.points.map((pt, n) => {
          const q = [...pt];
          const follows = n === 0 ? moved.has(r.from) : n === last ? moved.has(r.to) : q[k] > cut;
          if (follows) q[k] += delta;
          return q;
        });
        if (r[axis] !== undefined && r[axis] > cut) r[axis] += delta;
      }
      for (const b of boxes) Object.assign(b, groupBox(b.members, pos, sizes));
      fixed = true;
    }
    if (!fixed) return;
  }
}

function layoutGraph(view, prefix) {
  const c = new Canvas(prefix);
  c.anchors = {};
  const sizes = new Map(view.nodes.map((n) => [n.id, nodeSize(n)]));
  const g = new dagre.graphlib.Graph({ compound: true, multigraph: true });
  const down = (view.direction ?? (view.type === "flow" ? "down" : "right")) === "down";
  g.setGraph({ rankdir: down ? "TB" : "LR", nodesep: 46, ranksep: down ? 74 : 110, edgesep: 24, marginx: 0, marginy: 0 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const grp of view.groups) g.setNode(`group:${grp.id}`, { label: grp.label });
  for (const n of view.nodes) {
    const s = sizes.get(n.id);
    g.setNode(n.id, { width: s.w, height: s.h });
    if (n.group) g.setParent(n.id, `group:${n.group}`);
  }
  view.edges.forEach((e, i) => {
    const lw = e.label ? textWidth(e.label, SMALL) + 12 : 0;
    g.setEdge(e.from, e.to, { width: lw, height: e.label ? 22 : 0, labelpos: "c" }, `e${i}`);
  });
  dagre.layout(g);

  // Copy the layout out of dagre so it can be adjusted, then make room for boundary titles and padding.
  const pos = new Map(view.nodes.map((n) => [n.id, { x: g.node(n.id).x, y: g.node(n.id).y }]));
  const routes = view.edges.map((e, i) => {
    const d = g.edge({ v: e.from, w: e.to, name: `e${i}` });
    return { from: e.from, to: e.to, points: d.points.map((p) => [p.x, p.y]), x: d.x, y: d.y };
  });
  const boxes = view.groups.map((grp) => {
    const members = view.nodes.filter((n) => n.group === grp.id);
    return { grp, members, ...groupBox(members, pos, sizes) };
  }).filter((b) => b.members.length);
  separateGroups(boxes, pos, routes, sizes);

  // Boundaries first, so they sit behind the parts inside them.
  for (const b of boxes) {
    const { x, y, w, h } = b;
    c.add({ kind: "rect", key: c.key(`group-${b.grp.id}`), x, y, w, h, stroke: MUTED, strokeWidth: 1, fill: "#f8f9fa", dash: "dashed", rounded: true });
    const t = c.text([b.grp.label], SMALL, MUTED, x + 12, y + 8);
    c.anchors[b.grp.id] = [{ x: x + 12 + t.w + 18, y: y + 4, dir: 1 }];
  }
  const bodies = new Map();
  for (const n of view.nodes) {
    const p = pos.get(n.id);
    const s = sizes.get(n.id);
    const x = p.x - s.w / 2, y = p.y - s.h / 2;
    bodies.set(n.id, drawNode(c, n, x, y, s.w, s.h));
    c.anchors[n.id] = [{ x: x + s.w - 4, y: y - 8, dir: -1 }];
  }
  view.edges.forEach((e, i) => {
    const data = routes[i];
    const st = arrowStyle(e.style, e.status);
    let points = data.points;
    if (e.from === e.to && points.length < 3) {
      const b = pos.get(e.from), half = sizes.get(e.from).w / 2;
      points = [[b.x + half, b.y], [b.x + half + 34, b.y - 10], [b.x + half + 34, b.y + 24], [b.x + half, b.y + 14]];
    }
    const arrow = c.add({ kind: "arrow", key: c.key(`edge-${i}`), points, stroke: st.stroke, strokeWidth: st.strokeWidth, dash: st.dash, head: st.head, start: bodies.get(e.from), end: bodies.get(e.to), curved: points.length > 2 });
    let lx = data.x, ly = data.y;
    if (lx === undefined) { const mid = points[Math.floor(points.length / 2)]; [lx, ly] = mid; }
    if (e.label) {
      const t = c.text([e.label], SMALL, st.textColor ?? INK, lx, ly - (SMALL * LINE) / 2, { align: "center", container: arrow.key, background: true });
      t.x -= t.w / 2;
      if (e.id) c.anchors[e.id] = [{ x: t.x + t.w + 16, y: t.y - 6, dir: 1 }];
    } else if (e.id) c.anchors[e.id] = [{ x: lx + 10, y: ly - 22, dir: 1 }];
  });
  return c;
}

function layoutSequence(view, prefix) {
  const c = new Canvas(prefix);
  c.anchors = {};
  const heads = view.participants.map((p) => ({ p, size: nodeSize({ ...p, label: p.label }) }));
  const headH = Math.max(...heads.map((h) => h.size.h));
  const longest = Math.max(0, ...view.messages.map((m) => textWidth(m.label, SMALL)));
  const col = Math.max(190, longest + 50, ...heads.map((h) => h.size.w + 40));
  const cx = new Map(view.participants.map((p, i) => [p.id, i * col + col / 2]));
  const top = 0;
  heads.forEach(({ p, size }) => {
    const x = cx.get(p.id) - size.w / 2, y = top + headH - size.h;
    drawNode(c, { ...p, label: p.label }, x, y, size.w, size.h);
    c.anchors[p.id] = [{ x: x + size.w - 4, y: y - 8, dir: -1 }];
  });
  let y = top + headH + 56;
  const rows = [];
  for (const m of view.messages) {
    rows.push({ m, y });
    y += m.from === m.to ? 72 : 54;
  }
  for (const p of view.participants) {
    c.add({ kind: "line", key: c.key(`life-${p.id}`), points: [[cx.get(p.id), top + headH + 8], [cx.get(p.id), y]], stroke: FAINT, strokeWidth: 1, dash: "dashed" });
  }
  rows.forEach(({ m, y: my }, i) => {
    const st = arrowStyle(m.style, m.status);
    const x1 = cx.get(m.from), x2 = cx.get(m.to);
    let points, lx, align = "center";
    if (m.from === m.to) {
      points = [[x1, my], [x1 + 44, my], [x1 + 44, my + 26], [x1 + 4, my + 26]];
      lx = x1 + 54; align = "left";
    } else {
      const dir = Math.sign(x2 - x1);
      points = [[x1 + dir * 2, my], [x2 - dir * 4, my]];
      lx = (x1 + x2) / 2;
    }
    const g = c.key(`msg-group-${i}`);
    c.add({ kind: "arrow", key: c.key(`msg-${i}`), points, stroke: st.stroke, strokeWidth: st.strokeWidth, dash: st.dash, head: st.head, group: g, curved: false });
    const ty = m.from === m.to ? my + 4 : my - SMALL * LINE - 5;
    const t = c.text([m.label], SMALL, st.textColor ?? INK, lx, ty, { align, group: g });
    if (align === "center") t.x -= t.w / 2;
    if (m.id) c.anchors[m.id] = [{ x: t.x + t.w + 16, y: t.y - 4, dir: 1 }];
  });
  return c;
}

// Markers carry no link: Excalidraw draws a link icon on every linked element. The names in the key link to the notes.
function badge(c, n, x, y) {
  const key = c.key(`badge-${n}-${x | 0}-${y | 0}`);
  c.add({ kind: "ellipse", key, x: x - 12, y: y - 12, w: 24, h: 24, stroke: ACCENT, strokeWidth: 1, fill: ACCENT, dash: "solid", rough: 0.5 });
  const t = c.text([String(n)], 14, PAPER, x, y - (14 * LINE) / 2, { align: "center", container: key });
  t.x -= t.w / 2;
}

/**
 * Lay out a commit: title, one framed view per system-design model, numbered concept markers on the parts
 * where each concept lives, and a key beside the diagrams. Returns primitives both writers draw.
 */
export function buildScene(record, { newIds = new Set(), noteLink = () => null } = {}) {
  const c = new Canvas(record.commit ?? "scene");
  c.text(wrap(record.title, 28, 900), 28, INK, 0, 0, { name: "title" });
  c.text([String(record.commitLine ?? "").replace(/`/g, "")], SMALL, MUTED, 0, 28 * LINE * wrap(record.title, 28, 900).length + 6, { name: "commit" });
  let y = c.bounds().y1 + 64;

  const number = new Map(record.concepts.map((cpt, i) => [cpt.id, i + 1]));
  const used = { status: new Set(), edges: new Set() };
  let right = 0;

  record.views.forEach((view, vi) => {
    const vc = view.type === "sequence" ? layoutSequence(view, `${c.prefix}:v${vi}`) : layoutGraph(view, `${c.prefix}:v${vi}`);
    for (const cpt of record.concepts) {
      for (const ref of cpt.appearsIn) {
        const spot = vc.anchors[ref]?.[0];
        if (!spot) continue;
        badge(vc, number.get(cpt.id), spot.x, spot.y);
        spot.x += 28 * spot.dir;
      }
    }
    if (view.type === "sequence") {
      view.participants.forEach((p) => used.status.add(p.status));
      view.messages.forEach((m) => { used.status.add(m.status); used.edges.add(m.style); });
    } else {
      view.nodes.forEach((n) => used.status.add(n.status));
      view.edges.forEach((e) => { used.status.add(e.status); used.edges.add(e.style); });
    }
    const b = vc.bounds();
    const pad = 36;
    vc.shift(pad - b.x0, y + pad - b.y0);
    const frameKey = c.key(`frame-${vi}`);
    const frame = { kind: "frame", key: frameKey, name: view.title, x: 0, y, w: b.w + pad * 2, h: b.h + pad * 2 };
    c.add(frame);
    for (const it of vc.items) { it.frame = frameKey; c.add(it); }
    right = Math.max(right, frame.w);
    y += frame.h + 70;
  });
  const diagramBottom = y - 70;

  // The key: concept names beside the diagrams (explanations live in the README and notes), then line and outline meanings.
  const px = right + 64;
  let py = c.bounds().y0 + 92;
  c.text(["Concepts"], 20, INK, px, py, { name: "key-title" });
  py += 40;
  for (const cpt of record.concepts) {
    badge(c, number.get(cpt.id), px + 12, py + 11);
    const name = c.text(wrap(cpt.name, 17, 250), 17, INK, px + 34, py, { link: noteLink(cpt) });
    py += name.h + 2;
    const meta = c.text([`${cpt.kind.replace(/-/g, " ")} · ${cpt.level}`], 13, MUTED, px + 34, py);
    if (newIds.has(cpt.id)) c.text(["NEW"], 13, ACCENT, px + 34 + meta.w + 10, py);
    py += meta.h + 14;
  }
  py += 16;
  const keyRows = [];
  for (const s of ["new", "changed", "existing"]) if (used.status.has(s)) keyRows.push({ status: s, word: { new: "added in this commit", changed: "changed in this commit", existing: "already there" }[s] });
  for (const e of ["sync", "async", "data", "dependency", "reply"]) if (used.edges.has(e)) keyRows.push({ edge: e, word: EDGE[e].word });
  if (keyRows.length) {
    c.text(["Key"], 14, MUTED, px, py);
    py += 26;
    for (const row of keyRows) {
      if (row.status) {
        const st = look(row.status, FILL.service);
        c.add({ kind: "rect", key: c.key(`key-${row.status}`), x: px, y: py, w: 34, h: 20, stroke: st.stroke, strokeWidth: st.strokeWidth, fill: st.fill, dash: "solid", rounded: true });
      } else {
        const st = EDGE[row.edge];
        c.add({ kind: "arrow", key: c.key(`key-${row.edge}`), points: [[px, py + 10], [px + 34, py + 10]], stroke: INK, strokeWidth: 1.5, dash: st.dash, head: st.head });
      }
      c.text([row.word], 13, MUTED, px + 46, py + 2);
      py += 30;
    }
  }
  const b = c.bounds();
  return { width: b.x1, height: Math.max(b.y1, diagramBottom), items: c.items };
}
