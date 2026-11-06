# npm trusted publishing (OIDC)

_security · advanced_

Instead of storing a long-lived npm token as a secret, the CI job proves its identity with a short-lived OpenID Connect token that npm trusts for this repository and workflow, and npm records provenance.

**Learn more:**

- [npm trusted publishing](<https://docs.npmjs.com/trusted-publishers>)

## Where it showed up (1)

### 2026-11-06 · [concepts-mcp: an MCP server that draws commits](../commits/2026-11-06-9931945-concepts-mcp-an-mcp-server-that-draws-commits/README.md) · `9931945`

Releases publish from a tag with no secret to leak.

Files: `.github/workflows/publish-npm.yml`

## My notes

<!-- Your own notes below this line are kept when this file is regenerated. -->

