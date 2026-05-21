<script lang="ts">
	import { getPriorityConfig, getTypeIcon } from '$lib/utils';
	import { tick } from 'svelte';
	import Icon from './Icon.svelte';

	type Props = { open: boolean; onclose: () => void; agentMode?: boolean };
	let { open, onclose, agentMode = true }: Props = $props();

	let title = $state('');
	let description = $state('');
	let priority = $state<0 | 1 | 2 | 3 | 4>(2);
	let issueType = $state<'task' | 'bug' | 'feature' | 'epic' | 'chore'>('task');
	let expanded = $state(false);

	let titleEl: HTMLTextAreaElement | undefined;

	const priorities = [0, 1, 2, 3, 4] as const;
	const priorityLabels = ['P0', 'P1', 'P2', 'P3', 'P4'];
	const types = ['task', 'bug', 'feature', 'epic', 'chore'] as const;

	$effect(() => {
		if (open) {
			tick().then(() => titleEl?.focus());
		} else {
			title = '';
			description = '';
			expanded = false;
		}
	});

	function onKey(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			onclose();
			return;
		}
		if (e.key === 'Tab' && !e.shiftKey && !expanded) {
			e.preventDefault();
			expanded = true;
			return;
		}
		if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
			e.preventDefault();
			if (!title.trim()) return;
			// Create — with agent if shift held
			onclose();
		}
	}
</script>

