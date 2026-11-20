#!/usr/bin/env node

/**
 * Config firewall + userConfig bridge for ZCode.
 *
 * This plugin accepts connection settings from exactly two sources:
 *   1. the plugin settings UI (ZCode injects userConfig entries into hook
 *      processes as ZCODE_USER_CONFIG_<KEY>; for the MCP server the plugin's
 *      .mcp.json interpolates them into ZCODE_USER_CONFIG_* names too)
 *   2. the built-in defaults (http://127.0.0.1:1933, no auth)
 *
 * Everything else the OpenViking runtime would normally consult is stripped
 * before the target script runs:
 *   - every OPENVIKING_* environment variable except the plugin's own
 *     plumbing (hook event/source markers, version, debug toggle) — so shell
 *     exports cannot steer the connection;
 *   - ovcli.conf / ov.conf, by pinning OPENVIKING_CREDENTIAL_SOURCE=env,
 *     which makes the runtime's credential chain skip both files by design;
 *   - OPENVIKING_*_CONFIG_FILE path overrides (wiped with the rest).
 *
 * Workspace `.openviking/config.json` layers stay untouched: they cannot carry
 * connection or credential keys (the runtime rejects those by design) and only
 * tune behaviour knobs (timeouts, peer identity).
 *
 * Usage: node with-user-config.mjs <target.mjs> [target args...]
 */

import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

/** UI key suffix → runtime env var. */
const OVERRIDES = [
  ["URL", "OPENVIKING_URL"],
  ["BASE_URL", "OPENVIKING_BASE_URL"],
  ["API_KEY", "OPENVIKING_API_KEY"],
  ["BEARER_TOKEN", "OPENVIKING_BEARER_TOKEN"],
  ["ACCOUNT", "OPENVIKING_ACCOUNT"],
  ["USER", "OPENVIKING_USER"],
];

/** Plugin plumbing that is not connection config; survives the wipe. */
const ALLOWLIST = new Set([
  "OPENVIKING_HOOK_EVENT",
  "OPENVIKING_HOOK_SOURCE",
  "OPENVIKING_INTEGRATION_VERSION",
  "OPENVIKING_DEBUG",
]);

// 1. Collect UI values (non-empty only — blank means "use the default").
const ui = [];
for (const [uiKey, ovKey] of OVERRIDES) {
  const value = process.env[`ZCODE_USER_CONFIG_${uiKey}`];
  if (typeof value === "string" && value.trim()) {
    ui.push([ovKey, value.trim()]);
  }
}

// 2. Wipe every external OpenViking connection variable.
for (const name of Object.keys(process.env)) {
  if (name.startsWith("OPENVIKING_") && !ALLOWLIST.has(name)) {
    delete process.env[name];
  }
}

// 3. Apply the UI values, if any.
for (const [ovKey, value] of ui) {
  process.env[ovKey] = value;
}

// 4. Pin env-only credential mode: ovcli.conf and ov.conf are never read.
process.env.OPENVIKING_CREDENTIAL_SOURCE = "env";

const target = process.argv[2];
if (!target) {
  process.stderr.write("[openviking-memory] with-user-config: no target script\n");
  process.exit(1);
}
const targetPath = resolve(target);
// Targets like mcp-proxy.mjs / ov-memory-doctor.mjs start their server only
// when they detect a direct run (process.argv[1] === import.meta.url). Point
// argv[1] at the target so the imported module sees itself as the entry.
process.argv[1] = targetPath;
process.argv.splice(2, 1); // drop the target path; the target reads argv[2] onward

await import(pathToFileURL(targetPath).href);
