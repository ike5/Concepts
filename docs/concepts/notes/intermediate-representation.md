# Intermediate representation

_architecture · intermediate_

A neutral in-between format that one stage produces and several back ends consume, like a compiler's IR. Each back end only needs to understand the simple format, not the stage before it.

## Where it showed up (1)

### 2026-11-06 · [Diagrams become system-design models](../commits/2026-11-06-26af3fb-diagrams-become-system-design-models/README.md) · `26af3fb`

Layout emits a flat list of rectangles, ellipses, lines, arrows and text; the Excalidraw and SVG writers both draw exactly that list, so they can't drift apart.

Files: `packages/concepts-mcp/src/scene.js:Canvas`, `packages/concepts-mcp/src/excalidraw.js`, `packages/concepts-mcp/src/svg.js`

## My notes

<!-- Your own notes below this line are kept when this file is regenerated. -->

