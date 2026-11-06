# concepts-mcp

An MCP server that turns each commit into a hand-drawn [Excalidraw](https://excalidraw.com) diagram of the concepts it uses, so you keep learning from code your AI wrote.

![Example concept diagram](https://ike5.github.io/concepts/assets/example.svg)

Most of what you learn as an engineer happens after the code works: you find out *why* it works. When an AI writes the code, that step is easy to skip. After each commit, your agent models the change as system-design diagrams and marks every concept it relies on (patterns, algorithms, library APIs, protocols, security decisions) on the part of the system where it lives. This server lays out and draws the diagrams, and keeps a growing library of concept notes.

## Install

Needs Node.js 20+ and git.

```sh
# Claude Code
claude mcp add --scope user concepts -- npx -y concepts-mcp@latest

# Codex
codex mcp add concepts -- npx -y concepts-mcp@latest
```

Cursor, VS Code and other clients: copy the command from **https://ike5.github.io/concepts/#install**, or add this stdio server:

```json
{ "mcpServers": { "concepts": { "command": "npx", "args": ["-y", "concepts-mcp@latest"] } } }
```

## Turn it on in a repository

Ask your agent: *"Set up concept diagrams for this repo."* Or run this in the repository folder:

```sh
npx -y concepts-mcp@latest init
```

Setup asks:

1. **Where diagrams go:** in the project (`docs/concepts/`) or in your learning library (`~/Desktop/ConceptLibrary/<repo>/`, or `~/ConceptLibrary/` when there's no Desktop folder).
2. **Which agents you use:** Claude Code, Cursor, Codex, any MCP client.
3. **Whether to add a post-commit reminder hook.**
4. **How many recent commits to diagram straight away.**

It writes `.concepts.json`, adds the workflow to `AGENTS.md`, and adds an `@AGENTS.md` import to `CLAUDE.md` for Claude Code. Commit those files.

Non-interactive: `npx -y concepts-mcp@latest init --output library --agents claude,codex --hook --backfill 3 --yes`

## What you get

```
ConceptLibrary/
  README.md                       every project
  my-app/
    README.md                     every diagram, newest first, and all concepts by kind
    commits/2026-11-06-3f9c2ab-retrying-failed-webhooks/
      concepts.excalidraw         editable: excalidraw.com, Obsidian, VS Code extension
      concepts.svg                preview that renders on GitHub
      README.md                   numbered concepts: what each is, why this commit needed it, files
    notes/exponential-backoff.md  one note per concept, collecting every commit it appeared in
```

Each diagram teaches through structure, not text:

- **Views:** the agent picks as many as the change needs, from `architecture` (components and how they talk), `sequence` (who calls whom, in order), `flow` (steps and decisions), `state` (states and transitions) and `data-model` (entities and relationships).
- **Shapes mean something:** databases are cylinders, people are stick figures, decisions are diamonds, queues show message slots, external systems are dashed. Boundaries (services, layers, trust zones) are dashed boxes.
- **What changed:** parts and arrows the commit added have a bold outline, changed ones a blue outline, and the existing system around them is faded.
- **Line style means something:** call, async message or event, data flow, depends on.
- **Concepts:** each one is a numbered red marker on the parts where it lives. The key beside the diagram names them. Explanations are in the commit's README and the concept notes, never inside the diagram.

There's no fixed number of concepts or views: a one-line fix may get one small diagram, a large feature several. Concepts seen for the first time are marked **NEW**. Anything you write under **My notes** in a concept note is kept when the note is regenerated.

## How it works

The server never calls an AI and never sends your code anywhere. The agent you already use does the thinking; the server reads git and writes files.

| Tool | What it does |
| --- | --- |
| `get_concepts_instructions` | The workflow the agent follows (the same text `AGENTS.md` gets) |
| `setup_concepts` | Configures a repository (the agent asks you where diagrams go first) |
| `get_unprocessed_commits` | Commits since setup without a diagram, oldest first, with message, files and a trimmed diff |
| `get_concept_library` | Concepts already recorded, so the agent reuses their ids |
| `record_commit_concepts` | Takes views + concepts, draws the diagrams, updates the notes, marks the commit done; or `skipReason` for trivial commits |

- **Nothing gets missed.** The server tracks which commits have been handled rather than looking only at the latest one. Commits you make by hand, or several commits in a row, are picked up the next time the agent runs.
- **Noise is filtered.** Lockfiles, minified and generated files are left out of diffs. Commits that only change the concept output or setup files are skipped automatically.
- **Layout is done for the agent.** The agent describes components, arrows and concepts as data. The server lays them out with [dagre](https://github.com/dagrejs/dagre), writes the `.excalidraw` JSON itself (one frame per view), and draws the SVG with [Rough.js](https://roughjs.com), the library Excalidraw uses for its hand-drawn look.

## Limits

- An agent only follows `AGENTS.md` when it's the one working in the repository. The post-commit hook is a reminder, not an automation: it never runs an AI.
- Rewriting history (rebase, amend) gives commits new ids, so an already-diagrammed commit may come up again. The agent can skip it.
- The first setup on a branch only looks forward from that point, plus any commits you ask it to backfill (up to 20).

## CLI

```
npx -y concepts-mcp@latest init      Set up this repository
npx -y concepts-mcp@latest status    Where diagrams go, and how many commits are waiting
npx -y concepts-mcp@latest render <concepts.json> [out-dir]
                                     Draw a diagram from a JSON file (see examples/commit.json)
```

## License

[PolyForm Noncommercial 1.0.0](LICENSE.md). You can use, study and modify it for any noncommercial purpose; selling it or using it commercially is not allowed. Pull requests are welcome, but there's no promise they'll be merged.

Diagrams embed "Concepts Hand", a Latin subset of the [Virgil](https://github.com/excalidraw/virgil) font by Ellinor Rapp, under the SIL Open Font License 1.1 (see `fonts/LICENSE-FONT.md`). The diagrams you make are yours.
