# Contributing

Thanks for looking. Issues and pull requests are welcome, with one honest caveat: this is a personal project, so a pull request may not be merged, even a good one. If you want to be sure a change is wanted, open an issue first.

You're free to clone and modify the code for any noncommercial purpose under the [license](LICENSE.md). Selling it or using it commercially isn't allowed.

## Working on it

```sh
cd packages/concepts-mcp
npm install
npm test            # unit tests plus end-to-end runs of the MCP server against temporary git repos
npm run example     # draws examples/commit.json into examples/output/
```

To try your build in an agent, point its MCP config at your checkout instead of npm:

```sh
claude mcp add concepts-dev -- node /path/to/concepts/packages/concepts-mcp/src/index.js
```

By submitting a pull request, you agree that your contribution is licensed under the same terms as the project.
