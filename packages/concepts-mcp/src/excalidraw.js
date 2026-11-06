import { createHash } from "node:crypto";

const VIRGIL = 1;
const HEADS = { arrow: "arrow", triangle: "triangle" };

// Deterministic ids and seeds, so re-rendering the same commit produces the same file.
function seeded(key) {
  const hash = createHash("sha256").update(key).digest();
  return { id: hash.toString("base64url").slice(0, 20), seed: hash.readUInt32BE(0) % 2 ** 31, nonce: hash.readUInt32BE(4) % 2 ** 31 };
}

function bbox(points) {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
}

/** Serialize scene primitives to .excalidraw JSON (opens in excalidraw.com, Obsidian and the VS Code extension). */
export function toExcalidraw(scene) {
  const id = (k) => seeded(k).id;
  const elements = [];
  const frames = [];
  const byKey = new Map();
  for (const it of scene.items) {
    const { seed, nonce } = seeded(it.key);
    const el = {
      id: id(it.key), type: "rectangle", x: it.x ?? 0, y: it.y ?? 0, width: it.w ?? 0, height: it.h ?? 0, angle: 0,
      strokeColor: it.stroke ?? it.color ?? "#1e1e1e", backgroundColor: it.fill ?? "transparent", fillStyle: "solid",
      strokeWidth: it.strokeWidth ?? 1, strokeStyle: it.dash ?? "solid", roughness: it.rough ?? 1, opacity: 100,
      groupIds: it.group ? [id(it.group)] : [], frameId: it.frame ? id(it.frame) : null, roundness: null,
      seed, version: 1, versionNonce: nonce, isDeleted: false, boundElements: null, updated: 1, link: it.link ?? null, locked: false,
    };
    if (it.kind === "rect") { if (it.rounded) el.roundness = { type: 3 }; }
    else if (it.kind === "ellipse") el.type = "ellipse";
    else if (it.kind === "diamond") { el.type = "diamond"; el.roundness = { type: 2 }; }
    else if (it.kind === "line" || it.kind === "arrow") {
      const [x0, y0] = it.points[0];
      const { w, h } = bbox(it.points);
      Object.assign(el, {
        type: it.kind, x: x0, y: y0, width: w, height: h, points: it.points.map(([x, y]) => [x - x0, y - y0]),
        lastCommittedPoint: null, startArrowhead: null, endArrowhead: it.kind === "arrow" ? HEADS[it.head] ?? "arrow" : null,
        startBinding: null, endBinding: null, roundness: it.curved ? { type: 2 } : null,
      });
      if (it.kind === "arrow") el.elbowed = false;
      if (it.kind === "line") el.polygon = false;
    } else if (it.kind === "text") {
      const value = it.lines.join("\n");
      Object.assign(el, {
        type: "text", strokeColor: it.color, backgroundColor: "transparent", text: value, originalText: value, fontSize: it.size,
        fontFamily: VIRGIL, textAlign: it.align ?? "left", verticalAlign: it.container ? "middle" : "top",
        containerId: it.container ? id(it.container) : null, autoResize: true, lineHeight: 1.25,
      });
    } else if (it.kind === "frame") {
      Object.assign(el, { type: "frame", name: it.name, strokeColor: "#bbb", strokeWidth: 2, roughness: 0, frameId: null });
      frames.push(el);
      byKey.set(it.key, el);
      continue;
    }
    elements.push(el);
    byKey.set(it.key, el);
  }

  // Wire up bindings both ways, as Excalidraw expects: text ↔ container, arrow ↔ the shapes it connects.
  const bindTo = (target, entry) => { target.boundElements = [...(target.boundElements ?? []), entry]; };
  for (const it of scene.items) {
    const el = byKey.get(it.key);
    if (it.kind === "text" && it.container && byKey.has(it.container)) bindTo(byKey.get(it.container), { type: "text", id: el.id });
    if (it.kind === "arrow") {
      for (const [end, prop] of [[it.start, "startBinding"], [it.end, "endBinding"]]) {
        const target = end && byKey.get(end);
        if (!target) continue;
        el[prop] = { elementId: target.id, focus: 0, gap: 4 };
        bindTo(target, { type: "arrow", id: el.id });
      }
    }
  }
  return {
    type: "excalidraw",
    version: 2,
    source: "https://github.com/ike5/concepts",
    // Frames go after their children, the order Excalidraw itself saves.
    elements: [...elements, ...frames],
    appState: { viewBackgroundColor: "#ffffff", gridSize: null, currentItemFontFamily: VIRGIL },
    files: {},
  };
}
