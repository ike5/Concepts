import { execFile as cb } from "node:child_process";
import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";

export const execFile = promisify(cb);

export async function tempRepo() {
  const home = await mkdtemp(join(tmpdir(), "concepts-home-"));
  const root = join(home, "my-app");
  await mkdir(root);
  const env = { ...process.env, HOME: home, USERPROFILE: home, GIT_AUTHOR_NAME: "Test", GIT_AUTHOR_EMAIL: "t@example.com", GIT_COMMITTER_NAME: "Test", GIT_COMMITTER_EMAIL: "t@example.com", GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: join(home, ".gitconfig") };
  const git = (...args) => execFile("git", args, { cwd: root, env }).then((r) => r.stdout.trim());
  await git("init", "-q", "-b", "main");
  const commit = async (files, message) => {
    for (const [path, text] of Object.entries(files)) {
      await mkdir(dirname(join(root, path)), { recursive: true });
      await writeFile(join(root, path), text);
    }
    await git("add", "-A");
    await git("commit", "-q", "-m", message);
    return git("rev-parse", "HEAD");
  };
  return { home, root, env, git, commit };
}

export const concept = (id, extra = {}) => ({
  id, name: id.replace(/-/g, " "), kind: "pattern", level: "intermediate", appearsIn: [],
  explanation: `What ${id} is.`, whyHere: `Why ${id} was used.`, files: [{ path: "src/app.js", lines: "1-3" }], ...extra,
});

/** A small architecture view: api → worker → db, with the edge between api and worker named "call". */
export const view = (extra = {}) => ({
  type: "architecture", title: "System",
  nodes: [
    { id: "api", label: "API", shape: "service", status: "changed" },
    { id: "worker", label: "Worker", shape: "service", status: "new" },
    { id: "db", label: "DB", shape: "database" },
  ],
  edges: [{ id: "call", from: "api", to: "worker", label: "enqueue", style: "async", status: "new" }, { from: "worker", to: "db" }],
  ...extra,
});
