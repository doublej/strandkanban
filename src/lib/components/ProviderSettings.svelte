<script lang="ts">
	import { onMount } from 'svelte';
	import { settings } from '$lib/stores/settings.svelte';
	import {
		PROVIDERS,
		CLAUDE_MODELS,
		CLAUDE_PERMISSION_MODES,
		CODEX_MODEL_SUGGESTIONS,
		CODEX_SANDBOXES,
		checkOpencodeModel
	} from '$lib/agent/provider-options';
	import type { ProviderId } from '$lib/server/agent/providers/types';
	import Icon from './Icon.svelte';

	type Availability = Record<ProviderId, { available: boolean; detail: string }>;

	let availability = $state<Availability | null>(null);
	let checking = $state(false);

	async function checkAvailability() {
		checking = true;
		try {
			const res = await fetch('/api/agent/providers');
			availability = res.ok ? await res.json() : null;
		} catch {
			availability = null;
		} finally {
			checking = false;
		}
	}

	onMount(checkAvailability);

	const active = $derived(settings.agentProvider);
	const model = $derived(settings.agentModels[active] ?? '');
	const opencodeWarning = $derived(active === 'opencode' ? checkOpencodeModel(model) : null);

	function setModel(value: string) {
		settings.setAgentModel(active, value);
	}
</script>

