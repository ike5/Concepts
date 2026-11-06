# Security

## Reporting a vulnerability

Please don't open a public issue. Report it privately through [GitHub security advisories](https://github.com/ike5/concepts/security/advisories/new) with the steps to reproduce it and the version of `concepts-mcp` you used. You'll get a reply as soon as possible, and a fix will be released before the details are made public.

## Supported versions

Only the latest release on npm gets security fixes. Installing with `npx -y concepts-mcp@latest` always runs it.

## What Concepts can touch

The server runs locally over stdio, makes no network requests, and needs no credentials. It reads git history in the repositories you set up, and writes only to the diagram folder you chose (`docs/concepts/` or your learning library); output paths are checked so they can't escape that folder. Setup also writes `.concepts.json` and agent instruction files such as `AGENTS.md` and `CLAUDE.md`, and, if you choose, adds a post-commit hook.
