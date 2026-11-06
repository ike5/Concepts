# Invariant-based tests

_testing · intermediate_

Instead of comparing output to a saved picture, assert properties that must always hold, such as no overlapping boxes, every part inside its frame, every reference bound both ways. They survive harmless layout changes.

## Where it showed up (1)

### 2026-11-06 · [Diagrams become system-design models](../commits/2026-11-06-26af3fb-diagrams-become-system-design-models/README.md) · `26af3fb`

Layout output changes whenever spacing is tuned; the tests check what must stay true.

Files: `packages/concepts-mcp/test/diagram.test.js`

## My notes

<!-- Your own notes below this line are kept when this file is regenerated. -->

