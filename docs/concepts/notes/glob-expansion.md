# Who expands a glob

_tooling · beginner_

A pattern like \*.js is usually expanded by the shell before a program starts. Quoting it hands the program the literal text, so the program must expand it itself, and not every program or version can. Windows shells don't expand globs at all.

## Where it showed up (1)

### 2026-11-06 · [Who expands a glob?](../commits/2026-11-06-7ca4c08-who-expands-a-glob/README.md) · `7ca4c08`

The quoted pattern reached Node 20's test runner unexpanded, and that runner treats arguments as file paths.

Files: `packages/concepts-mcp/package.json:scripts.test`

## My notes

<!-- Your own notes below this line are kept when this file is regenerated. -->

