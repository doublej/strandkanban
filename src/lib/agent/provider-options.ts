import type { ProviderId } from '$lib/server/agent/providers/types';

/**
 * What each provider offers the user, in one client-safe place so the settings UI
 * and the per-pane menu can't drift apart. Everything here is presentation plus the
 * one validation rule the UI can check without a running session — live model lists
 * still arrive on the `capabilities` event once a session starts.
 */

export type ProviderMeta = {
	id: ProviderId;
	label: string;
	description: string;
	/** CLI that must be on PATH. null = in-process, nothing to install. */
	binary: string | null;
};

export const PROVIDERS: ProviderMeta[] = [
	{ id: 'claude', label: 'Claude', description: 'In-process Agent SDK. Full permission modes, reports cost.', binary: null },
	{ id: 'codex', label: 'Codex', description: 'codex app-server over stdio. Real OS sandbox, tokens only.', binary: 'codex' },
	{ id: 'opencode', label: 'opencode', description: 'Local opencode serve over HTTP/SSE. Resumable streams.', binary: 'opencode' }
];

export type Choice = { value: string; label: string; hint: string };

export const CLAUDE_MODELS: Choice[] = [
	{ value: '', label: 'Default', hint: 'CLI default model' },
	{ value: 'haiku', label: 'Haiku', hint: 'Fast & lightweight' },
	{ value: 'sonnet', label: 'Sonnet', hint: 'Balanced performance' },
	{ value: 'opus', label: 'Opus', hint: 'Most capable' }
];

/** Claude is the only provider reporting permission modes; the other two send []. */
export const CLAUDE_PERMISSION_MODES: Choice[] = [
	{ value: 'bypassPermissions', label: 'Auto', hint: 'Runs every tool unprompted' },
	{ value: 'acceptEdits', label: 'Accept edits', hint: 'File edits auto-approved' },
	{ value: 'default', label: 'Ask', hint: 'Prompts — no UI to answer yet' },
	{ value: 'plan', label: 'Plan only', hint: 'Reads and plans, never writes' }
];

/** Suggestions only — codex reports its real list via `model/list` once connected. */
export const CODEX_MODEL_SUGGESTIONS = ['gpt-5-codex', 'gpt-5', 'o3', 'o4-mini'];

export type CodexSandbox = 'read-only' | 'workspace-write' | 'danger-full-access';

export const CODEX_SANDBOXES: { value: CodexSandbox; label: string; hint: string }[] = [
	{ value: 'workspace-write', label: 'Workspace write', hint: 'Writes inside cwd only' },
	{ value: 'read-only', label: 'Read only', hint: 'No writes at all' },
	{ value: 'danger-full-access', label: 'Full access', hint: 'No sandbox — whole machine' }
];

/**
 * opencode needs a `{providerID, id, variant}` triple, so a bare `sonnet` is dropped
 * server-side and the server default silently stands. Mirrors `toModelRef` in
 * providers/opencode.ts — split on the FIRST slash only, because openrouter ids
 * (`openrouter/anthropic/claude-x`) carry more.
 */
export function checkOpencodeModel(model: string): string | null {
	if (!model.trim()) return null;
	const spec = model.split('#')[0];
	const slash = spec.indexOf('/');
	if (slash <= 0 || slash === spec.length - 1) {
		return 'Needs providerID/model — e.g. anthropic/claude-sonnet-4-5';
	}
	return null;
}
