# Changelog

## [0.6.1] - 2026-11-16

Needs `bd` 1.3.4 or newer (was 1.2.1, which upstream has retracted). The launcher checks this on start.

### Upgrading bd

Every `bd` command strandkanban runs was re-tested on 1.3.4. No app changes were needed, but each server-mode workspace needs a one-time step after you upgrade `bd`:

1. Back up: `bd export > .beads/backup/pre-1.3.4.jsonl`
2. Migrate: `bd migrate schema`. Until you do, bd refuses every write with `refusing to auto-apply 1 pending schema migration to a shared server database`. Reads keep working.
3. Repair blocked flags: `bd recompute-blocked`. Stores that took migration 0059 on Dolt 1.83 can have issues wrongly marked blocked and missing from `bd ready`.

Embedded-mode workspaces migrate on their own. A workspace with a Dolt remote needs `bd migrate schema --force` on a single clone, then `bd dolt push`.

### Fixed

- Pane labels with two values on the same dimension no longer collide on their `#each` key.

## [0.6.0] - 2026-10-14

Needs `bd` 1.2.1 or newer (was 1.0.0). The launcher checks this on start.

### Added

- Agent providers: pick Claude, Codex or OpenCode in Settings. Codex workers reach beads through a built-in MCP bridge and never write to `~/.codex/config.toml`.
- Agent panes adapt to the provider. The permission switcher and cost chips hide when a provider has no such thing, and non-Claude panes carry a provider badge.
- Paste or drag images into agent chats (Claude only).
- The manager queue runs several workers at once, up to a cap set in Settings (default 3). It skips tickets that `bd blocked` lists instead of stalling behind the first queued item.
- Workers claim tickets with a lease and a heartbeat. Claims left behind by dead workers are reclaimed after 10 minutes.
- Redesigned ticket card: four calm rows that only call out exceptions (blocked, due, stale, P0/P1).
- Card detail setting under Settings → Board: compact, standard or detailed.
- Copy ID in the card context menu.
- Rebuilt ticket pane. Each field saves on its own and drafts are guarded. Status, priority and type sit in the header as chips, unset properties hide behind an Add property picker, estimates read as `2h 30m`, relations are grouped by direction, and history shows the last eight entries with Show all.
- Custom statuses found in issue data show up as columns and in the filters, table and pane.
- Live refresh and the activity feed follow the bd events journal when a workspace enables it. The activity feed now also works in embedded mode (#3).
- `strand zen --project <path>` targets another project, and `strand://zen/<ids>` URLs open focus review.

### Changed

- All bd reads and writes go through `beads-sdk`.
- The dev server serves plain http by default, which ends the self-signed certificate warning on every start. Set `STRAND_HTTPS=1` for HTTPS.
- Priority 4 is labelled "Someday". It used to say "Backlog", the same as the open column. The pane writes priorities as P0–P4, matching bd.
- Faster cold start: the bd engine warms up when the server starts, and the first page render already contains the issues.
- JSONL auto-export is switched back on per project for bd 1.1 and newer.

### Fixed

- Security: a project path taken from the URL must match a registered project.
- `bun run build` works again.
- Projects registered under a symlinked path no longer appear twice in the switcher.
- Changing an issue's type now saves.
- Blockers picked on the create form get linked.
- Attachment previews load in projects other than the default one.
- Due dates show the intended calendar day on both sides of UTC.
- Quick successive edits stay on screen while they save, and failed saves are shown.
- Short bead ids work in `?zen=` deep links.
- Dependency, comment and attachment lookups that broke on newer bd commands work again.
- bd 1.1 `doctor` output is read correctly, and the events feed returns empty instead of failing in embedded mode.
- Agent tool results land on the call they belong to, and the "continue" message sends its text.
- Agents started without a ticket acknowledge instead of waiting in silence.
- The manager can no longer start subagents that never show up as panes.
- The ticket pane footer stays clear of the floating status bar, and every pane control has a focus ring.
- Dependency counts in the card tooltip are pluralised.

### Internal

- The page, detail panel, agent bar, table view, page operations and agent runtime are split into smaller stores and components. Agent providers sit behind one interface.
- `bun test` runs the test suite.

## [0.5.0] - 2026-07-14

### Added

- Grid heatmap view: zoomed-out mode plus controls.
- Table view: inline field editing.
- `BD_DB` and `BEADS_KANBAN_CWD_FILE` env vars.

### Fixed

- The project switcher scrolls to the selected item.
- The keyboard shortcuts help matches the real bindings (missing column-5 hotkey, undocumented keys, inconsistent casing).

### Changed

- Project renamed beads-kanban → strandkanban (package, CLI, docs, storage keys).
- CLI command renamed `bdk` → `strand`.
- README rewritten, with version and compatibility status.

## [0.4.1] - 2026-07-08

- Simpler first-run onboarding and README install flow.
- Fixed npm package bins and a symlink-safe `bdk` wrapper.
- Package `prepare` build and explicit package contents.
- Beads install guidance matches current brew and package naming.

## [0.4.0] - 2026-07-01

### Added

- Flow view: interactive dependency graph with grouped and timeline layouts, a layout switcher, group containers and custom ticket and group nodes.
- Table view: sortable, configurable columns, drag-to-reorder headers, multi-select rows for bulk actions, and keyboard navigation in view order.
- Filter sidebar with multi-select facets, due/created/exclude-labels/scheduling toggles, per-project remembered view state and saved views.
- Ticket detail: due, defer, estimate, spec and external-ref editors (bd 1.0), operational state (`bd set-state`), per-issue version history, due/estimate/wisp/stale badges on cards and lint hints.
- Agent UI: live MCP server health per session, run summary (per-model usage, turns, denials, guardrails), and tool failures and SDK notifications surfaced via hooks.
- Pill-shaped toolbar controls with hotkey and count chips.

### Fixed

- Security: all bd CLI args are shell-quoted, closing a command injection.
- Issues are read via `bd export`; `bd sql` timeout raised to 30s; non-JSON event values tolerated.
- Saving a view no longer freezes the page in an effect loop.
- Due dates no longer shift a day by timezone; detail panel races fixed.

### Performance

- Session listing reads file heads with an mtime cache instead of re-reading ~170 MB per poll.

## [0.3.0] - 2026-05-26

### Added

- Zen focus review: full-screen review of a list of issues, one at a time. Cycle with `←/→`, `↑/↓` or `h/j/k/l`, `Enter`/`o` opens the detail pane, `Esc` exits, `z` starts it from the selected card.
- `?zen=bd-1,bd-2` deep links straight into a review queue.
- `bdk` CLI (renamed from `beads-kanban`) with `start | zen | reap | help` subcommands; `bdk zen <ids>` starts the board and opens focus review.
