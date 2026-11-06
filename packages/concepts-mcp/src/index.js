#!/usr/bin/env node
import { readFile } from "node:fs/promises";

const { version } = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const [command] = process.argv.slice(2);

if (command === "--version" || command === "-v") {
  console.log(`concepts-mcp ${version}`);
} else if (command || process.stdin.isTTY) {
  // A person at a terminal: run the CLI (or show help) instead of a server waiting silently on stdin.
  const { main } = await import("./cli.js");
  await main(process.argv.slice(2));
} else {
  const { createServer } = await import("./server.js");
  const { StdioServerTransport } = await import("@modelcontextprotocol/server/stdio");
  await createServer(version).connect(new StdioServerTransport());
}
