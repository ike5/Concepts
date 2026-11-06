# Atomic file writes

_pattern · intermediate_

Write to a temporary file, then rename it over the real one. A rename is atomic, so a crash leaves either the old file or the new one, never half of each.

## Where it showed up (1)

### 2026-11-06 · [concepts-mcp: an MCP server that draws commits](../commits/2026-11-06-9931945-concepts-mcp-an-mcp-server-that-draws-commits/README.md) · `9931945`

state.json is the record of what's been processed; a torn write would lose it.

Files: `packages/concepts-mcp/src/state.js`

## My notes

<!-- Your own notes below this line are kept when this file is regenerated. -->

