import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildScene, textWidth, wrap } from "../src/scene.js";
import { toExcalidraw } from "../src/excalidraw.js";
import { toSvg } from "../src/svg.js";

const example = JSON.parse(await readFile(new URL("../examples/commit.json", import.meta.url), "utf8"));
const record = { ...example, commitLine: "`3f9c2ab` · 2026-11-06 · Retry webhooks" };

test("wrap keeps every line inside the width, splitting words that are too long", () => {
  const lines = wrap("Supercalifragilisticexpialidocious words and a normal sentence that keeps going for a while", 14, 120);
  for (const line of lines) assert.ok(textWidth(line, 14) <= 120, line);
  assert.equal(lines.join("").replace(/-/g, "").replace(/ /g, ""), "Supercalifragilisticexpialidociouswordsandanormalsentencethatkeepsgoingforawhile");
});

test("boxes don't overlap and every edge starts and ends on a box border", () => {
  const scene = buildScene(record, { newIds: new Set(["jitter"]) });
  const boxes = scene.nodes;
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], b = boxes[j];
    const overlap = a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
    assert.ok(!overlap, `${a.concept.id} overlaps ${b.concept.id}`);
  }
  const onBorder = ([x, y], n) => (Math.abs(x - n.x) < 1 || Math.abs(x - n.x - n.width) < 1 || Math.abs(y - n.y) < 1 || Math.abs(y - n.y - n.height) < 1);
  const byId = new Map(boxes.map((n) => [n.concept.id, n]));
  for (const e of scene.edges) {
    assert.ok(onBorder(e.points[0], byId.get(e.from)), `edge ${e.from}→${e.to} start`);
    assert.ok(onBorder(e.points.at(-1), byId.get(e.to)), `edge ${e.from}→${e.to} end`);
  }
});

test("concepts without relations are laid out in a grid, not one long row", () => {
  const loose = { ...record, relations: [], concepts: [...record.concepts, ...record.concepts.map((c) => ({ ...c, id: `${c.id}-2` }))] };
  const scene = buildScene(loose);
  assert.ok(scene.width < 1100, `width ${scene.width}`);
});

test(".excalidraw output is internally consistent", () => {
  const file = toExcalidraw(buildScene(record, { noteLink: (c) => `../../notes/${c.id}.md` }), "abc");
  assert.equal(file.type, "excalidraw");
  assert.equal(file.version, 2);
  const byId = new Map(file.elements.map((e) => [e.id, e]));
  assert.equal(byId.size, file.elements.length, "element ids are unique");
  for (const el of file.elements) {
    for (const b of el.boundElements ?? []) assert.ok(byId.has(b.id), `${el.id} binds missing ${b.id}`);
    if (el.containerId) assert.ok(byId.get(el.containerId).boundElements.some((b) => b.id === el.id), "label is bound back");
    if (el.type === "arrow") {
      for (const binding of [el.startBinding, el.endBinding]) {
        const target = byId.get(binding.elementId);
        assert.equal(target.type, "rectangle");
        assert.ok(target.boundElements.some((b) => b.id === el.id), "box lists its arrow");
      }
      assert.deepEqual(el.points[0], [0, 0]);
    }
  }
  const rects = file.elements.filter((e) => e.type === "rectangle" && e.link);
  assert.equal(rects.length, record.concepts.length);
  // Same input, same file: ids and seeds are derived from the commit.
  assert.deepEqual(toExcalidraw(buildScene(record), "abc").elements.map((e) => e.id), toExcalidraw(buildScene(record), "abc").elements.map((e) => e.id));
});

test("SVG escapes text and embeds the font", () => {
  const hostile = { ...record, title: '</text><script>alert("x")</script>', concepts: record.concepts.map((c, i) => (i ? c : { ...c, name: "<b>&" })) };
  const svg = toSvg(buildScene(hostile), "abc");
  assert.ok(!svg.includes("<script>"));
  assert.match(svg, /&lt;script&gt;/);
  assert.match(svg, /&lt;b&gt;&amp;/);
  assert.match(svg, /@font-face\{font-family:"Concepts Hand";src:url\(data:font\/woff2;base64,/);
});
