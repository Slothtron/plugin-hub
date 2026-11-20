---
name: ov-memory-doctor
description: Diagnose the OpenViking memory plugin for ZCode — server reachability, credential resolution, hook state, last recall/capture. Use when memories stop appearing, captures lag behind, or after config changes.
---

# OpenViking Memory Doctor (ZCode)

Run the offline diagnostics first — it never needs the server and reports the
config layers it resolved:

```bash
node "${ZCODE_PLUGIN_ROOT}/upstream/agent-hook-plugin/scripts/ov-memory-doctor.mjs" zcode --offline
```

Drop `--offline` to also probe the OpenViking server (exit code 1 when any
check fails). Useful follow-ups:

- Debug log: `~/.openviking/logs/zcode-hooks.log` (JSON lines, one per hook run).
- Last session-start injection: `~/.openviking/last_inject.md`.
- Config sources are exactly two: the plugin settings UI (ZCode injects it as
  `ZCODE_USER_CONFIG_*`, which the bridge maps to `OPENVIKING_*`) and the
  built-in default (`http://127.0.0.1:1933`, no auth). Environment variables
  and `ovcli.conf`/`ov.conf` are wiped/pinned away by the bridge — a URL filled
  in the plugin's settings UI is the only override that exists. The doctor's
  own output may still mention file layers; for this plugin they never apply.

Never print a full API key; the doctor already redacts, keep it that way when
quoting its output back to the user.
