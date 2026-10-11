<script lang="ts">
	import type { Issue, AgentModel, AgentEffort } from '$lib/types'
	import type { PageOps } from '$lib/stores/page-ops.svelte'
	import { formatMinutes } from '$lib/utils'
	import { toDateInput, parseEstimate } from '$lib/pane-logic'
	import Icon from '../Icon.svelte'
	import PaneLabels from './PaneLabels.svelte'
	import PaneMeta from './PaneMeta.svelte'

	interface Props {
		ops: PageOps
		issue: Issue
		activeAgents: string[]
	}

	let { ops, issue, activeAgents }: Props = $props()

	const MODELS: { value: AgentModel; label: string }[] = [
		{ value: '', label: 'Default model' }, { value: 'haiku', label: 'Haiku · fast' },
		{ value: 'sonnet', label: 'Sonnet · balanced' }, { value: 'opus', label: 'Opus · most capable' }
	]
	const EFFORTS: { value: AgentEffort; label: string }[] = [
		{ value: '', label: 'Default effort' }, { value: 'low', label: 'Low effort' },
		{ value: 'medium', label: 'Medium effort' }, { value: 'high', label: 'High effort' }
	]

	const save = (updates: Partial<Issue>) => ops.saveFields(updates)
	const val = (e: Event) => (e.currentTarget as HTMLInputElement | HTMLSelectElement).value

	/** Text inputs save on change (blur or Enter) and only when the value really changed. */
	function saveText(field: 'assignee' | 'spec_id' | 'external_ref', e: Event) {
		const next = val(e).trim()
		if (next !== (issue[field] ?? '')) save({ [field]: next })
	}

	function blurOnEnter(e: KeyboardEvent) {
		if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur()
	}
</script>

<dl class="props">
	<dt>
		<label for="p-assignee">Assignee</label>
		{#if activeAgents.length > 0}<span class="sub">{activeAgents.length} agents</span>{/if}
	</dt>
	<dd>
		<input
			id="p-assignee"
			class="pane-input"
			list="p-agents"
			placeholder="Unassigned"
			value={issue.assignee ?? ''}
			onchange={(e) => saveText('assignee', e)}
			onkeydown={blurOnEnter}
		/>
		<datalist id="p-agents">{#each activeAgents as a}<option value={a}></option>{/each}</datalist>
	</dd>

	<dt><label for="p-model">Agent</label></dt>
	<dd class="pair">
		<select id="p-model" class="pane-select" aria-label="Agent model" value={issue.agent_model ?? ''} onchange={(e) => save({ agent_model: val(e) as AgentModel })}>
			{#each MODELS as m}<option value={m.value}>{m.label}</option>{/each}
		</select>
		<select class="pane-select" aria-label="Agent effort" value={issue.agent_effort ?? ''} onchange={(e) => save({ agent_effort: val(e) as AgentEffort })}>
			{#each EFFORTS as m}<option value={m.value}>{m.label}</option>{/each}
		</select>
	</dd>

	<dt><label for="p-due">Due</label></dt>
	<dd>
		<input id="p-due" type="date" class="pane-input" value={toDateInput(issue.due_at)} onchange={(e) => save({ due_at: val(e) })} />
	</dd>

	<dt><label for="p-defer">Defer until</label></dt>
	<dd>
		<input id="p-defer" type="date" class="pane-input" value={toDateInput(issue.defer_until)} onchange={(e) => save({ defer_until: val(e) })} />
	</dd>

	<dt><label for="p-estimate">Estimate</label></dt>
	<dd>
		<input
			id="p-estimate"
			type="number"
			min="0"
			step="15"
			class="pane-input"
			placeholder="Minutes"
			value={issue.estimated_minutes || ''}
			onchange={(e) => save({ estimated_minutes: parseEstimate(val(e)) })}
			onkeydown={blurOnEnter}
		/>
		{#if issue.estimated_minutes}<span class="hint">{formatMinutes(issue.estimated_minutes)}</span>{/if}
	</dd>

	<PaneLabels {ops} {issue} />

	<dt><label for="p-spec">Spec</label></dt>
	<dd>
		<input id="p-spec" class="pane-input mono" placeholder="None" value={issue.spec_id ?? ''} onchange={(e) => saveText('spec_id', e)} onkeydown={blurOnEnter} />
	</dd>

	<dt><label for="p-ext">External ref</label></dt>
	<dd>
		<input id="p-ext" class="pane-input mono" placeholder="None" value={issue.external_ref ?? ''} onchange={(e) => saveText('external_ref', e)} onkeydown={blurOnEnter} />
		{#if issue.external_ref && /^https?:\/\//.test(issue.external_ref)}
			<a class="pane-icon-btn" href={issue.external_ref} target="_blank" rel="noopener noreferrer" aria-label="Open external reference">
				<Icon name="external-link" size={14} />
			</a>
		{/if}
	</dd>
</dl>

<PaneMeta {issue} />

<style>
	.props {
		display: grid;
		grid-template-columns: 6.5rem minmax(0, 1fr);
		align-items: center;
		gap: 0.125rem 0.75rem;
		margin: 0;
	}

	.props :global(dt) {
		display: flex;
		flex-direction: column;
		font-size: 0.8125rem;
		color: var(--text-secondary);
	}

	.props :global(dt .sub) { font-size: 0.6875rem; color: var(--text-secondary); }

	.props :global(dd) {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		min-width: 0;
		min-height: 2rem;
		margin: 0;
	}

	.pair .pane-select { flex: 1; }

	.hint {
		flex: none;
		font-size: 0.75rem;
		color: var(--text-secondary);
		white-space: nowrap;
	}

	input[type='date'] { color-scheme: dark; }
	:global(.app.light) input[type='date'] { color-scheme: light; }
</style>
