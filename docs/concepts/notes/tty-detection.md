# TTY detection

_language feature · beginner_

process.stdin.isTTY tells a program whether a person is typing at a terminal or another program is piping data in.

## Where it showed up (1)

### 2026-11-06 · [concepts-mcp: an MCP server that draws commits](../commits/2026-11-06-9931945-concepts-mcp-an-mcp-server-that-draws-commits/README.md) · `9931945`

One binary is both the MCP server (piped stdin) and a CLI; at a terminal it shows help instead of silently waiting.

Files: `packages/concepts-mcp/src/index.js:9-13`

## My notes

<!-- Your own notes below this line are kept when this file is regenerated. -->

