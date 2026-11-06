# Concepts

Learn from the code your AI just wrote. **Concepts** is an MCP server, published on npm as [`concepts-mcp`](packages/concepts-mcp). After each commit it turns the ideas the change relies on into a hand-drawn Excalidraw diagram, plus a growing library of concept notes.

**Install and setup:** https://ike5.github.io/concepts/

![Example concept diagram](docs/assets/example.svg)

## Repository layout

| Path | What it is |
| --- | --- |
| [`packages/concepts-mcp`](packages/concepts-mcp) | The npm package: MCP server and `init` CLI ([README](packages/concepts-mcp/README.md)) |
| [`docs/`](docs) | The GitHub Pages site with copy-to-clipboard install commands |
| `.github/workflows` | Tests on Linux, macOS and Windows; npm publishing on `v*` tags |

## Develop

```sh
cd packages/concepts-mcp
npm install
npm test
npm run example     # draws examples/commit.json into examples/output/
```

To release, bump `version` in `packages/concepts-mcp/package.json` and `server.json`, then push a `v<version>` tag.
