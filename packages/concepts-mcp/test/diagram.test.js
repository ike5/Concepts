import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildScene, textWidth, wrap } from "../src/scene.js";
import { toExcalidraw } from "../src/excalidraw.js";
import { toSvg } from "../src/svg.js";
import { checkRecord, recordSchema } from "../src/schema.js";

const example = recordSchema.parse(JSON.parse(await readFile(new URL("../examples/commit.json", import.meta.url), "utf8")));
const record = { ...example, commitLine: "`3f9c2ab` · 2026-11-06 · Retry webhooks" };
const scene = (r = record, opts = {}) => buildScene(r, { noteLink: (c) => `../../notes/${c.id}.md`, ...opts });

test("the example is valid", () => {
  assert.deepEqual(checkRecord(example), []);
});

test("wrap keeps every line inside the width, splitting words that are too long", () => {
  const lines = wrap("Supercalifragilisticexpialidocious words and a normal sentence that keeps going", 14, 120);
  for (const line of lines) assert.ok(textWidth(line, 14) <= 120, line);
});

test("nodes in a view don't overlap", () => {
  const { items } = scene();
  for (const frame of items.filter((i) => i.kind === "frame")) {
    const bodies = items.filter((i) => i.frame === frame.key && /:node-/.test(i.key));
    for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i], b = bodies[j];
      assert.ok(!(a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h), `${a.key} overlaps ${b.key}`);
    }
  }
});

test("each view sits in its own frame, below the previous one, with every part inside it", () => {
  const { items } = scene();
  const frames = items.filter((i) => i.kind === "frame");
  assert.deepEqual(frames.map((f) => f.name), ["Where delivery lives now", "One failed attempt"]);
  assert.ok(frames[1].y > frames[0].y + frames[0].h);
  for (const it of items.filter((i) => i.frame)) {
    const f = frames.find((fr) => fr.key === it.frame);
    const pts = it.points ?? [[it.x, it.y], [it.x + it.w, it.y + it.h]];
    for (const [x, y] of pts) assert.ok(x >= f.x - 1 && x <= f.x + f.w + 1 && y >= f.y - 1 && y <= f.y + f.h + 1, `${it.key} outside ${f.name}`);
  }
});

test("every appearsIn reference gets a numbered marker, and the key lists concepts in order", () => {
  const { items } = scene();
  const markers = items.filter((i) => i.kind === "ellipse" && i.frame && /:badge-/.test(i.key));
  const expected = example.concepts.reduce((n, c) => n + c.appearsIn.length, 0);
  assert.equal(markers.length, expected);
  const keyNames = items.filter((i) => i.kind === "text" && !i.frame && i.link).map((i) => i.lines.join(" "));
  assert.deepEqual(keyNames, example.concepts.map((c) => c.name));
});

test("the diagram itself carries no explanations: those stay in the README", () => {
  const { items } = scene();
  const inFrames = items.filter((i) => i.kind === "text" && i.frame).map((i) => i.lines.join(" "));
  for (const c of example.concepts) assert.ok(!inFrames.some((t) => t.includes(c.explanation.slice(0, 30))), c.id);
});

test(".excalidraw output is internally consistent", () => {
  const file = toExcalidraw(scene());
  assert.equal(file.type, "excalidraw");
  const byId = new Map(file.elements.map((e) => [e.id, e]));
  assert.equal(byId.size, file.elements.length, "element ids are unique");
  for (const el of file.elements) {
    for (const b of el.boundElements ?? []) assert.ok(byId.has(b.id), `${el.id} binds missing ${b.id}`);
    if (el.containerId) assert.ok(byId.get(el.containerId).boundElements.some((b) => b.id === el.id), "text is bound back");
    if (el.frameId) assert.equal(byId.get(el.frameId).type, "frame");
    for (const binding of [el.startBinding, el.endBinding].filter(Boolean)) {
      assert.ok(byId.get(binding.elementId).boundElements.some((b) => b.id === el.id), "shape lists its arrow");
    }
    if (el.points) assert.deepEqual(el.points[0], [0, 0]);
  }
  assert.deepEqual(toExcalidraw(scene()).elements.map((e) => e.id), file.elements.map((e) => e.id), "same input, same ids");
});

test("large commits scale: many nodes and concepts still lay out", () => {
  const nodes = Array.from({ length: 30 }, (_, i) => ({ id: `n${i}`, label: `Part ${i}`, shape: i % 3 ? "service" : "database", status: "new" }));
  const big = recordSchema.parse({
    commit: "abcdef1", title: "Big", summary: "Big.",
    views: [{ type: "architecture", title: "All", nodes, edges: nodes.slice(1).map((n, i) => ({ id: `e${i}`, from: `n${i}`, to: n.id })) }],
    concepts: Array.from({ length: 25 }, (_, i) => ({ id: `c${i}`, name: `Concept ${i}`, kind: "pattern", level: "beginner", appearsIn: [`n${i}`], explanation: "x", whyHere: "y" })),
  });
  assert.deepEqual(checkRecord(big), []);
  assert.ok(toSvg(scene({ ...big, commitLine: "" })).length > 1000);
});

test("SVG escapes text and embeds the font", () => {
  const hostile = { ...record, title: '</text><script>alert("x")</script>' };
  const svg = toSvg(scene(hostile));
  assert.ok(!svg.includes("<script>"));
  assert.match(svg, /&lt;script&gt;/);
  assert.match(svg, /@font-face\{font-family:"Concepts Hand";src:url\(data:font\/woff2;base64,/);
});

test("checkRecord catches dangling references", () => {
  const bad = recordSchema.parse({
    commit: "abcdef1", title: "t", summary: "s",
    views: [{ type: "architecture", title: "v", nodes: [{ id: "a", label: "A", shape: "service", group: "nope" }], edges: [{ from: "a", to: "b" }] }],
    concepts: [{ id: "x", name: "X", kind: "pattern", level: "beginner", appearsIn: ["ghost"], explanation: "e", whyHere: "w" }],
  });
  const problems = checkRecord(bad).join("\n");
  assert.match(problems, /group "nope"/);
  assert.match(problems, /refers to "b"/);
  assert.match(problems, /appears in "ghost"/);
});
