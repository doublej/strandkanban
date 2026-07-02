# `bdk://` URL scheme (macOS)

Clickable links that open the Kanban board on a specific issue:

```
bdk://<issue-id>      e.g. bdk://beads-kanban-41k
```

## How it works

1. `scheme/install.sh` builds a small AppleScript `.app` in `~/Applications` that
   registers the `bdk` URL scheme with LaunchServices.
2. Its `on open location` handler forwards the clicked URL to `bdk open <url>`.
3. `bdk open` (see `bin/bdk.ts`):
   - **reuses** a running board if one is up — just opens
     `https://localhost:<port>/?issue=<id>` on the existing dev server;
   - otherwise **starts** a board against the last-targeted project
     (`bin/.beads-cwd`) and opens the deep link once it's ready.

The board resolves `?issue=<id>` client-side; unknown ids show a toast.

## Install

```bash
scheme/install.sh
open 'bdk://<some-issue-id>'   # test
```

First launch may show a Gatekeeper prompt — approve it once.

## Uninstall

```bash
scheme/install.sh --uninstall
```

## Clickable links in the terminal (Ghostty / iTerm2)

Terminals only auto-detect `http(s)`/`file` URLs, not custom schemes. The
portable, zero-config way to make `bdk://` links clickable is **OSC 8
hyperlinks** — both Ghostty and iTerm2 open them on ⌘-click via the registered
scheme handler.

Emit one from any script:

```bash
# bdk-link <id> [label]
bdk-link() { printf '\e]8;;bdk://%s\e\\%s\e]8;;\e\\\n' "$1" "${2:-$1}"; }
bdk-link beads-kanban-877y
```

Per-terminal notes:

- **Ghostty** — OSC 8 works out of the box (⌘-click). Bare `bdk://…` *text*
  can't be auto-linked: the custom-regex `link` config is documented
  "can't currently be set". Use OSC 8.
- **iTerm2** — OSC 8 works (⌘-click). To also linkify bare `bdk://…` text, add a
  Smart Selection rule: Settings → Profiles → Advanced → Smart Selection → Edit,
  regex `\bbdk://[A-Za-z0-9._-]+`, action **Open URL** `\0`.

## Notes

- Only the *most recently started* board is tracked for reuse
  (`~/.cache/beads-kanban/active-server.json`). Ids from other projects will
  open on the active board and toast "not found" — that's expected.
- The handler logs to `/tmp/bdk-scheme.log` for debugging.
