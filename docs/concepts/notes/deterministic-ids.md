# Deterministic ids from hashes

_pattern · intermediate_

Derive ids and random seeds by hashing stable input instead of generating random ones, so the same input always produces byte-identical output.

## Where it showed up (1)

### 2026-11-06 · [concepts-mcp: an MCP server that draws commits](../commits/2026-11-06-9931945-concepts-mcp-an-mcp-server-that-draws-commits/README.md) · `9931945`

Re-rendering a commit produces the same .excalidraw file, so git diffs stay clean.

Files: `packages/concepts-mcp/src/excalidraw.js:seeded`

## My notes

<!-- Your own notes below this line are kept when this file is regenerated. -->

