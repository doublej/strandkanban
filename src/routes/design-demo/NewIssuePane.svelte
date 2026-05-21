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
		if (open) tick().then(() => titleEl?.focus());
		else { title = ''; description = ''; expanded = false; }
	});

	function onKey(e: KeyboardEvent) {
		if (e.key === 'Escape') { e.preventDefault(); onclose(); return; }
		if (e.key === 'Tab' && !e.shiftKey && !expanded) { e.preventDefault(); expanded = true; return; }
		if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
			e.preventDefault();
			if (title.trim()) onclose();
		}
	}
</script>

{#if open}
	<div class="overlay" role="presentation" onclick={onclose}>
		<div class="spot" role="dialog" aria-label="New issue" onclick={(e) => e.stopPropagation()}>
			<header class="head">
				<span class="label">New issue</span>
				<button class="ctrl is-sm" onclick={onclose} title="Close">
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

				<div class="prop-row">
					<span class="label prop-label">Priority</span>
					<div class="pills">
						{#each priorities as p, i}
							<button
								class="ctrl is-sm"
								class:is-active={priority === p}
								onclick={() => (priority = p)}
							>
								<span class="dot" style="background: {getPriorityConfig(p).color};"></span>
								<span class="mono">{priorityLabels[i]}</span>
							</button>
						{/each}
					</div>
				</div>
				<div class="prop-row">
					<span class="label prop-label">Type</span>
					<div class="pills">
						{#each types as t}
							<button
								class="ctrl is-sm"
								class:is-active={issueType === t}
								onclick={() => (issueType = t)}
							>
								<Icon name={getTypeIcon(t)} size={12} />
								<span style="text-transform: capitalize;">{t}</span>
							</button>
						{/each}
					</div>
				</div>
			{/if}

			<footer class="foot">
				{#if !expanded}
					<button class="ctrl is-sm" onclick={() => (expanded = true)}>
						<span class="kbd">Tab</span>
						<span>add details</span>
					</button>
				{:else}
					<span class="summary">
						<span class="dot" style="background: {getPriorityConfig(priority).color};"></span>
						<span class="mono">{priorityLabels[priority]}</span>
						<span class="sep">·</span>
						<span style="text-transform: capitalize;">{issueType}</span>
					</span>
				{/if}

				<span class="spacer"></span>

				{#if agentMode}
					<button class="ctrl is-outline agent-btn" disabled={!title.trim()}>
						<Icon name="sparkles" size={12} />
						<span>Create + Agent</span>
						<span class="kbd-row">
							<span class="kbd">⌘⇧</span><span class="kbd">↵</span>
						</span>
					</button>
				{/if}
				<button class="ctrl is-primary" disabled={!title.trim()}>
					<span>Create</span>
					<span class="kbd-row">
						<span class="kbd is-inverse">⌘</span><span class="kbd is-inverse">↵</span>
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
	@keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }

	.spot {
		width: min(620px, calc(100vw - var(--sp-8)));
		background: var(--surf-1);
		border: 1px solid var(--line-2);
		border-radius: var(--r-md);
		box-shadow: var(--shadow-3);
		display: flex;
		flex-direction: column;
		padding: var(--sp-4);
		gap: var(--sp-3);
		animation: pop-in 160ms cubic-bezier(0.2, 0.7, 0.2, 1);
	}
	@keyframes pop-in {
		from { transform: translateY(-8px) scale(0.985); opacity: 0; }
		to { transform: translateY(0) scale(1); opacity: 1; }
	}

	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: var(--ctrl-md);
	}

	.title {
		font-size: var(--fs-xxl);
		font-weight: 500;
		line-height: var(--lh-tight);
		letter-spacing: -0.018em;
		border: 0;
		padding: var(--sp-1) 0;
		background: transparent;
		resize: none;
		min-height: calc(var(--fs-xxl) * var(--lh-tight) + var(--sp-2));
		outline: none;
		box-shadow: none;
	}
	.title::placeholder { color: var(--ink-4); }
	.title:focus { box-shadow: none; }

	.desc {
		font-size: var(--fs-md);
		line-height: var(--lh-prose);
		border: 0;
		padding: var(--sp-1) 0;
		background: transparent;
		resize: vertical;
		min-height: calc(var(--fs-md) * var(--lh-prose) * 4);
		outline: none;
		box-shadow: none;
	}
	.desc:focus { box-shadow: none; }

	.prop-row {
		display: grid;
		grid-template-columns: 72px 1fr;
		align-items: center;
		gap: var(--sp-3);
		min-height: var(--ctrl-md);
	}
	.prop-label { display: inline-flex; align-items: center; height: var(--ctrl-md); }
	.pills { display: flex; gap: var(--sp-1); }

	.foot {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		padding-top: var(--sp-3);
		border-top: 1px solid var(--line-1);
		min-height: var(--ctrl-xl);
	}
	.spacer { flex: 1; }

	.summary {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-1);
		font-size: var(--fs-xs);
		color: var(--ink-3);
		padding: 0 var(--sp-1);
	}
	.summary .sep { color: var(--ink-4); }

	.agent-btn {
		color: var(--agent);
		border-color: color-mix(in srgb, var(--agent) 35%, var(--line-2));
	}
	.agent-btn:not(:disabled):hover {
		background: color-mix(in srgb, var(--agent) 8%, var(--surf-1));
		border-color: color-mix(in srgb, var(--agent) 55%, var(--line-2));
	}

	.kbd-row { display: inline-flex; gap: 2px; }

	.ctrl:disabled { opacity: 0.4; cursor: default; }
</style>
