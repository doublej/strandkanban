<script lang="ts">
	import type { Issue } from '$lib/types';
	import { parseStateLabels } from '$lib/utils';
	import Icon from './Icon.svelte';

	interface Props {
		issue: Issue;
		onsetstate?: (dimension: string, value: string, reason?: string) => void;
	}

	let { issue, onsetstate }: Props = $props();

	const parsedLabels = $derived(parseStateLabels(issue.labels));

	// Operational-state inline editor
	let showStateEditor = $state(false);
	let stateDim = $state('');
	let stateVal = $state('');
	const STATE_TOKEN = /^[a-zA-Z0-9_-]+$/;
	const canSubmitState = $derived(STATE_TOKEN.test(stateDim.trim()) && STATE_TOKEN.test(stateVal.trim()));

	function submitState() {
		if (!canSubmitState || !onsetstate) return;
		onsetstate(stateDim.trim(), stateVal.trim());
		stateDim = '';
		stateVal = '';
		showStateEditor = false;
	}
</script>

{#if parsedLabels.states.length > 0 || onsetstate}
	<div class="state-row">
		{#each parsedLabels.states as st (st.dimension + ':' + st.value)}
			<span class="state-badge" title="Operational state"><span class="state-dim">{st.dimension}</span><span class="state-val">{st.value}</span></span>
		{/each}
		{#if onsetstate}
			<button class="state-add" onclick={() => showStateEditor = !showStateEditor} title="Set operational state"><Icon name={showStateEditor ? 'close' : 'plus'} size={11} /><span>state</span></button>
		{/if}
	</div>
	{#if showStateEditor && onsetstate}
		<div class="state-editor">
			<input class="state-input" placeholder="dimension" bind:value={stateDim} onkeydown={(e) => e.key === 'Enter' && submitState()} />
			<span class="state-eq">=</span>
			<input class="state-input" placeholder="value" bind:value={stateVal} onkeydown={(e) => e.key === 'Enter' && submitState()} />
			<button class="state-set" disabled={!canSubmitState} onclick={submitState}>Set</button>
		</div>
	{/if}
{/if}
{#if issue.external_ref || issue.spec_id}
	<div class="facet-row">
		{#if issue.external_ref}
			{#if /^https?:\/\//.test(issue.external_ref)}
				<a class="facet-chip" href={issue.external_ref} target="_blank" rel="noopener noreferrer" title={issue.external_ref}><Icon name="external-link" size={10} /><span>{issue.external_ref}</span></a>
			{:else}
				<span class="facet-chip" title="External reference"><Icon name="external-link" size={10} /><span>{issue.external_ref}</span></span>
			{/if}
		{/if}
		{#if issue.spec_id}
			<span class="facet-chip" title="Spec"><Icon name="file" size={10} /><span>{issue.spec_id}</span></span>
		{/if}
	</div>
{/if}
{#if parsedLabels.plain.length > 0}
	<div class="labels-row">
		{#each parsedLabels.plain as label (label)}<span class="label-chip">{label}</span>{/each}
	</div>
{/if}

<style>
	/* operational-state badges + external_ref/spec facets */
	.state-row, .facet-row { display: flex; flex-wrap: wrap; gap: 0.375rem; margin-top: 0.5rem; }
	.state-badge {
		display: inline-flex; align-items: stretch; border-radius: var(--radius-xs); overflow: hidden;
		font-family: 'IBM Plex Mono', ui-monospace, monospace; font-size: 0.625rem; font-weight: 600;
	}
	.state-badge .state-dim { padding: 0.125rem 0.375rem; background: rgba(20, 184, 166, 0.16); color: #14b8a6; text-transform: uppercase; letter-spacing: 0.03em; }
	.state-badge .state-val { padding: 0.125rem 0.375rem; background: rgba(20, 184, 166, 0.28); color: #0d9488; }
	.state-add {
		display: inline-flex; align-items: center; gap: 3px;
		padding: 0.125rem 0.4rem; border-radius: var(--radius-xs);
		background: transparent; border: 1px dashed var(--border-default);
		color: var(--text-tertiary); font-size: 0.625rem; font-weight: 600; cursor: pointer;
	}
	.state-add:hover { color: #14b8a6; border-color: #14b8a6; }
	.state-editor { display: flex; align-items: center; gap: 0.375rem; margin-top: 0.375rem; }
	.state-eq { color: var(--text-tertiary); font-weight: 700; }
	.state-input {
		flex: 1; min-width: 0; padding: 0.25rem 0.5rem; border-radius: var(--radius-xs);
		background: rgba(255,255,255,0.04); border: 1px solid var(--border-subtle);
		color: var(--text-primary); font-family: 'IBM Plex Mono', ui-monospace, monospace; font-size: 0.6875rem;
	}
	.state-input:focus { outline: none; border-color: #14b8a6; }
	.state-set {
		padding: 0.25rem 0.625rem; border-radius: var(--radius-xs);
		background: #14b8a6; border: none; color: #fff; font-size: 0.6875rem; font-weight: 600; cursor: pointer;
	}
	.state-set:disabled { opacity: 0.4; cursor: not-allowed; }

	.facet-chip {
		display: inline-flex; align-items: center; gap: 4px; max-width: 100%;
		padding: 0.1875rem 0.4rem; border-radius: var(--radius-xs);
		background: var(--surface-panel, rgba(255,255,255,0.04)); color: var(--text-secondary);
		font-family: 'IBM Plex Mono', ui-monospace, monospace; font-size: 0.625rem; text-decoration: none;
	}
	.facet-chip span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	a.facet-chip:hover { color: var(--text-primary); }

	.labels-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
		margin-top: 1rem;
	}

	.label-chip {
		padding: 0.1875rem 0.5rem;
		background: var(--bg-elevated);
		border-radius: 6px;
		font-size: 0.6875rem;
		font-weight: 500;
		color: var(--text-secondary);
	}

	:global(.app.light) .label-chip { background: rgba(0, 0, 0, 0.04); }
</style>
