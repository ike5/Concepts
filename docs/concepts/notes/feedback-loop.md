# Self-triggering feedback loops

_concept · intermediate_

A process whose output becomes its own next input never settles. A common case is a tool that writes into the repository it is watching.

## Where it showed up (1)

### 2026-11-06 · [Breaking a commit feedback loop](../commits/2026-11-06-dbab40a-breaking-a-commit-feedback-loop/README.md) · `dbab40a`

Recording a skip changed a tracked file, which needed a commit, which the tool then saw as new.

Files: `packages/concepts-mcp/test/server.test.js:never dirties the output folder`

## My notes

<!-- Your own notes below this line are kept when this file is regenerated. -->

