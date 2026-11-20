---
description: Show OpenViking memory plugin status for ZCode — server reachability, resolved credentials, last injection/recall, capture state
---

Run the OpenViking memory diagnostics for this ZCode session and summarize the
result for the user:

```bash
node "${ZCODE_PLUGIN_ROOT}/upstream/agent-hook-plugin/scripts/ov-memory-doctor.mjs" zcode
```

Then report, in the user's language:

1. Whether the OpenViking server is reachable and which config source supplied
   the URL/credentials. Config sources for this plugin are exactly two: the
   plugin settings UI and the built-in default (`http://127.0.0.1:1933`).
   Environment variables and ov.conf/ovcli.conf are deliberately not consulted.
2. Whether hooks fired recently: check `~/.openviking/logs/zcode-hooks.log` for
   the newest entries and the last recall/capture reasons.
3. Any failing check with its fix. If the server URL is wrong, tell the user to
   correct it in Settings → Plugins → OpenViking Memory.

Never print a full API key. If everything is green, say so plainly and mention
the one command to re-check later:
`node "${ZCODE_PLUGIN_ROOT}/upstream/agent-hook-plugin/scripts/ov-memory-doctor.mjs" zcode --offline`.

$ARGUMENTS
