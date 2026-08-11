<script lang="ts">
	import type { SdkSessionInfo } from '$lib/wsStore.svelte';

	interface Props {
		newPaneName: string;
		resumePrompt: { name: string; sessionId: string } | null;
		showSessionPicker: boolean;
		sdkSessions: SdkSessionInfo[];
		loadingSdkSessions: boolean;
		sessionSearchQuery: string;
		expandedPanes: Set<string>;
		filteredSessions: SdkSessionInfo[];
		currentProjectPath: string;
		agentFirstMessage: string;
		combinedSystemPrompt: string;
		agentSystemPrompt: string;
		getPersistedSdkSessionId: (name: string) => string | undefined;
		onaddpane: (name: string, projectPath: string, firstMsg: string, systemPrompt: string, sessionId?: string, ticketId?: string) => void;
		onfetchsdksessions: (projectPath: string) => Promise<SdkSessionInfo[]>;
	}

	let {
		newPaneName = $bindable(),
		resumePrompt = $bindable(),
		showSessionPicker = $bindable(),
		sdkSessions = $bindable(),
		loadingSdkSessions = $bindable(),
		sessionSearchQuery = $bindable(),
		expandedPanes = $bindable(),
		filteredSessions,
		currentProjectPath,
		agentFirstMessage,
		combinedSystemPrompt,
		agentSystemPrompt,
		getPersistedSdkSessionId,
		onaddpane,
		onfetchsdksessions
	}: Props = $props();

	let agentMenuOpen = $state(false);
	let agentNameInputOpen = $state(false);
	let agentNameInputRef = $state<HTMLInputElement | null>(null);
	let generatingName = $state(false);

	async function generateAgentName() {
		if (generatingName) return;
		generatingName = true;
		try {
			const res = await fetch('/api/agent/name', { method: 'POST' });
			if (res.ok) {
				const payload = await res.json();
				if (payload?.ok && payload.data?.name) newPaneName = payload.data.name;
			}
		} catch (e) {
			console.error('Failed to generate name:', e);
		} finally {
			generatingName = false;
		}
	}

	async function handleNewAgent() {
		agentMenuOpen = false;
		agentNameInputOpen = true;
		generateAgentName();
		setTimeout(() => agentNameInputRef?.select(), 50);
	}

	async function handleResumeSessions() {
		agentMenuOpen = false;
		sessionSearchQuery = '';
		loadingSdkSessions = true;
		showSessionPicker = true;
		sdkSessions = await onfetchsdksessions(currentProjectPath);
		loadingSdkSessions = false;
	}

	function handleNameSubmit(e: Event) {
		e.preventDefault();
		const name = newPaneName.trim();
		if (!name) return;
		const persistedId = getPersistedSdkSessionId(name);
		if (persistedId) {
			resumePrompt = { name, sessionId: persistedId };
		} else {
			onaddpane(name, currentProjectPath, agentFirstMessage, combinedSystemPrompt);
			expandedPanes.add(name);
			expandedPanes = new Set(expandedPanes);
		}
		newPaneName = '';
		agentNameInputOpen = false;
	}

	function handleResume() {
		if (!resumePrompt) return;
		onaddpane(resumePrompt.name, currentProjectPath, agentFirstMessage, agentSystemPrompt, resumePrompt.sessionId);
		expandedPanes.add(resumePrompt.name);
		expandedPanes = new Set(expandedPanes);
		resumePrompt = null;
	}

	function handleFreshStart() {
		if (!resumePrompt) return;
		onaddpane(resumePrompt.name, currentProjectPath, agentFirstMessage, agentSystemPrompt);
		expandedPanes.add(resumePrompt.name);
		expandedPanes = new Set(expandedPanes);
		resumePrompt = null;
	}
</script>

