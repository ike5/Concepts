# JSON-RPC over stdio

_protocol · intermediate_

The client starts the server as a child process and they exchange JSON-RPC messages over its standard input and output. No network port or HTTP server is needed.

## Where it showed up (1)

### 2026-11-06 · [concepts-mcp: an MCP server that draws commits](../commits/2026-11-06-9931945-concepts-mcp-an-mcp-server-that-draws-commits/README.md) · `9931945`

The server runs locally next to the repository, so stdio keeps it private and needs no setup beyond npx.

Files: `packages/concepts-mcp/src/index.js`

## My notes

<!-- Your own notes below this line are kept when this file is regenerated. -->