<section class="settings-section">
	<div class="section-head">
		<h3 class="section-label">Agent provider</h3>
		<button class="btn-recheck" onclick={checkAvailability} disabled={checking}>
			<Icon name="refresh" size={11} />
			<span>{checking ? 'Checking…' : 'Re-check'}</span>
		</button>
	</div>

	<div class="strategy-selector">
		{#each PROVIDERS as p}
			{@const status = availability?.[p.id]}
			<button
				class="strategy-option"
				class:active={active === p.id}
				onclick={() => (settings.agentProvider = p.id)}
			>
				<span class="option-head">
					<span class="strategy-label">{p.label}</span>
					{#if status}
						<span class="status-chip" class:missing={!status.available} title={status.detail}>
							{status.available ? status.detail : 'not installed'}
						</span>
					{/if}
				</span>
				<span class="strategy-hint">{p.description}</span>
				{#if status && !status.available}
					<span class="strategy-warn">{status.detail} — install it or sessions will fail at launch.</span>
				{/if}
			</button>
		{/each}
	</div>

	<!-- Model: the shape differs per provider, so this is not one shared control. -->
	<div class="setting-row" style="margin-top: 1rem;">
		<div class="setting-info">
			<span class="setting-name">Model</span>
			<span class="setting-desc">Saved per provider — switching keeps each one's choice</span>
		</div>
	</div>

	{#if active === 'claude'}
		<div class="strategy-selector">
			{#each CLAUDE_MODELS as opt}
				<button class="strategy-option" class:active={model === opt.value} onclick={() => setModel(opt.value)}>
					<span class="strategy-label">{opt.label}</span>
					<span class="strategy-hint">{opt.hint}</span>
				</button>
			{/each}
		</div>

		<div class="setting-row" style="margin-top: 1rem;">
			<div class="setting-info">
				<span class="setting-name">Permission mode</span>
				<span class="setting-desc">Applies to new sessions; change a running one from its pane menu</span>
			</div>
		</div>
		<div class="strategy-selector">
			{#each CLAUDE_PERMISSION_MODES as opt}
				<button
					class="strategy-option"
					class:active={settings.agentPermissionMode === opt.value}
					onclick={() => (settings.agentPermissionMode = opt.value)}
				>
					<span class="strategy-label">{opt.label}</span>
					<span class="strategy-hint">{opt.hint}</span>
				</button>
			{/each}
		</div>
		{#if settings.agentPermissionMode === 'default'}
			<p class="note warn">
				"Ask" prompts for every tool, but there is no approval UI yet — the agent will stall
				waiting for an answer it cannot receive.
			</p>
		{/if}
	{:else if active === 'codex'}
		<div class="config-row">
			<input
				class="config-input"
				list="codex-models"
				bind:value={() => model, setModel}
				placeholder="default (leave empty)"
				aria-label="Codex model"
			/>
			<datalist id="codex-models">
				{#each CODEX_MODEL_SUGGESTIONS as m}<option value={m}></option>{/each}
			</datalist>
		</div>
		<p class="note">Suggestions only. The real list arrives from the app-server once a session connects.</p>

		<div class="setting-row" style="margin-top: 1rem;">
			<div class="setting-info">
				<span class="setting-name">Sandbox</span>
				<span class="setting-desc">Codex is the only provider with a real OS sandbox</span>
			</div>
		</div>
		<div class="strategy-selector">
			{#each CODEX_SANDBOXES as opt}
				<button
					class="strategy-option"
					class:active={settings.codexSandbox === opt.value}
					onclick={() => (settings.codexSandbox = opt.value)}
				>
					<span class="strategy-label">{opt.label}</span>
					<span class="strategy-hint">{opt.hint}</span>
				</button>
			{/each}
		</div>
		{#if settings.codexSandbox === 'danger-full-access'}
			<p class="note warn">No sandbox: the agent can write anywhere your user account can.</p>
		{/if}
		<p class="note">
			Approvals stay <code>never</code> — the board runs agents unattended, and a prompt no
			one can answer is a hung session.
		</p>
	{:else}
		<div class="config-row">
			<input
				class="config-input"
				class:invalid={!!opencodeWarning}
				bind:value={() => model, setModel}
				placeholder="anthropic/claude-sonnet-4-5"
				aria-label="opencode model"
			/>
		</div>
		{#if opencodeWarning}
			<p class="note warn">{opencodeWarning}</p>
		{:else}
			<p class="note">
				Format <code>providerID/model#variant</code>. Empty uses the opencode server's own default.
			</p>
		{/if}
		<p class="note">
			The server is spawned per boot on 127.0.0.1 with a random password and an
			allow-all permission set — nothing to configure, nothing exposed off-host.
		</p>
	{/if}

	{#if active !== 'claude'}
		<p class="note">
			Manager sessions stay on Claude regardless of this setting — its orchestration tools are
			in-process Claude servers.
		</p>
	{/if}
</section>

<style>
	.settings-section {
		padding: 0.75rem 1.25rem;
	}

	.section-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.625rem;
	}

	.section-label {
		font-size: 0.625rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--text-tertiary);
		margin: 0;
	}

	.btn-recheck {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.25rem 0.5rem;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: var(--radius-sm);
		color: var(--text-tertiary);
		font-family: inherit;
		font-size: 0.625rem;
		cursor: pointer;
		transition: all 150ms ease;
	}

	.btn-recheck:hover:not(:disabled) {
		background: rgba(255, 255, 255, 0.08);
		color: var(--text-secondary);
	}

	.btn-recheck:disabled {
		opacity: 0.5;
		cursor: default;
	}

	:global(.app.light) .btn-recheck {
		background: rgba(0, 0, 0, 0.03);
		border-color: rgba(0, 0, 0, 0.08);
	}

	.setting-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.setting-info {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}

	.setting-name {
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--text-primary);
	}

	.setting-desc {
		font-size: 0.6875rem;
		color: var(--text-tertiary);
	}

	.strategy-selector {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		padding: 0.5rem 0 0 0;
	}

	.strategy-option {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 0.625rem 0.75rem;
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: var(--radius-md);
		text-align: left;
		cursor: pointer;
		transition: all 180ms ease;
	}

	.strategy-option:hover {
		background: rgba(255, 255, 255, 0.06);
		border-color: rgba(255, 255, 255, 0.12);
	}

	.strategy-option.active {
		background: rgba(34, 211, 238, 0.12);
		border-color: rgba(34, 211, 238, 0.3);
	}

	:global(.app.light) .strategy-option {
		background: rgba(0, 0, 0, 0.02);
		border-color: rgba(0, 0, 0, 0.06);
	}

	:global(.app.light) .strategy-option.active {
		background: rgba(14, 165, 233, 0.12);
		border-color: rgba(14, 165, 233, 0.3);
	}

	.option-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.strategy-label {
		font-weight: 600;
		font-size: 0.8125rem;
		color: var(--text-primary);
	}

	.strategy-hint {
		font-size: 0.6875rem;
		color: var(--text-tertiary);
	}

	.strategy-warn {
		font-size: 0.6875rem;
		color: #f59e0b;
	}

	.status-chip {
		font-family: ui-monospace, 'SF Mono', monospace;
		font-size: 0.5625rem;
		padding: 0.125rem 0.375rem;
		border-radius: 3px;
		background: rgba(16, 185, 129, 0.12);
		color: #10b981;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 45%;
	}

	.status-chip.missing {
		background: rgba(239, 68, 68, 0.12);
		color: #ef4444;
	}

	.config-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding-top: 0.5rem;
	}

	.config-input {
		flex: 1;
		padding: 0.375rem 0.5rem;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: var(--radius-sm);
		color: var(--text-primary);
		font-family: ui-monospace, 'SF Mono', monospace;
		font-size: 0.6875rem;
	}

	.config-input:focus {
		outline: none;
		border-color: rgba(34, 211, 238, 0.4);
	}

	.config-input.invalid {
		border-color: rgba(245, 158, 11, 0.5);
	}

	:global(.app.light) .config-input {
		background: rgba(0, 0, 0, 0.03);
		border-color: rgba(0, 0, 0, 0.08);
	}

	.note {
		margin: 0.5rem 0 0 0;
		font-size: 0.6875rem;
		line-height: 1.45;
		color: var(--text-tertiary);
	}

	.note.warn {
		color: #f59e0b;
	}

	.note code {
		font-family: ui-monospace, 'SF Mono', monospace;
		font-size: 0.625rem;
		background: rgba(255, 255, 255, 0.06);
		padding: 0.0625rem 0.25rem;
		border-radius: 3px;
	}

	:global(.app.light) .note code {
		background: rgba(0, 0, 0, 0.05);
	}
</style>
