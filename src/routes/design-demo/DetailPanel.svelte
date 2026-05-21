<script lang="ts">
	import type { Issue } from '$lib/types';
	import { untrack } from 'svelte';
	import Icon from './Icon.svelte';
	import FacetWork from './FacetWork.svelte';
	import FacetState from './FacetState.svelte';
	import FacetLinks from './FacetLinks.svelte';
	import FacetActivity from './FacetActivity.svelte';

	type Props = {
		issue: Issue;
		closedExternally?: boolean;
		onclose: () => void;
	};
	let { issue, closedExternally = false, onclose }: Props = $props();

	let copied = $state(false);
	async function copyId() {
		await navigator.clipboard.writeText(issue.id);
		copied = true;
		setTimeout(() => (copied = false), 1200);
	}

	let banner = $state(untrack(() => closedExternally));
	$effect(() => { banner = closedExternally; });

	const canStartAgent = $derived(issue.status !== 'closed');
</script>

<aside class="panel" aria-label="Issue detail">
	<header class="panel-head">
		<button class="id-pill mono" onclick={copyId} title="Copy ID">
			<span>#{issue.id.replace(/^bk-0*/, '')}</span>
			<Icon name={copied ? 'check' : 'copy'} size={10} />
		</button>
		<span class="head-spacer"></span>
		<button class="icon-btn" title="Close" onclick={onclose}>
			<Icon name="x" size={14} />
		</button>
	</header>

	{#if banner}
		<div class="banner">
			<span class="banner-dot"></span>
			<span class="banner-text">Closed externally while open.</span>
			<button class="banner-x" onclick={() => (banner = false)} title="Dismiss">
				<Icon name="x" size={11} />
			</button>
		</div>
	{/if}

	<div class="body scrollarea">
		<FacetWork {issue} />

		<div class="divider"></div>

		<FacetState {issue} />

		<div class="divider"></div>

		<div class="facet">
			<header class="facet-head">
				<span class="facet-label">Links</span>
			</header>
			<FacetLinks {issue} />
		</div>

		<div class="divider"></div>

		<div class="facet">
			<header class="facet-head">
				<span class="facet-label">Activity</span>
			</header>
			<FacetActivity {issue} />
		</div>
	</div>

	<footer class="foot">
		<button class="btn-text">
			<Icon name="trash" size={12} /><span>Delete</span>
		</button>
		<span class="foot-spacer"></span>
		{#if canStartAgent}
			<button class="btn agent">
				<Icon name="play" size={11} /><span>Start Agent</span>
			</button>
		{/if}
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

	.panel-head {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 14px;
		border-bottom: 1px solid var(--dd-border-1);
	}

	.id-pill {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 4px 8px;
		border-radius: var(--dd-r-2);
		color: var(--dd-fg-3);
		font-size: 11px;
		transition: background 80ms, color 80ms;
	}
	.id-pill:hover { background: var(--dd-bg-2); color: var(--dd-fg-1); }

	.head-spacer { flex: 1; }

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
	.icon-btn:hover { color: var(--dd-fg-1); background: var(--dd-bg-2); }

	.banner {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 7px 14px;
		background: color-mix(in srgb, var(--dd-danger) 7%, var(--dd-bg-1));
		border-bottom: 1px solid color-mix(in srgb, var(--dd-danger) 20%, var(--dd-border-1));
		color: var(--dd-danger);
		font-size: 12px;
	}
	.banner-dot {
		width: 6px;
		height: 6px;
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
	.banner-x:hover { color: var(--dd-fg-1); background: var(--dd-bg-2); }

	.body {
		flex: 1;
		overflow-y: auto;
		padding: 20px;
		display: flex;
		flex-direction: column;
		gap: 18px;
	}

	.divider {
		height: 1px;
		background: var(--dd-border-1);
		margin: 0 -4px;
	}

	.facet {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.facet-head {
		display: flex;
		align-items: baseline;
		gap: 6px;
	}
	.facet-label {
		font-size: 10.5px;
		text-transform: uppercase;
		letter-spacing: 0.07em;
		color: var(--dd-fg-3);
		font-weight: 500;
	}

	.foot {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 14px;
		border-top: 1px solid var(--dd-border-1);
		background: var(--dd-bg-1);
	}
	.foot-spacer { flex: 1; }

	.btn-text {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 6px 10px;
		font-size: 12px;
		color: var(--dd-fg-3);
		border-radius: var(--dd-r-2);
		transition: color 80ms, background 80ms;
	}
	.btn-text:hover {
		color: var(--dd-danger);
		background: color-mix(in srgb, var(--dd-danger) 8%, var(--dd-bg-1));
	}

	.btn {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 8px 14px;
		border-radius: var(--dd-r-2);
		font-size: 12.5px;
		font-weight: 500;
		transition: background 80ms;
	}
	.btn.agent {
		background: var(--dd-agent);
		color: white;
	}
	.btn.agent:hover {
		background: color-mix(in srgb, var(--dd-agent) 88%, black);
	}
</style>