<!-- Agent launcher button with dropdown menu -->
<div class="agent-launcher">
	<button
		class="launcher-btn"
		class:active={agentMenuOpen}
		onclick={() => agentMenuOpen = !agentMenuOpen}
	>
		<span class="launcher-label">New</span>
		<svg class="launcher-caret" class:open={agentMenuOpen} viewBox="0 0 10 10" width="9" height="9">
			<path d="M2.5 4l2.5 2.5 2.5-2.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
		</svg>
	</button>

	{#if agentMenuOpen}
		<div
			class="launcher-backdrop"
			onclick={() => agentMenuOpen = false}
			onkeydown={(e) => e.key === 'Escape' && (agentMenuOpen = false)}
			role="button"
			tabindex="-1"
			aria-label="Close"
		></div>
		<div class="launcher-menu">
			<button class="launcher-option" onclick={handleNewAgent}>
				<svg viewBox="0 0 16 16" width="13" height="13">
					<circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" stroke-width="1.3"/>
					<path d="M8 5v6M5 8h6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
				</svg>
				<span class="option-label">New Agent</span>
			</button>
			<button class="launcher-option" onclick={handleResumeSessions}>
				<svg viewBox="0 0 16 16" width="13" height="13">
					<path d="M4 8a4 4 0 017.5-2" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
					<path d="M11 3.5v2.5h-2.5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
				</svg>
				<span class="option-label">Resume Session</span>
				<span class="option-badge">{filteredSessions.length}</span>
			</button>
		</div>
	{/if}
</div>

<!-- Name input (appears after clicking New Agent) -->
{#if agentNameInputOpen}
	<form class="agent-name-form" onsubmit={handleNameSubmit}>
		<input
			type="text"
			bind:this={agentNameInputRef}
			bind:value={newPaneName}
			placeholder="agent name"
			class="agent-name-input"
			onblur={() => { if (!newPaneName.trim()) setTimeout(() => agentNameInputOpen = false, 150); }}
			onkeydown={(e) => { if (e.key === 'Escape') { newPaneName = ''; agentNameInputOpen = false; } }}
		/>
		<button
			type="button"
			class="cta cta-icon generate"
			onclick={generateAgentName}
			disabled={generatingName}
			title="Generate creative name"
		>
			<svg viewBox="0 0 16 16" width="12" height="12" class:spinning={generatingName}>
				<path d="M8 2a6 6 0 100 12 6 6 0 000-12zM4 8a4 4 0 118 0" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
				<circle cx="8" cy="4" r="1" fill="currentColor"/>
			</svg>
		</button>
		<button type="submit" class="cta cta-icon" disabled={!newPaneName.trim()} aria-label="Confirm">
			<svg viewBox="0 0 16 16" width="12" height="12">
				<path d="M3 8h10M9 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
			</svg>
		</button>
		<button type="button" class="cta cta-icon danger" onclick={() => { newPaneName = ''; agentNameInputOpen = false; }} aria-label="Cancel">
			<svg viewBox="0 0 16 16" width="10" height="10">
				<path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
			</svg>
		</button>
	</form>
{/if}

<!-- Resume prompt -->
{#if resumePrompt}
	<div class="resume-prompt">
		<svg viewBox="0 0 16 16" width="12" height="12" class="resume-icon">
			<path d="M3 8a5 5 0 019-2" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
			<path d="M12 3v3h-3" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
		</svg>
		<span class="resume-text">Resume <strong>{resumePrompt.name}</strong>?</span>
		<button class="cta cta-primary" onclick={handleResume}>
			<svg viewBox="0 0 12 12" width="10" height="10">
				<path d="M2 6l3 3 5-5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
			</svg>
			Resume
		</button>
		<button class="cta cta-ghost" onclick={handleFreshStart}>
			<svg viewBox="0 0 12 12" width="10" height="10">
				<circle cx="6" cy="6" r="4" fill="none" stroke="currentColor" stroke-width="1.2"/>
				<path d="M6 4v4M4 6h4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
			</svg>
			Fresh
		</button>
		<button class="cta cta-icon danger" onclick={() => { resumePrompt = null; }} aria-label="Dismiss">
			<svg viewBox="0 0 12 12" width="10" height="10">
				<path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
			</svg>
		</button>
	</div>
{/if}

<style>
	/* ===== Agent Launcher ===== */
	.agent-launcher {
		position: relative;
		flex-shrink: 0;
	}

	.launcher-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		height: 26px;
		padding: 0 10px;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 5px;
		color: var(--text-secondary);
		font: 500 11px/1 system-ui, -apple-system, sans-serif;
		cursor: pointer;
		transition: all 100ms ease;
	}

	.launcher-btn:hover {
		background: rgba(255, 255, 255, 0.07);
		border-color: rgba(255, 255, 255, 0.12);
		color: var(--text-primary);
	}

	.launcher-btn.active {
		background: rgba(99, 102, 241, 0.12);
		border-color: rgba(99, 102, 241, 0.25);
		color: var(--text-primary);
	}

	.launcher-caret {
		color: var(--text-tertiary);
		transition: transform 120ms ease;
	}

	.launcher-caret.open { transform: rotate(180deg); }

	.launcher-backdrop {
		position: fixed;
		inset: 0;
		z-index: 999;
	}

	.launcher-menu {
		position: absolute;
		bottom: calc(100% + 4px);
		left: 0;
		padding: 4px;
		background: rgba(28, 28, 32, 0.98);
		backdrop-filter: blur(20px) saturate(1.5);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 6px;
		box-shadow:
			0 0 0 0.5px rgba(0, 0, 0, 0.3),
			0 4px 16px rgba(0, 0, 0, 0.35),
			0 8px 32px rgba(0, 0, 0, 0.2);
		z-index: 1000;
		animation: menuSlide 100ms ease-out;
	}

	@keyframes menuSlide {
		from { opacity: 0; transform: translateY(3px); }
		to { opacity: 1; transform: translateY(0); }
	}

	.launcher-option {
		display: flex;
		align-items: center;
		gap: 8px;
		height: 26px;
		padding: 0 10px;
		background: transparent;
		border: none;
		border-radius: 5px;
		color: var(--text-primary);
		font: 500 11px/1 system-ui, -apple-system, sans-serif;
		text-align: left;
		cursor: pointer;
		transition: background 60ms ease;
		white-space: nowrap;
	}

	.launcher-option:hover { background: rgba(255, 255, 255, 0.08); }
	.launcher-option:active { background: rgba(255, 255, 255, 0.12); }

	.launcher-option svg {
		color: var(--text-tertiary);
		flex-shrink: 0;
		transition: color 60ms ease;
	}

	.launcher-option:hover svg { color: var(--text-secondary); }

	.option-label { flex-shrink: 0; }

	.option-badge {
		margin-left: auto;
		padding: 2px 6px;
		font: 500 9px/1 'IBM Plex Mono', ui-monospace, monospace;
		color: var(--text-tertiary);
		background: rgba(255, 255, 255, 0.06);
		border-radius: 4px;
	}

	:global(.app.light) .launcher-btn {
		background: rgba(0, 0, 0, 0.04);
		border-color: rgba(0, 0, 0, 0.08);
	}

	:global(.app.light) .launcher-btn:hover {
		background: rgba(0, 0, 0, 0.06);
		border-color: rgba(0, 0, 0, 0.12);
	}

	:global(.app.light) .launcher-btn.active {
		background: rgba(99, 102, 241, 0.1);
		border-color: rgba(99, 102, 241, 0.2);
	}

	:global(.app.light) .launcher-menu {
		background: rgba(255, 255, 255, 0.98);
		border-color: rgba(0, 0, 0, 0.08);
		box-shadow:
			0 0 0 0.5px rgba(0, 0, 0, 0.06),
			0 4px 16px rgba(0, 0, 0, 0.1),
			0 8px 32px rgba(0, 0, 0, 0.08);
	}

	:global(.app.light) .launcher-option:hover { background: rgba(0, 0, 0, 0.04); }
	:global(.app.light) .launcher-option:active { background: rgba(0, 0, 0, 0.07); }
	:global(.app.light) .option-badge { background: rgba(0, 0, 0, 0.05); }

	/* ===== Agent Name Input ===== */
	.agent-name-form {
		display: flex;
		align-items: center;
		gap: 4px;
		animation: slideIn 150ms ease-out;
	}

	@keyframes slideIn {
		from { opacity: 0; transform: translateX(-8px); }
		to { opacity: 1; transform: translateX(0); }
	}

	.agent-name-input {
		width: 140px;
		height: 26px;
		padding: 0 10px;
		font: 11px/1 'IBM Plex Mono', ui-monospace, monospace;
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid rgba(99, 102, 241, 0.3);
		border-radius: 5px;
		color: var(--text-primary);
		transition: all 100ms ease;
	}

	.agent-name-input:focus {
		outline: none;
		background: rgba(255, 255, 255, 0.1);
		border-color: rgba(99, 102, 241, 0.6);
		box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.15);
	}

	.agent-name-input::placeholder {
		color: var(--text-tertiary);
		font-style: italic;
	}

	:global(.app.light) .agent-name-input {
		background: rgba(0, 0, 0, 0.04);
		border-color: rgba(99, 102, 241, 0.25);
	}

	:global(.app.light) .agent-name-input:focus {
		background: rgba(0, 0, 0, 0.06);
	}

	.cta.generate {
		color: #a78bfa;
	}

	.cta.generate:hover {
		color: #c4b5fd;
		background: rgba(167, 139, 250, 0.12);
	}

	.cta.generate:disabled {
		opacity: 0.5;
		cursor: wait;
	}

	.cta.generate svg.spinning {
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		from { transform: rotate(0deg); }
		to { transform: rotate(360deg); }
	}

	/* ===== Resume Prompt ===== */
	.resume-prompt {
		display: flex;
		align-items: center;
		gap: 8px;
		height: 26px;
		padding: 0 10px;
		background: linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(99, 102, 241, 0.08) 100%);
		border: 1px solid rgba(99, 102, 241, 0.2);
		border-radius: 5px;
		animation: slideIn 150ms ease-out;
	}

	.resume-icon {
		color: rgba(99, 102, 241, 0.8);
		flex-shrink: 0;
	}

	.resume-text {
		font: 11px/1.2 system-ui;
		color: var(--text-secondary);
	}

	.resume-text strong {
		color: var(--text-primary);
		font-weight: 600;
	}

	:global(.app.light) .resume-prompt {
		background: linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(99, 102, 241, 0.05) 100%);
	}
</style>
