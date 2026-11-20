#!/usr/bin/env node
/**
 * Sync vendored upstream blocks into plugin-hub from an OpenViking checkout.
 *
 * Design: the plugin's `upstream/` directory is a PURE MIRROR of two upstream
 * directories —
 *   upstream/agent-hook-plugin    <- examples/agent-hook-plugin   (whole dir)
 *   upstream/memory-plugin-shared <- examples/memory-plugin-shared (whole dir)
 * Sync = replace those two trees wholesale from the source checkout. No file
 * lists, no closure computation: what upstream ships under those two dirs is
 * what the mirror gets, tests and all.
 *
 * The plugin's own overlay (`.zcode-plugin/`, `hooks/`, `.mcp.json`, `scripts/`,
 * `skills/`, `commands/`, `README.md`) is never touched. The only contract the
 * overlay has with the mirror is one import path shape:
 *   <plugin>/upstream/agent-hook-plugin/scripts/{hook,uri-guard}.mjs
 *   <plugin>/upstream/agent-hook-plugin/servers/mcp-proxy.mjs
 * `scripts/verify-paths.mjs` checks that after every sync.
 *
 * Usage:
 *   node scripts/sync-upstream.mjs <path-to-OpenViking-checkout> [--force]
 *
 * Without --force, refuses to run if the working tree has uncommitted changes
 * (the sync rewrites many files at once; run it on a clean tree).
 *
 * Version policy: after syncing, read examples/agent-hook-plugin/plugin.json's
 * version and map it to a hub version with +1 major and +1 minor so an
 * overlay-only release (third digit) can never collide with an upstream number.
 */

import { cpSync, existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const HUB = resolve(import.meta.dirname, "..");

const MIRROR = [
  ["examples/agent-hook-plugin", "plugins/openviking-memory/upstream/agent-hook-plugin"],
  ["examples/memory-plugin-shared", "plugins/openviking-memory/upstream/memory-plugin-shared"],
];

const args = process.argv.slice(2);
const srcRoot = resolve(args[0] || "");
const force = args.includes("--force");

if (!existsSync(join(srcRoot, "examples", "agent-hook-plugin", "plugin.json"))) {
  console.error(`not an OpenViking checkout (missing examples/agent-hook-plugin/plugin.json): ${srcRoot}`);
  process.exit(1);
}

// Clean-tree guard for the hub repo (skipped when the hub is not a git repo).
let dirty = false;
if (!force) {
  try {
    const { execSync } = await import("node:child_process");
    const status = execSync("git status --porcelain", { cwd: HUB, encoding: "utf8" });
    if (status.trim()) dirty = true;
  } catch {
    console.log("hub is not a git repository; skipping clean-tree guard");
  }
  if (dirty) {
    console.error("hub working tree not clean; commit or stash first (or pass --force)");
    process.exit(1);
  }
}

let upstreamVersion = "";
for (const [from, to] of MIRROR) {
  const src = join(srcRoot, from);
  const dst = join(HUB, to);
  rmSync(dst, { recursive: true, force: true });
  cpSync(src, dst, { recursive: true, filter: (s) => !/(^|[\\/])node_modules($|[\\/])/.test(s) });
  const n = readdirSync(dst, { recursive: true }).length;
  console.log(`mirrored ${from} -> ${to} (${n} entries)`);
  if (from.includes("agent-hook-plugin")) {
    upstreamVersion = JSON.parse(readFileSync(join(src, "plugin.json"), "utf8")).version;
  }
}

// Version policy: upstream 0.5.31 -> hub 1.6.31 (major+1, minor+1, patch kept).
// Overlay-only releases bump the patch further (1.6.31 -> 1.6.32 ...) and may
// be reset downward by the next upstream sync — the marketplace update is
// triggered by content, never by version comparison (see the workflow's hash
// gate), so a reset or a coincidental collision cannot skip a sync.
const [maj, min, pat] = upstreamVersion.split(".").map(Number);
const hubVersion = `${maj + 1}.${min + 1}.${pat}`;

const manifest = join(HUB, "plugins/openviking-memory/.zcode-plugin/plugin.json");
const marketplace = join(HUB, "marketplace.json");
for (const [file, isManifest] of [[manifest, true], [marketplace, false]]) {
  const j = JSON.parse(readFileSync(file, "utf8"));
  if (isManifest) j.version = hubVersion;
  else j.plugins[0].version = hubVersion;
  writeFileSync(file, JSON.stringify(j, null, 2) + "\n");
}

console.log(`upstream ${upstreamVersion} -> hub plugin ${hubVersion}`);
console.log("next: node scripts/verify-paths.mjs && node --test upstream tests, review diff, commit.");
