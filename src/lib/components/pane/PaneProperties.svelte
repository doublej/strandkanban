<script lang="ts">
	import type { Issue, AgentModel, AgentEffort } from '$lib/types'
	import type { PageOps } from '$lib/stores/page-ops.svelte'
	import { tick } from 'svelte'
	import { formatMinutes, parseStateLabels, pluralize } from '$lib/utils'
	import { toDateInput, parseEstimate } from '$lib/pane-logic'
	import { toastQueue } from '$lib/notifications/toast-queue.svelte'
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

	/** Rows render only when set (or just picked from "+ Add property"), so the grid carries no "None" noise. */
	type Prop = { key: string; label: string; set: boolean }
	const parsed = $derived(parseStateLabels(issue.labels))
	const rows = $derived<Prop[]>([
		{ key: 'assignee', label: 'Assignee', set: !!issue.assignee },
		{ key: 'model', label: 'Agent model', set: !!(issue.agent_model || issue.agent_effort) },
		{ key: 'due', label: 'Due date', set: !!issue.due_at },
		{ key: 'defer', label: 'Defer until', set: !!issue.defer_until },
		{ key: 'estimate', label: 'Estimate', set: !!issue.estimated_minutes },
		{ key: 'label', label: 'Labels', set: parsed.plain.length > 0 },
		{ key: 'state', label: 'State', set: parsed.states.length > 0 },
		{ key: 'spec', label: 'Spec', set: !!issue.spec_id },
		{ key: 'ext', label: 'External ref', set: !!issue.external_ref }
	])
	let revealed = $state<string[]>([])
	const shown = $derived(new Set(rows.filter((p) => p.set || revealed.includes(p.key)).map((p) => p.key)))
	const hidden = $derived(rows.filter((p) => !shown.has(p.key)))

	async function reveal(e: Event) {
		const select = e.currentTarget as HTMLSelectElement
		const key = select.value
		select.value = ''
		revealed.push(key)
		await tick()
		document.getElementById(`p-${key}`)?.focus()
	}

	const save = (updates: Partial<Issue>) => ops.saveFields(updates)
	const val = (e: Event) => (e.currentTarget as HTMLInputElement | HTMLSelectElement).value

	/** Text inputs save on change (blur or Enter) and only when the value really changed. */
	function saveText(field: 'assignee' | 'spec_id' | 'external_ref', e: Event) {
		const next = val(e).trim()
		if (next !== (issue[field] ?? '')) save({ [field]: next })
	}

	/** Shown humanised ("2h 30m"); typed as that or plain minutes. Empty clears, junk reverts. */
	function saveEstimate(e: Event) {
		const input = e.currentTarget as HTMLInputElement
		const minutes = parseEstimate(input.value)
		if (minutes === null) {
			toastQueue.show({ type: 'warning', title: 'Estimate not saved', message: `Couldn't read "${input.value}". Try 2h 30m or 90.`, duration: 4000 })
		} else if (minutes !== (issue.estimated_minutes ?? 0)) {
			save({ estimated_minutes: minutes })
		}
		input.value = formatMinutes(minutes ?? issue.estimated_minutes)
	}

	function blurOnEnter(e: KeyboardEvent) {
		if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur()
	}
</script>

<div class="props-wrap">
<dl class="props">
	{#if shown.has('assignee')}
		<dt>
			<label for="p-assignee">Assignee</label>
			{#if activeAgents.length > 0}<span class="sub">{pluralize(activeAgents.length, 'agent')}</span>{/if}
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
	{/if}

	{#if shown.has('model')}
		<dt><label for="p-model">Agent</label></dt>
		<dd class="pair">
			<select id="p-model" class="pane-select" aria-label="Agent model" value={issue.agent_model ?? ''} onchange={(e) => save({ agent_model: val(e) as AgentModel })}>
				{#each MODELS as m}<option value={m.value}>{m.label}</option>{/each}
			</select>
			<select class="pane-select" aria-label="Agent effort" value={issue.agent_effort ?? ''} onchange={(e) => save({ agent_effort: val(e) as AgentEffort })}>
				{#each EFFORTS as m}<option value={m.value}>{m.label}</option>{/each}
			</select>
		</dd>
	{/if}

	{#if shown.has('due')}
		<dt><label for="p-due">Due</label></dt>
		<dd>
			<input id="p-due" type="date" class="pane-input" value={toDateInput(issue.due_at)} onchange={(e) => save({ due_at: val(e) })} />
		</dd>
	{/if}

	{#if shown.has('defer')}
		<dt><label for="p-defer">Defer until</label></dt>
		<dd>
			<input id="p-defer" type="date" class="pane-input" value={toDateInput(issue.defer_until)} onchange={(e) => save({ defer_until: val(e) })} />
		</dd>
	{/if}

	{#if shown.has('estimate')}
		<dt><label for="p-estimate">Estimate</label></dt>
		<dd>
			<input
				id="p-estimate"
				class="pane-input"
				placeholder="e.g. 2h 30m"
				value={formatMinutes(issue.estimated_minutes)}
				onchange={saveEstimate}
				onkeydown={blurOnEnter}
			/>
		</dd>
	{/if}

	<PaneLabels {ops} {issue} showLabels={shown.has('label')} showState={shown.has('state')} />

	{#if shown.has('spec')}
		<dt><label for="p-spec">Spec</label></dt>
		<dd>
			<input id="p-spec" class="pane-input mono" placeholder="Spec ID" value={issue.spec_id ?? ''} onchange={(e) => saveText('spec_id', e)} onkeydown={blurOnEnter} />
		</dd>
	{/if}

	{#if shown.has('ext')}
		<dt><label for="p-ext">External ref</label></dt>
		<dd>
			<input id="p-ext" class="pane-input mono" placeholder="URL or ticket key" value={issue.external_ref ?? ''} onchange={(e) => saveText('external_ref', e)} onkeydown={blurOnEnter} />
			{#if issue.external_ref && /^https?:\/\//.test(issue.external_ref)}
				<a class="pane-icon-btn" href={issue.external_ref} target="_blank" rel="noopener noreferrer" aria-label="Open external reference">
					<Icon name="external-link" size={14} />
				</a>
			{/if}
		</dd>
	{/if}
</dl>
{#if hidden.length > 0}
	<select class="add-prop" aria-label="Add property" onchange={reveal}>
		<option value="">+ Add property</option>
		{#each hidden as p (p.key)}<option value={p.key}>{p.label}</option>{/each}
	</select>
{/if}
</div>

<PaneMeta {issue} />

<style>
	.props-wrap { display: flex; flex-direction: column; gap: 0.25rem; }

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

	.add-prop {
		align-self: flex-start;
		padding: 0.25rem 0.375rem;
		margin-left: -0.375rem;
		border: none;
		border-radius: var(--radius-xs);
		background: none;
		color: var(--text-secondary);
		font: inherit;
		font-size: 0.75rem;
		appearance: none;
		field-sizing: content;
		cursor: pointer;
	}

	.add-prop:hover { background: var(--cta-muted); color: var(--text-primary); }
	.add-prop:focus-visible { outline: 2px solid var(--accent-primary); outline-offset: 1px; }
	.add-prop option { background: var(--surface-elevated); color: var(--text-primary); }

	input[type='date'] { color-scheme: dark; }
	:global(.app.light) input[type='date'] { color-scheme: light; }
</style>
