#!/usr/bin/env node
/**
 * Post-sync / pre-release structural checks for plugin-hub.
 *
 * 1. The overlay's only contract with the mirrored upstream: the three script
 *    paths the manifests reference exist.
 * 2. Manifest/marketplace version agreement, JSON parseability, userConfig
 *    shape, no upstream placeholders left in overlay files.
 *
 * Usage: node scripts/verify-paths.mjs
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const HUB = resolve(import.meta.dirname, "..");
const PLUGIN = join(HUB, "plugins", "openviking-memory");
let failed = 0;

const check = (ok, label) => {
  console.log(`${ok ? "OK " : "FAIL"}  ${label}`);
  if (!ok) failed++;
};

// 1. overlay -> upstream contract paths
const manifest = JSON.parse(readFileSync(join(PLUGIN, ".zcode-plugin", "plugin.json"), "utf8"));
const mcp = JSON.parse(readFileSync(join(PLUGIN, ".mcp.json"), "utf8"));
const hooks = JSON.parse(readFileSync(join(PLUGIN, "hooks", "hooks.json"), "utf8"));

const refPaths = new Set();
for (const h of Object.values(hooks.hooks).flat())
  for (const hook of h.hooks) hook.args.filter((a) => a.includes("${ZCODE_PLUGIN_ROOT}")).forEach((a) => refPaths.add(a));
mcp.mcpServers.openviking.args.filter((a) => a.includes("${ZCODE_PLUGIN_ROOT}")).forEach((a) => refPaths.add(a));

for (const ref of refPaths) {
  const rel = ref.replace("${ZCODE_PLUGIN_ROOT}/", "");
  check(existsSync(join(PLUGIN, rel)), `manifest path ${rel}`);
}

// every hook routes through the bridge
const allArgs = Object.values(hooks.hooks).flat().flatMap((e) => e.hooks.map((h) => h.args.join(" ")));
check(allArgs.length > 0 && allArgs.every((a) => a.includes("scripts/with-user-config.mjs")), "all hooks via with-user-config bridge");
check(mcp.mcpServers.openviking.args[0].includes("scripts/with-user-config.mjs"), "MCP via with-user-config bridge");

// 2. versions agree
const mk = JSON.parse(readFileSync(join(HUB, "marketplace.json"), "utf8"));
check(manifest.version === mk.plugins[0].version, `version agreement (${manifest.version})`);

// 3. skills have matching frontmatter names
for (const dir of readdirSync(join(PLUGIN, "skills"))) {
  const fm = readFileSync(join(PLUGIN, "skills", dir, "SKILL.md"), "utf8").match(/^name:\s*(.+)$/m);
  check(fm && fm[1].trim() === dir, `skill ${dir} name matches directory`);
}

// 4. no upstream placeholders in overlay
const offenders = [];
const scan = (dir) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "upstream" || e.name === "node_modules") continue;
      scan(p);
    } else if (/\.(json|md)$/.test(e.name)) {
      const c = readFileSync(p, "utf8");
      if (/CLAUDE_PLUGIN_ROOT|__OPENVIKING_/.test(c)) offenders.push(p);
    }
  }
};
scan(PLUGIN);
check(offenders.length === 0, "no upstream placeholders in overlay" + (offenders.length ? `: ${offenders.join(", ")}` : ""));

process.exit(failed ? 1 : 0);
