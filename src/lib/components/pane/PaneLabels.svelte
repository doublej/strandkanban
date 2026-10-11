<script lang="ts">
	import type { Issue } from '$lib/types'
	import type { PageOps } from '$lib/stores/page-ops.svelte'
	import { parseStateLabels } from '$lib/utils'
	import { normalizeLabel, STATE_PART } from '$lib/pane-logic'
	import Icon from '../Icon.svelte'

	interface Props {
		ops: PageOps
		issue: Issue
		showLabels: boolean
		showState: boolean
	}

	let { ops, issue, showLabels, showState }: Props = $props()

	let labelInput = $state('')
	let stateFormOpen = $state(false)
	let dimension = $state('')
	let stateValue = $state('')

	const parsed = $derived(parseStateLabels(issue.labels))
	// With no state yet, the row exists only because the user asked for it: open the form straight away.
	const formShown = $derived(stateFormOpen || parsed.states.length === 0)
	const canSetState = $derived(STATE_PART.test(dimension.trim()) && STATE_PART.test(stateValue.trim()))

	function addLabel() {
		const label = normalizeLabel(labelInput)
		labelInput = ''
		const current = issue.labels ?? []
		if (label && !current.includes(label)) ops.setLabels([...current, label])
	}

	function removeLabel(label: string) {
		ops.setLabels((issue.labels ?? []).filter((l) => l !== label))
	}

	function setState() {
		if (!canSetState) return
		ops.setIssueState(dimension.trim(), stateValue.trim())
		dimension = ''
		stateValue = ''
		stateFormOpen = false
	}

	function onStateKey(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault()
			setState()
		}
	}
</script>

{#if showLabels}
	<dt><label for="p-label">Labels</label></dt>
	<dd class="wrap">
		{#each parsed.plain as label (label)}
			<span class="pane-chip">
				{label}
				<button aria-label="Remove label {label}" onclick={() => removeLabel(label)}><Icon name="close" size={11} /></button>
			</span>
		{/each}
		<form class="add" onsubmit={(e) => { e.preventDefault(); addLabel() }}>
			<input id="p-label" class="pane-input" placeholder="Add label…" bind:value={labelInput} />
			<button type="submit" class="pane-icon-btn" aria-label="Add label" disabled={!labelInput.trim()}><Icon name="plus" size={14} /></button>
		</form>
	</dd>
{/if}

{#if showState}
	<dt><label for="p-state">State</label></dt>
	<dd class="wrap">
		{#each parsed.states as s (s.dimension)}
			<span class="state"><span class="dim">{s.dimension}</span>{s.value}</span>
		{/each}
		{#if formShown}
			<span class="state-form">
				<input id="p-state" class="pane-input mono" placeholder="dimension" aria-label="State dimension" bind:value={dimension} onkeydown={onStateKey} />
				<input class="pane-input mono" placeholder="value" aria-label="State value" bind:value={stateValue} onkeydown={onStateKey} />
				<button class="pane-link" disabled={!canSetState} onclick={setState}>Set</button>
				{#if parsed.states.length > 0}
					<button class="pane-icon-btn" aria-label="Cancel" onclick={() => (stateFormOpen = false)}><Icon name="close" size={12} /></button>
				{/if}
			</span>
		{:else}
			<button class="pane-link" onclick={() => (stateFormOpen = true)}><Icon name="plus" size={12} /> state</button>
		{/if}
	</dd>
{/if}

<style>
	.wrap { flex-wrap: wrap; padding: 0.25rem 0; }

	.add {
		display: flex;
		align-items: center;
		flex: 1;
		min-width: 7rem;
	}

	.add .pane-icon-btn:disabled { opacity: 0.35; cursor: default; }

	.state {
		display: inline-flex;
		overflow: hidden;
		border: 1px solid rgba(45, 212, 191, 0.35);
		border-radius: var(--radius-xs);
		font-family: var(--font-mono);
		font-size: 0.75rem;
		line-height: 1.5;
	}

	.state > * { padding: 0 0.375rem; }
	.state { padding-right: 0.375rem; color: var(--text-primary); }

	.dim {
		margin-right: 0.375rem;
		background: rgba(45, 212, 191, 0.14);
		color: var(--text-secondary);
	}

	.state-form {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		width: 100%;
	}
</style>
