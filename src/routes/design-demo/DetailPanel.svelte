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
		<button class="ctrl is-sm" onclick={copyId} title="Copy ID">
			<span class="mono">#{issue.id.replace(/^bk-0*/, '')}</span>
			<Icon name={copied ? 'check' : 'copy'} size={12} />
		</button>
		<span class="spacer"></span>
		<button class="icon-btn" title="Close" onclick={onclose}>
			<Icon name="x" size={16} />
		</button>
	</header>

	{#if banner}
		<div class="banner">
			<span class="dot" style="background: var(--danger);"></span>
			<span class="banner-text">Closed externally while open.</span>
			<button class="icon-btn" onclick={() => (banner = false)} title="Dismiss">
				<Icon name="x" size={12} />
			</button>
		</div>
	{/if}

	<div class="body scrollarea">
		<section class="facet">
			<FacetWork {issue} />
		</section>

		<section class="facet">
			<header class="facet-head"><span class="label">State</span></header>
			<FacetState {issue} />
		</section>

		<section class="facet">
			<header class="facet-head"><span class="label">Links</span></header>
			<FacetLinks {issue} />
		</section>

		<section class="facet">
			<header class="facet-head"><span class="label">Activity</span></header>
			<FacetActivity {issue} />
		</section>
	</div>

	<footer class="panel-foot">
		<button class="ctrl is-sm danger-text">
			<Icon name="trash" size={12} /><span>Delete</span>
		</button>
		<span class="spacer"></span>
		{#if canStartAgent}
			<button class="ctrl is-agent">
				<Icon name="play" size={12} /><span>Start Agent</span>
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
		background: var(--surf-1);
		border-left: 1px solid var(--line-2);
		box-shadow: var(--shadow-3);
		display: flex;
		flex-direction: column;
		z-index: 50;
		animation: slide-in 180ms cubic-bezier(0.2, 0.6, 0.2, 1);
	}
	@keyframes slide-in {
		from { transform: translateX(20px); opacity: 0; }
		to { transform: translateX(0); opacity: 1; }
	}

	.panel-head, .panel-foot {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		padding: var(--sp-2) var(--sp-3);
		border-bottom: 1px solid var(--line-1);
		min-height: var(--ctrl-xl);
	}
	.panel-foot {
		border-bottom: 0;
		border-top: 1px solid var(--line-1);
	}
	.spacer { flex: 1; }

	.banner {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		padding: var(--sp-2) var(--sp-3);
		background: color-mix(in srgb, var(--danger) 7%, var(--surf-1));
		border-bottom: 1px solid color-mix(in srgb, var(--danger) 20%, var(--line-1));
		color: var(--danger);
		font-size: var(--fs-sm);
		min-height: var(--ctrl-xl);
	}
	.banner-text { flex: 1; }

	.body {
		flex: 1;
		overflow-y: auto;
		padding: var(--sp-6) var(--panel-pad) var(--sp-8);
		display: flex;
		flex-direction: column;
		gap: var(--facet-gap);
	}

	.facet {
		display: flex;
		flex-direction: column;
		gap: var(--section-gap);
	}
	.facet-head {
		display: flex;
		align-items: baseline;
		height: var(--ctrl-md);
		margin-bottom: calc(var(--sp-1) * -1);
	}

	.danger-text:hover {
		color: var(--danger);
		background: color-mix(in srgb, var(--danger) 8%, var(--surf-1));
	}
</style>
