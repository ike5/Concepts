import { readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ensureDir } from "./config.js";

const STATE_FILE = "state.json";

export function emptyState() {
  return { version: 1, commits: {}, concepts: {} };
}

export async function readState(dir) {
  try {
    const state = JSON.parse(await readFile(join(dir, STATE_FILE), "utf8"));
    return { ...emptyState(), ...state };
  } catch (error) {
    if (error.code === "ENOENT") return emptyState();
    throw new Error(`Could not read ${join(dir, STATE_FILE)}: ${error.message}`);
  }
}

export async function writeState(dir, state) {
  await ensureDir(dir);
  const target = join(dir, STATE_FILE);
  const temp = `${target}.${process.pid}.tmp`;
  await writeFile(temp, `${JSON.stringify(state, null, 2)}\n`);
  await rename(temp, target);
}
