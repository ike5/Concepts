# Referential integrity checks

_pattern · intermediate_

When records point at each other by id, check every reference resolves before accepting the data, the way a database enforces foreign keys.

## Where it showed up (1)

### 2026-11-06 · [Diagrams become system-design models](../commits/2026-11-06-26af3fb-diagrams-become-system-design-models/README.md) · `26af3fb`

Edges must name nodes in their view, nodes must name real groups, and every appearsIn must name a real part; ids must be unique across views.

Files: `packages/concepts-mcp/src/schema.js:checkRecord`

## My notes

<!-- Your own notes below this line are kept when this file is regenerated. -->

