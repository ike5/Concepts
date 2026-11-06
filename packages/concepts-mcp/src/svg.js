import rough from "roughjs";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { MUTED } from "./scene.js";

const FONT_STACK = "'Concepts Hand', Virgil, 'Segoe Print', 'Comic Sans MS', cursive";
// Embedded so the hand-drawn look survives anywhere the SVG goes (GitHub renders SVGs with no external fonts).
const FONT_DATA = readFileSync(new URL("../fonts/ConceptsHand.woff2", import.meta.url)).toString("base64");
const FONT_FACE = `<defs><style>@font-face{font-family:"Concepts Hand";src:url(data:font/woff2;base64,${FONT_DATA}) format("woff2");}</style></defs>`;
const MARGIN = 40;
const DASH = { solid: undefined, dashed: [10, 7], dotted: [2, 6] };

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const seedOf = (key) => createHash("sha256").update(key).digest().readUInt32BE(0) % 2 ** 31;

function roundedRect(x, y, w, h, r = 12) {
  r = Math.min(r, w / 2, h / 2);
  return `M${x + r} ${y} L${x + w - r} ${y} Q${x + w} ${y} ${x + w} ${y + r} L${x + w} ${y + h - r} Q${x + w} ${y + h} ${x + w - r} ${y + h} L${x + r} ${y + h} Q${x} ${y + h} ${x} ${y + h - r} L${x} ${y + r} Q${x} ${y} ${x + r} ${y} Z`;
}

/** A hand-drawn SVG of the same scene, for GitHub, READMEs and anywhere .excalidraw doesn't open. */
export function toSvg(scene) {
  const gen = rough.generator();
  const draw = (drawable) => gen.toPaths(drawable).map((p) => `<path d="${p.d}" stroke="${p.stroke}" stroke-width="${p.strokeWidth}" fill="${p.fill ?? "none"}"${drawable.options.strokeLineDash && p.fill === "none" ? ` stroke-dasharray="${drawable.options.strokeLineDash.join(" ")}"` : ""}/>`).join("");
  const opts = (it) => {
    const o = { seed: seedOf(it.key), roughness: it.rough ?? 1, stroke: it.stroke === "transparent" ? "none" : it.stroke, strokeWidth: it.strokeWidth ?? 1 };
    if (it.fill && it.fill !== "transparent") Object.assign(o, { fill: it.fill, fillStyle: "solid" });
    if (DASH[it.dash]) Object.assign(o, { strokeLineDash: DASH[it.dash], disableMultiStroke: true });
    return o;
  };
  const back = [];
  const out = [];
  for (const it of scene.items) {
    let svg = "";
    switch (it.kind) {
      case "frame":
        back.push(`<rect x="${it.x}" y="${it.y}" width="${it.w}" height="${it.h}" rx="10" fill="none" stroke="#d0d0d0" stroke-width="1.5"/><text x="${it.x + 4}" y="${it.y - 10}" font-size="15" fill="${MUTED}">${esc(it.name)}</text>`);
        continue;
      case "rect":
        svg = draw(it.rounded ? gen.path(roundedRect(it.x, it.y, it.w, it.h), opts(it)) : gen.rectangle(it.x, it.y, it.w, it.h, opts(it)));
        break;
      case "ellipse":
        svg = draw(gen.ellipse(it.x + it.w / 2, it.y + it.h / 2, it.w, it.h, opts(it)));
        break;
      case "diamond":
        svg = draw(gen.polygon([[it.x + it.w / 2, it.y], [it.x + it.w, it.y + it.h / 2], [it.x + it.w / 2, it.y + it.h], [it.x, it.y + it.h / 2]], opts(it)));
        break;
      case "line":
        svg = draw(gen.linearPath(it.points, opts(it)));
        break;
      case "arrow": {
        const o = opts(it);
        svg = draw(it.curved ? gen.curve(it.points, o) : gen.linearPath(it.points, o));
        const [ax, ay] = it.points[it.points.length - 2];
        const [bx, by] = it.points[it.points.length - 1];
        const angle = Math.atan2(by - ay, bx - ax);
        const wing = (side) => [bx - 13 * Math.cos(angle + side * 0.42), by - 13 * Math.sin(angle + side * 0.42)];
        const head = { seed: o.seed + 1, roughness: 0.6, stroke: o.stroke, strokeWidth: o.strokeWidth };
        if (it.head === "triangle") svg += draw(gen.polygon([[bx, by], wing(-1), wing(1)], { ...head, fill: o.stroke, fillStyle: "solid" }));
        else for (const side of [-1, 1]) svg += draw(gen.line(bx, by, ...wing(side), head));
        break;
      }
      case "text": {
        const anchor = it.align === "center" ? "middle" : "start";
        const x = it.align === "center" ? it.x + it.w / 2 : it.x;
        if (it.background) svg += `<rect x="${it.x - 5}" y="${it.y - 2}" width="${it.w + 10}" height="${it.h + 4}" rx="4" fill="#ffffff"/>`;
        const spans = it.lines.map((l, i) => `<tspan x="${x}" dy="${i === 0 ? it.size : it.size * 1.25}">${esc(l)}</tspan>`).join("");
        svg += `<text x="${x}" y="${it.y}" font-size="${it.size}" fill="${it.color}" text-anchor="${anchor}">${spans}</text>`;
        break;
      }
    }
    out.push(it.link ? `<a href="${esc(it.link)}">${svg}</a>` : svg);
  }
  const w = Math.ceil(scene.width + MARGIN * 2);
  const h = Math.ceil(scene.height + MARGIN * 2);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${-MARGIN} ${-MARGIN} ${w} ${h}" font-family="${esc(FONT_STACK)}">
${FONT_FACE}
<rect x="${-MARGIN}" y="${-MARGIN}" width="${w}" height="${h}" fill="#ffffff"/>
${back.join("\n")}
${out.join("\n")}
</svg>
`;
}
