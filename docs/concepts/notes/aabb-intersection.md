# Bounding-box intersection

_algorithm · beginner_

Two axis-aligned rectangles overlap only if they overlap on both the x axis and the y axis. The overlap on each axis is min(right edges) − max(left edges).

## Where it showed up (1)

### 2026-11-06 · [Making room between boundaries](../commits/2026-11-06-5d04c47-making-room-between-boundaries/README.md) · `5d04c47`

It detects colliding boundaries, and the smaller of the two overlaps is the cheapest direction to push them apart.

Files: `packages/concepts-mcp/src/scene.js:separateGroups`

## My notes

<!-- Your own notes below this line are kept when this file is regenerated. -->

