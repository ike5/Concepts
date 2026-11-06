# Discriminated unions

_language feature · intermediate_

A type that is one of several shapes, told apart by a tag field. Checking the tag tells you which fields exist, so validation and code can branch safely.

## Where it showed up (1)

### 2026-11-06 · [Diagrams become system-design models](../commits/2026-11-06-26af3fb-diagrams-become-system-design-models/README.md) · `26af3fb`

A view's \`type\` decides whether it has nodes and edges or participants and messages; Zod validates each branch with its own schema.

Files: `packages/concepts-mcp/src/schema.js:viewSchema`

## My notes

<!-- Your own notes below this line are kept when this file is regenerated. -->

