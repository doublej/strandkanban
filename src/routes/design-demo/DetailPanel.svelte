<script lang="ts">
	import type { Issue } from '$lib/types';
	import Icon from './Icon.svelte';
	import DetailViewBody from './DetailViewBody.svelte';
	import DetailEditBody from './DetailEditBody.svelte';

	type Props = {
		issue: Issue;
		mode?: 'view' | 'edit';
		closedExternally?: boolean;
		onclose: () => void;
		onmodechange?: (m: 'view' | 'edit') => void;
	};
	let {
		issue,
		mode = 'view',
		closedExternally = false,
		onclose,
		onmodechange
	}: Props = $props();

	let copied = $state(false);
	async function copyId() {
		await navigator.clipboard.writeText(issue.id);
		copied = true;
		setTimeout(() => (copied = false), 1200);
	}

	let banner = $state(closedExternally);
	$effect(() => { banner = closedExternally; });

	const canStartAgent = $derived(issue.status !== 'closed');
</script>

<aside class="panel" aria-label="Issue detail">
	<header class="head">
		<button class="id-badge mono" onclick={copyId} title="Copy ID">
			<span>{issue.id.replace('bk-', '#')}</span>
			<Icon name={copied ? 'check' : 'copy'} size={11} />
		</button>

		<div class="mode-toggle" role="tablist" aria-label="View or edit">
			<button
				role="tab"
				aria-selected={mode === 'view'}
				class:active={mode === 'view'}
				onclick={() => onmodechange?.('view')}
			>
				<Icon name="eye" size={11} />
				<span>View</span>
			</button>
			<button
				role="tab"
				aria-selected={mode === 'edit'}
				class:active={mode === 'edit'}
				onclick={() => onmodechange?.('edit')}
			>
				<Icon name="edit" size={11} />
				<span>Edit</span>
			</button>
		</div>

		<button class="icon-btn" title="Close" onclick={onclose}>
			<Icon name="x" size={14} />
		</button>
	</header>

	{#if banner}
		<div class="banner">
			<span class="banner-dot"></span>
			<span class="banner-text">Issue was closed externally while you had it open.</span>
			<button class="banner-x" onclick={() => (banner = false)} title="Dismiss">
				<Icon name="x" size={11} />
			</button>
		</div>
	{/if}

	{#if mode === 'view'}
		<DetailViewBody {issue} />
	{:else}
		<DetailEditBody {issue} />
	{/if}

	<footer class="foot">
		<button class="btn danger">
			<Icon name="trash" size={12} /><span>Delete</span>
		</button>
		<span class="foot-spacer"></span>
		{#if canStartAgent}
			<button class="btn agent">
				<Icon name="play" size={11} /><span>Start Agent</span>
			</button>
		{/if}
		<button class="btn primary">
			<span>Save</span>
		</button>
	</footer>
</aside>

<style>
	.panel {
		position: fixed;
		top: 0;
		right: 0;
		bottom: 0;
		width: min(540px, 100vw);
		background: var(--dd-bg-1);
		border-left: 1px solid var(--dd-border-2);
		box-shadow: var(--dd-shadow-3);
		display: flex;
		flex-direction: column;
		z-index: 50;
		animation: slide-in 180ms cubic-bezier(0.2, 0.6, 0.2, 1);
	}

	@keyframes slide-in {
		from { transform: translateX(20px); opacity: 0; }
		to { transform: translateX(0); opacity: 1; }
	}

	.head {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 12px 14px;
		border-bottom: 1px solid var(--dd-border-1);
	}

	.id-badge {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 5px 9px;
		border-radius: var(--dd-r-2);
		background: var(--dd-bg-2);
		border: 1px solid var(--dd-border-1);
		color: var(--dd-fg-2);
		font-size: 11.5px;
		transition: color 80ms, background 80ms;
	}
	.id-badge:hover { color: var(--dd-fg-1); background: var(--dd-bg-3); }

	.mode-toggle {
		display: inline-flex;
		gap: 2px;
		margin-left: auto;
		background: var(--dd-bg-2);
		border: 1px solid var(--dd-border-1);
		border-radius: var(--dd-r-2);
		padding: 2px;
	}
	.mode-toggle button {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 4px 9px;
		border-radius: 3px;
		color: var(--dd-fg-3);
		font-size: 11.5px;
		font-weight: 500;
		transition: background 80ms, color 80ms;
	}
	.mode-toggle button:hover {
		color: var(--dd-fg-1);
	}
	.mode-toggle button.active {
		background: var(--dd-accent);
		color: white;
	}

	.icon-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 26px;
		height: 26px;
		border-radius: var(--dd-r-2);
		color: var(--dd-fg-3);
		transition: background 80ms, color 80ms;
	}
	.icon-btn:hover { color: var(--dd-fg-1); background: var(--dd-bg-3); }

	.banner {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 14px;
		background: color-mix(in srgb, var(--dd-danger) 10%, var(--dd-bg-2));
		border-bottom: 1px solid color-mix(in srgb, var(--dd-danger) 25%, var(--dd-border-1));
		color: color-mix(in srgb, var(--dd-danger) 60%, var(--dd-fg-1));
		font-size: 12px;
	}
	.banner-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--dd-danger);
	}
	.banner-text { flex: 1; }
	.banner-x {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		border-radius: 3px;
		color: var(--dd-fg-3);
	}
	.banner-x:hover { color: var(--dd-fg-1); background: var(--dd-bg-3); }

	.foot {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 12px 14px;
		border-top: 1px solid var(--dd-border-1);
		background: var(--dd-bg-1);
	}
	.foot-spacer { flex: 1; }

	.btn {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 8px 12px;
		border-radius: var(--dd-r-2);
		font-size: 12.5px;
		font-weight: 500;
		transition: background 80ms, color 80ms;
	}
	.btn.danger {
		color: var(--dd-danger);
		background: transparent;
		border: 1px solid color-mix(in srgb, var(--dd-danger) 30%, var(--dd-border-2));
	}
	.btn.danger:hover {
		background: color-mix(in srgb, var(--dd-danger) 12%, var(--dd-bg-2));
	}
	.btn.primary {
		background: var(--dd-accent);
		color: white;
	}
	.btn.primary:hover {
		background: color-mix(in srgb, var(--dd-accent) 88%, white);
	}
	.btn.agent {
		background: color-mix(in srgb, var(--dd-agent) 22%, var(--dd-bg-2));
		color: var(--dd-agent);
		border: 1px solid color-mix(in srgb, var(--dd-agent) 45%, var(--dd-border-2));
	}
	.btn.agent:hover {
		background: color-mix(in srgb, var(--dd-agent) 30%, var(--dd-bg-2));
	}
</style>
