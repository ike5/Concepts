# Iterate until stable

_algorithm · beginner_

Repeat a fixing step until a pass changes nothing, with a cap on passes so it always ends. Fixing one problem can create another, so a single pass isn't enough.

## Where it showed up (1)

### 2026-11-06 · [Making room between boundaries](../commits/2026-11-06-5d04c47-making-room-between-boundaries/README.md) · `5d04c47`

Opening one gap can make other boxes collide, so the check runs again, at most 40 times.

Files: `packages/concepts-mcp/src/scene.js:separateGroups`

## My notes

<!-- Your own notes below this line are kept when this file is regenerated. -->

