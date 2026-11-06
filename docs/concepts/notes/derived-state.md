# Derived vs stored state

_pattern · intermediate_

If a value can be computed cheaply from data you already have, compute it when needed instead of saving it. Stored copies can go stale and every write has side effects.

## Where it showed up (1)

### 2026-11-06 · [Breaking a commit feedback loop](../commits/2026-11-06-dbab40a-breaking-a-commit-feedback-loop/README.md) · `dbab40a`

Whether a commit only touched setup files is a fact about the commit, so it is now recomputed on every call.

Files: `packages/concepts-mcp/src/core.js:pending`

## My notes

<!-- Your own notes below this line are kept when this file is regenerated. -->

