import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { repoName } from "./git.js";

export const CONFIG_FILE = ".concepts.json";
export const DEFAULT_PROJECT_DIR = "docs/concepts";

/** ~/Desktop/ConceptLibrary when a Desktop folder exists, otherwise ~/ConceptLibrary. */
export function defaultLibraryDir() {
  const desktop = join(homedir(), "Desktop");
  return existsSync(desktop) ? "~/Desktop/ConceptLibrary" : "~/ConceptLibrary";
}

export function expandHome(path) {
  if (path === "~") return homedir();
  if (path.startsWith("~/") || path.startsWith("~\\")) return join(homedir(), path.slice(2));
  return path;
}

/** Store paths under the home folder as ~/… so a committed config doesn't leak a username or break for teammates. */
export function contractHome(path) {
  const home = homedir();
  const rel = relative(home, path);
  return rel && !rel.startsWith("..") && !isAbsolute(rel) ? `~/${rel.split(sep).join("/")}` : path;
}

export async function readConfig(root) {
  try {
    const config = JSON.parse(await readFile(join(root, CONFIG_FILE), "utf8"));
    if (!["project", "library"].includes(config.output) || typeof config.dir !== "string") {
      throw new Error(`${CONFIG_FILE} needs "output" ("project" or "library") and "dir".`);
    }
    return config;
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw new Error(`Could not read ${CONFIG_FILE}: ${error.message}`);
  }
}

export async function writeConfig(root, config) {
  await writeFile(join(root, CONFIG_FILE), `${JSON.stringify(config, null, 2)}\n`);
}

/**
 * Where this repo's diagrams go. Project mode: a folder inside the repo. Library mode: one subfolder
 * per repo inside the user's learning library, so every project feeds the same library.
 */
export async function outputDir(root, config) {
  if (config.output === "project") {
    const dir = resolve(root, config.dir);
    const rel = relative(root, dir);
    if (rel.startsWith("..") || isAbsolute(rel)) throw new Error(`Project output "${config.dir}" must be inside the repository.`);
    return dir;
  }
  return join(resolve(expandHome(config.dir)), config.repoName || (await repoName(root)));
}

/** The output folder relative to the repo root when it lives inside the repo (so its commits can be skipped), else null. */
export function outputDirInRepo(root, dir) {
  const rel = relative(root, dir);
  return rel && !rel.startsWith("..") && !isAbsolute(rel) ? rel.split(sep).join("/") : null;
}

export async function ensureDir(dir) {
  await mkdir(dir, { recursive: true });
  return dir;
}
