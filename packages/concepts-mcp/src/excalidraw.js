import { createHash } from "node:crypto";
import { ACCENT, FONT, INK, KIND_COLORS, MUTED, textWidth } from "./scene.js";

const VIRGIL = 1;

// Deterministic ids and seeds, so re-rendering the same commit produces the same file.
function seeded(key) {
  const hash = createHash("sha256").update(key).digest();
  return { id: hash.toString("base64url").slice(0, 20), seed: hash.readUInt32BE(0) % 2 ** 31, nonce: hash.readUInt32BE(4) % 2 ** 31 };
}

function base(key, type, props) {
  const { id, seed, nonce } = seeded(key);
  return {
    id, type, x: 0, y: 0, width: 0, height: 0, angle: 0,
    strokeColor: INK, backgroundColor: "transparent", fillStyle: "solid", strokeWidth: 2, strokeStyle: "solid",
    roughness: 1, opacity: 100, groupIds: [], frameId: null, roundness: null, seed, version: 1, versionNonce: nonce,
    isDeleted: false, boundElements: null, updated: 1, link: null, locked: false, ...props,
  };
}

function text(key, lines, size, color, x, y, extra = {}) {
  const value = lines.join("\n");
  return base(key, "text", {
    x, y, width: Math.max(1, ...lines.map((l) => textWidth(l, size))), height: lines.length * size * 1.25, strokeColor: color,
    text: value, originalText: value, fontSize: size, fontFamily: VIRGIL, textAlign: "left", verticalAlign: "top",
    containerId: null, autoResize: true, lineHeight: 1.25, ...extra,
  });
}

/** Serialize a scene to the .excalidraw JSON format (opens in excalidraw.com, Obsidian and the VS Code extension). */
export function toExcalidraw(scene, key) {
  const elements = [];
  for (const s of scene.shapes) elements.push(text(`${key}:${s.role}`, s.lines, s.size, s.color, s.x, s.y));

  const rectIds = new Map();
  for (const n of scene.nodes) {
    const k = `${key}:node:${n.concept.id}`;
    const group = seeded(`${k}:group`).id;
    const rect = base(k, "rectangle", {
      x: n.x, y: n.y, width: n.width, height: n.height, backgroundColor: KIND_COLORS[n.concept.kind],
      roundness: { type: 3 }, groupIds: [group], boundElements: [], link: n.link,
    });
    rectIds.set(n.concept.id, rect);
    elements.push(rect);
    let y = n.y + 16;
    const name = text(`${k}:name`, n.nameLines, FONT.name, INK, n.x + 16, y, { groupIds: [group] });
    y += name.height + 6;
        const meta = text(`${k}:meta`, [n.meta], FONT.meta, n.isNew ? ACCENT : MUTED, n.x + 16, y, { groupIds: [group] });
    y += meta.height + 10;
    const body = text(`${k}:body`, n.bodyLines, FONT.small, INK, n.x + 16, y, { groupIds: [group] });
    elements.push(name, meta, body);
  }

  scene.edges.forEach((e, i) => {
    const k = `${key}:edge:${i}`;
    const [x0, y0] = e.points[0];
    const points = e.points.map(([x, y]) => [x - x0, y - y0]);
    const xs = points.map((p) => p[0]);
    const ys = points.map((p) => p[1]);
    const from = rectIds.get(e.from);
    const to = rectIds.get(e.to);
    const arrow = base(k, "arrow", {
      x: x0, y: y0, width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys),
      roundness: { type: 2 }, points, lastCommittedPoint: null, startArrowhead: null, endArrowhead: "arrow", elbowed: false,
      startBinding: { elementId: from.id, focus: 0, gap: 6 }, endBinding: { elementId: to.id, focus: 0, gap: 6 }, boundElements: [],
    });
    const w = textWidth(e.label, FONT.edge);
    const label = text(`${k}:label`, [e.label], FONT.edge, MUTED, e.labelX - w / 2, e.labelY - (FONT.edge * 1.25) / 2, {
      containerId: arrow.id, textAlign: "center", verticalAlign: "middle",
    });
    arrow.boundElements.push({ type: "text", id: label.id });
    from.boundElements.push({ type: "arrow", id: arrow.id });
    to.boundElements.push({ type: "arrow", id: arrow.id });
    elements.push(arrow, label);
  });

  for (const item of scene.legend) {
    const k = `${key}:legend:${item.kind}`;
    if (item.color) {
      elements.push(base(`${k}:swatch`, "rectangle", { x: item.x, y: item.y, width: 20, height: 16, backgroundColor: item.color, strokeWidth: 1, roundness: { type: 3 } }));
      elements.push(text(`${k}:text`, [item.label], FONT.meta, MUTED, item.x + 28, item.y));
    } else {
      elements.push(text(`${k}:text`, [item.label], FONT.meta, ACCENT, item.x, item.y));
    }
  }

  return {
    type: "excalidraw",
    version: 2,
    source: "https://github.com/ike5/concepts",
    elements,
    appState: { viewBackgroundColor: "#ffffff", gridSize: null, currentItemFontFamily: VIRGIL },
    files: {},
  };
}