{#if open}
	<div class="overlay" role="presentation" onclick={onclose}>
		<div class="spot" role="dialog" aria-label="New issue" onclick={(e) => e.stopPropagation()}>
			<header class="spot-head">
				<span class="eyebrow">NEW ISSUE</span>
				<button class="close" onclick={onclose} title="Close (Esc)">
					<span class="kbd">Esc</span>
				</button>
			</header>

			<textarea
				bind:this={titleEl}
				class="title"
				bind:value={title}
				placeholder="What needs to be done?"
				rows="1"
				onkeydown={onKey}
			></textarea>

			{#if expanded}
				<textarea
					class="desc"
					bind:value={description}
					placeholder="Add details…"
					rows="4"
					onkeydown={onKey}
				></textarea>

				<div class="row">
					<div class="group">
						<span class="group-label">Priority</span>
						<div class="pills">
							{#each priorities as p, i}
								<button
									class="pill"
									class:active={priority === p}
									style="--accent: {getPriorityConfig(p).color};"
									onclick={() => (priority = p)}
								>
									<span class="dot" style="background: {getPriorityConfig(p).color};"></span>
									<span class="mono">{priorityLabels[i]}</span>
								</button>
							{/each}
						</div>
					</div>

					<div class="group">
						<span class="group-label">Type</span>
						<div class="pills">
							{#each types as t}
								<button
									class="pill"
									class:active={issueType === t}
									onclick={() => (issueType = t)}
								>
									<Icon name={getTypeIcon(t)} size={11} />
									<span>{t}</span>
								</button>
							{/each}
						</div>
					</div>
				</div>
			{/if}

			<footer class="spot-foot">
				{#if !expanded}
					<button class="hint-btn" onclick={() => (expanded = true)}>
						<span class="kbd">Tab</span>
						<span>add details</span>
					</button>
				{:else}
					<span class="hint">
						<span class="dot" style="background: {getPriorityConfig(priority).color};"></span>
						<span class="mono">{priorityLabels[priority]}</span>
						<span class="sep">·</span>
						<span>{issueType}</span>
					</span>
				{/if}

				<span class="spacer"></span>

				{#if agentMode}
					<button class="cta agent" disabled={!title.trim()}>
						<Icon name="sparkles" size={11} />
						<span>Create + Agent</span>
						<span class="kbd-row">
							<span class="kbd">⌘⇧</span><span class="kbd">↵</span>
						</span>
					</button>
				{/if}
				<button class="cta primary" disabled={!title.trim()}>
					<span>Create</span>
					<span class="kbd-row">
						<span class="kbd">⌘</span><span class="kbd">↵</span>
					</span>
				</button>
			</footer>
		</div>
	</div>
{/if}

<style>
	.overlay {
		position: fixed;
		inset: 0;
		background: rgba(20, 20, 25, 0.32);
		backdrop-filter: blur(4px);
		display: flex;
		align-items: flex-start;
		justify-content: center;
		padding-top: 14vh;
		z-index: 60;
		animation: fade-in 140ms ease-out;
	}
	@keyframes fade-in {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	.spot {
		width: min(620px, calc(100vw - 32px));
		background: var(--dd-bg-1);
		border: 1px solid var(--dd-border-2);
		border-radius: 10px;
		box-shadow: var(--dd-shadow-3);
		display: flex;
		flex-direction: column;
		padding: 14px 16px 12px;
		gap: 10px;
		animation: pop-in 160ms cubic-bezier(0.2, 0.7, 0.2, 1);
	}
	@keyframes pop-in {
		from { transform: translateY(-8px) scale(0.985); opacity: 0; }
		to { transform: translateY(0) scale(1); opacity: 1; }
	}

	.spot-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.eyebrow {
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.09em;
		font-weight: 600;
		color: var(--dd-fg-3);
	}
	.close {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		font-size: 10px;
		color: var(--dd-fg-4);
		padding: 3px 6px;
		border-radius: 4px;
		transition: color 80ms, background 80ms;
	}
	.close:hover { color: var(--dd-fg-2); background: var(--dd-bg-2); }

	.title {
		font-size: 22px;
		font-weight: 500;
		line-height: 1.3;
		letter-spacing: -0.018em;
		border: 0;
		padding: 4px 0;
		background: transparent;
		resize: none;
		min-height: 36px;
		outline: none;
		box-shadow: none;
	}
	.title::placeholder {
		color: var(--dd-fg-4);
	}
	.title:focus {
		box-shadow: none;
	}

	.desc {
		font-size: 13.5px;
		line-height: 1.6;
		border: 0;
		padding: 4px 0;
		background: transparent;
		resize: vertical;
		min-height: 70px;
		outline: none;
		box-shadow: none;
	}
	.desc:focus {
		box-shadow: none;
	}

	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 16px;
		padding: 4px 0;
	}
	.group {
		display: flex;
		flex-direction: column;
		gap: 5px;
	}
	.group-label {
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.07em;
		font-weight: 500;
		color: var(--dd-fg-4);
	}
	.pills { display: flex; gap: 3px; }
	.pill {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		height: 24px;
		padding: 0 9px;
		border: 1px solid var(--dd-border-1);
		background: var(--dd-bg-1);
		border-radius: var(--dd-r-2);
		font-size: 11.5px;
		color: var(--dd-fg-2);
		transition: background 80ms, color 80ms, border-color 80ms;
	}
	.pill:hover {
		background: var(--dd-bg-2);
		color: var(--dd-fg-1);
	}
	.pill.active {
		background: color-mix(in srgb, var(--accent, var(--dd-fg-2)) 14%, var(--dd-bg-1));
		border-color: color-mix(in srgb, var(--accent, var(--dd-fg-2)) 45%, var(--dd-border-1));
		color: var(--dd-fg-1);
	}
	.dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		display: inline-block;
	}

	.spot-foot {
		display: flex;
		align-items: center;
		gap: 8px;
		padding-top: 8px;
		border-top: 1px solid var(--dd-border-1);
	}
	.spacer { flex: 1; }

	.hint-btn {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-size: 11px;
		color: var(--dd-fg-3);
		padding: 4px 8px;
		border-radius: 4px;
		transition: color 80ms, background 80ms;
	}
	.hint-btn:hover { color: var(--dd-fg-1); background: var(--dd-bg-2); }

	.hint {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-size: 11px;
		color: var(--dd-fg-3);
		padding: 4px 0;
	}
	.hint .sep { color: var(--dd-fg-4); }

	.cta {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 7px 12px;
		border-radius: var(--dd-r-2);
		font-size: 12px;
		font-weight: 500;
		transition: background 80ms;
	}
	.cta:disabled { opacity: 0.4; cursor: default; }
	.cta.primary {
		background: var(--dd-accent);
		color: white;
	}
	.cta.primary:not(:disabled):hover {
		background: color-mix(in srgb, var(--dd-accent) 90%, black);
	}
	.cta.agent {
		background: transparent;
		color: var(--dd-agent);
		border: 1px solid color-mix(in srgb, var(--dd-agent) 35%, var(--dd-border-2));
	}
	.cta.agent:not(:disabled):hover {
		background: color-mix(in srgb, var(--dd-agent) 8%, var(--dd-bg-1));
	}

	.kbd {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 16px;
		height: 16px;
		padding: 0 4px;
		font-size: 9.5px;
		font-family: var(--dd-font-mono);
		font-weight: 500;
		border-radius: 3px;
		background: var(--dd-bg-2);
		color: var(--dd-fg-3);
		border: 1px solid var(--dd-border-2);
	}
	.cta.primary .kbd {
		background: rgba(255, 255, 255, 0.22);
		color: rgba(255, 255, 255, 0.92);
		border-color: transparent;
	}
	.cta.agent .kbd {
		background: var(--dd-bg-2);
		color: var(--dd-fg-3);
		border-color: var(--dd-border-2);
	}
	.kbd-row { display: inline-flex; gap: 2px; }
</style>
