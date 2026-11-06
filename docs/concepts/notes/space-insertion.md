# Overlap removal by inserting space

_algorithm · intermediate_

To separate two things without wrecking a layout, draw a line between them and move everything beyond the line by the same amount. Relative order is kept, so the picture only stretches.

**Learn first:** Bounding-box intersection

## Where it showed up (1)

### 2026-11-06 · [Making room between boundaries](../commits/2026-11-06-5d04c47-making-room-between-boundaries/README.md) · `5d04c47`

Parts, edge routes and labels past the cut all move together; each arrow's ends follow their own node so arrows stay attached.

Files: `packages/concepts-mcp/src/scene.js:separateGroups`

## My notes

<!-- Your own notes below this line are kept when this file is regenerated. -->

