import rough from "roughjs";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { ACCENT, FONT, INK, KIND_COLORS, MUTED, textWidth } from "./scene.js";

const FONT_STACK = "'Concepts Hand', Virgil, 'Segoe Print', 'Comic Sans MS', cursive";
// Embedded so the hand-drawn look survives anywhere the SVG goes (GitHub renders SVGs with no external fonts).
const FONT_DATA = readFileSync(new URL("../fonts/ConceptsHand.woff2", import.meta.url)).toString("base64");
const FONT_FACE = `<defs><style>@font-face{font-family:"Concepts Hand";src:url(data:font/woff2;base64,${FONT_DATA}) format("woff2");}</style></defs>`;
const MARGIN = 40;

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const seedOf = (key) => createHash("sha256").update(key).digest().readUInt32BE(0) % 2 ** 31;

function paths(gen, drawable) {
  return gen.toPaths(drawable).map((p) => `<path d="${p.d}" stroke="${p.stroke}" stroke-width="${p.strokeWidth}" fill="${p.fill ?? "none"}"/>`).join("");
}

function roundedRect(x, y, w, h, r = 14) {
  return `M${x + r} ${y} L${x + w - r} ${y} Q${x + w} ${y} ${x + w} ${y + r} L${x + w} ${y + h - r} Q${x + w} ${y + h} ${x + w - r} ${y + h} L${x + r} ${y + h} Q${x} ${y + h} ${x} ${y + h - r} L${x} ${y + r} Q${x} ${y} ${x + r} ${y} Z`;
}

function textEl(lines, size, color, x, y, anchor = "start") {
  const spans = lines.map((l, i) => `<tspan x="${x}" dy="${i === 0 ? size : size * 1.25}">${esc(l)}</tspan>`).join("");
  return `<text x="${x}" y="${y}" font-size="${size}" fill="${color}" text-anchor="${anchor}">${spans}</text>`;
}

/** A hand-drawn SVG preview of the same scene, for GitHub, READMEs and anywhere .excalidraw doesn't open. */
export function toSvg(scene, key) {
  const gen = rough.generator();
  const out = [];
  for (const s of scene.shapes) out.push(textEl(s.lines, s.size, s.color, s.x, s.y));

  scene.edges.forEach((e, i) => {
    const seed = seedOf(`${key}:edge:${i}`);
    const pts = e.points;
    out.push(paths(gen, pts.length > 2 ? gen.curve(pts, { seed, stroke: INK, strokeWidth: 1.6, roughness: 1 }) : gen.linearPath(pts, { seed, stroke: INK, strokeWidth: 1.6, roughness: 1 })));
    const [ax, ay] = pts[pts.length - 2];
    const [bx, by] = pts[pts.length - 1];
    const angle = Math.atan2(by - ay, bx - ax);
    for (const side of [-1, 1]) {
      const hx = bx - 14 * Math.cos(angle + side * 0.45);
      const hy = by - 14 * Math.sin(angle + side * 0.45);
      out.push(paths(gen, gen.line(bx, by, hx, hy, { seed: seed + side + 2, stroke: INK, strokeWidth: 1.6, roughness: 0.8 })));
    }
    const lw = textWidth(e.label, FONT.edge);
    out.push(`<rect x="${e.labelX - lw / 2 - 6}" y="${e.labelY - FONT.edge * 0.8}" width="${lw + 12}" height="${FONT.edge * 1.6}" rx="4" fill="#ffffff"/>`);
    out.push(`<text x="${e.labelX}" y="${e.labelY + FONT.edge * 0.35}" font-size="${FONT.edge}" fill="${MUTED}" text-anchor="middle">${esc(e.label)}</text>`);
  });

  for (const n of scene.nodes) {
    const seed = seedOf(`${key}:node:${n.concept.id}`);
    const shape = gen.path(roundedRect(n.x, n.y, n.width, n.height), {
      seed, fill: KIND_COLORS[n.concept.kind], fillStyle: "solid", stroke: INK, strokeWidth: 1.8, roughness: 1,
    });
    let body = paths(gen, shape);
    let y = n.y + 16;
    body += textEl(n.nameLines, FONT.name, INK, n.x + 16, y);
    y += n.nameLines.length * FONT.name * 1.25 + 6;
    body += textEl([n.meta], FONT.meta, n.isNew ? ACCENT : MUTED, n.x + 16, y);
    y += FONT.meta * 1.25 + 10;
    body += textEl(n.bodyLines, FONT.small, INK, n.x + 16, y);
    out.push(n.link ? `<a href="${esc(n.link)}">${body}</a>` : `<g>${body}</g>`);
  }

  for (const item of scene.legend) {
    if (item.color) {
      out.push(paths(gen, gen.rectangle(item.x, item.y, 20, 16, { seed: seedOf(item.kind), fill: item.color, fillStyle: "solid", stroke: INK, strokeWidth: 1, roughness: 0.8 })));
      out.push(textEl([item.label], FONT.meta, MUTED, item.x + 28, item.y));
    } else out.push(textEl([item.label], FONT.meta, ACCENT, item.x, item.y));
  }

  const w = Math.ceil(scene.width + MARGIN * 2);
  const h = Math.ceil(scene.height + MARGIN * 2);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${-MARGIN} ${-MARGIN} ${w} ${h}" font-family="${esc(FONT_STACK)}">
${FONT_FACE}
<rect x="${-MARGIN}" y="${-MARGIN}" width="${w}" height="${h}" fill="#ffffff"/>
${out.join("\n")}
</svg>
`;
}
