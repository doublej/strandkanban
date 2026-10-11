<script lang="ts">
	import type { Issue, AgentModel, AgentEffort } from '$lib/types'
	import type { PageOps } from '$lib/stores/page-ops.svelte'
	import { getColumnsWithCustom, getIssueColumn, getPriorityConfig, getDueInfo, formatMinutes, isAgentAssignee } from '$lib/utils'
	import { toDateInput, parseEstimate } from '$lib/pane-logic'
	import Icon from '../Icon.svelte'
	import PaneLabels from './PaneLabels.svelte'
	import PaneMeta from './PaneMeta.svelte'

	interface Props {
		ops: PageOps
		issue: Issue
		issues: Issue[]
		activeAgents: string[]
		onshowrelations: () => void
	}

	let { ops, issue, issues, activeAgents, onshowrelations }: Props = $props()

	const TYPES = ['task', 'bug', 'feature', 'epic', 'chore']
	const MODELS: { value: AgentModel; label: string }[] = [
		{ value: '', label: 'Default model' }, { value: 'haiku', label: 'Haiku · fast' },
		{ value: 'sonnet', label: 'Sonnet · balanced' }, { value: 'opus', label: 'Opus · most capable' }
	]
	const EFFORTS: { value: AgentEffort; label: string }[] = [
		{ value: '', label: 'Default effort' }, { value: 'low', label: 'Low effort' },
		{ value: 'medium', label: 'Medium effort' }, { value: 'high', label: 'High effort' }
	]

	const statusColumns = $derived(getColumnsWithCustom(issues))
	const column = $derived(getIssueColumn(issue))
	const types = $derived(TYPES.includes(issue.issue_type) ? TYPES : [...TYPES, issue.issue_type])
	const due = $derived(getDueInfo(issue.due_at))
	const isAgent = $derived(isAgentAssignee(issue.assignee))
	const chatPane = $derived(activeAgents.includes(`${issue.id}-agent`) ? `${issue.id}-agent` : null)
	const blockedBy = $derived((issue.dependencies ?? []).filter((d) => d.status !== 'closed').length)
	const blocking = $derived((issue.dependents ?? []).length)
	const linkCount = $derived((issue.dependencies ?? []).length + blocking)

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
	<dt><label for="p-status">Status</label></dt>
	<dd>
		<span class="dot" style:background={column.accent}></span>
		<select id="p-status" class="pane-select" value={issue.status} onchange={(e) => save({ status: val(e) })}>
			{#each statusColumns as col (col.key)}<option value={col.status}>{col.label}</option>{/each}
		</select>
	</dd>

	<dt><label for="p-priority">Priority</label></dt>
	<dd>
		<span class="prio prio-{issue.priority}">P{issue.priority}</span>
		<select id="p-priority" class="pane-select" value={String(issue.priority)} onchange={(e) => save({ priority: Number(val(e)) as Issue['priority'] })}>
			{#each [0, 1, 2, 3, 4] as p}<option value={String(p)}>P{p} · {getPriorityConfig(p).label}</option>{/each}
		</select>
	</dd>

	<dt><label for="p-type">Type</label></dt>
	<dd>
		<select id="p-type" class="pane-select" value={issue.issue_type} onchange={(e) => save({ issue_type: val(e) })}>
			{#each types as t}<option value={t}>{t}</option>{/each}
		</select>
	</dd>

	<dt>
		<label for="p-assignee">Assignee</label>
		{#if activeAgents.length > 0}<span class="sub">{activeAgents.length} agents</span>{/if}
	</dt>
	<dd>
		{#if isAgent}<span class="agent-icon" title="Agent"><Icon name="agent" size={14} /></span>{/if}
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
		{#if chatPane}
			<button class="pane-link chat" onclick={() => ops.openAgentPane(chatPane)}>
				<span class="pulse"></span> Chat
			</button>
		{/if}
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
		{#if due}<span class="due due-{due.level}" title={due.absolute}>{due.label}</span>{/if}
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

	{#if linkCount > 0}
		<dt>Links</dt>
		<dd>
			<button class="pane-link" onclick={onshowrelations}>
				{#if blockedBy > 0}<span class="blocked">Blocked by {blockedBy} open</span>{:else}{linkCount - blocking} dependencies{/if}
				· {blocking} dependents
			</button>
		</dd>
	{/if}

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

	.props :global(dt .sub) { font-size: 0.6875rem; color: var(--text-tertiary); }

	.props :global(dd) {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		min-width: 0;
		min-height: 2rem;
		margin: 0;
	}

	.pair .pane-select { flex: 1; }

	.dot {
		flex: none;
		width: 0.5rem;
		height: 0.5rem;
		border-radius: var(--radius-full);
	}

	.prio {
		flex: none;
		min-width: 1.75rem;
		padding: 0.0625rem 0.3125rem;
		border-radius: var(--radius-xs);
		background: var(--cta-muted);
		color: var(--text-secondary);
		font-family: var(--font-mono);
		font-size: 0.6875rem;
		font-weight: 600;
		text-align: center;
	}

	/* Priority is a neutral-to-red ramp: only P0/P1 draw attention. */
	.prio-0 { background: rgba(239, 68, 68, 0.16); color: var(--pane-danger); }
	.prio-1 { background: rgba(249, 115, 22, 0.16); color: #fb923c; }

	.agent-icon { display: inline-flex; color: var(--pane-agent); }

	.chat { color: var(--pane-agent); flex: none; }

	.pulse {
		width: 0.375rem;
		height: 0.375rem;
		border-radius: var(--radius-full);
		background: var(--pane-agent);
		animation: pulse 1.6s ease-in-out infinite;
	}

	@keyframes pulse { 50% { opacity: 0.3; } }

	.hint,
	.due {
		flex: none;
		font-size: 0.75rem;
		color: var(--text-secondary);
		white-space: nowrap;
	}

	.due-overdue { color: var(--pane-danger); font-weight: 600; }
	.due-soon { color: var(--pane-warn); }

	.blocked { color: var(--pane-danger); font-weight: 600; }

	input[type='date'] { color-scheme: dark; }
	:global(.app.light) input[type='date'] { color-scheme: light; }
</style>
