<script lang="ts">
	import type { Issue } from '$lib/types'
	import type { PageOps } from '$lib/stores/page-ops.svelte'
	import { getColumnsWithCustom, getIssueColumn, getPriorityConfig, getTypeIcon, getDueInfo, isAgentAssignee, pluralize } from '$lib/utils'
	import { TYPE_OPTS } from '$lib/stores/table-edit.svelte'
	import { typeLabel, openBlockerCount, dueChipLabel } from '$lib/pane-logic'
	import Icon from '../Icon.svelte'

	interface Props {
		ops: PageOps
		issue: Issue
		issues: Issue[]
		activeAgents: string[]
	}

	let { ops, issue, issues, activeAgents }: Props = $props()

	const statusColumns = $derived(getColumnsWithCustom(issues))
	const column = $derived(getIssueColumn(issue))
	const types = $derived(TYPE_OPTS.includes(issue.issue_type) ? TYPE_OPTS : [...TYPE_OPTS, issue.issue_type])
	const due = $derived(getDueInfo(issue.due_at))
	const blockedBy = $derived(openBlockerCount(issue))
	const links = $derived((issue.dependencies ?? []).length + (issue.dependents ?? []).length)
	const agent = $derived(isAgentAssignee(issue.assignee))
	const chatPane = $derived(activeAgents.includes(`${issue.id}-agent`) ? `${issue.id}-agent` : null)

	const val = (e: Event) => (e.currentTarget as HTMLSelectElement).value

	function showRelations() {
		document.getElementById('pane-relations')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
	}
</script>

<!-- Status, priority and type: one click to change, each saves on its own. -->
<div class="chips">
	<label class="chip status" style:--c={column.accent} title="Status">
		<span class="dot"></span>
		<select aria-label="Status" value={issue.status} onchange={(e) => ops.saveFields({ status: val(e) })}>
			{#each statusColumns as col (col.key)}<option value={col.status}>{col.label}</option>{/each}
		</select>
	</label>
	<label class="chip prio-{issue.priority}" title="Priority">
		<select aria-label="Priority" value={String(issue.priority)} onchange={(e) => ops.saveFields({ priority: Number(val(e)) as Issue['priority'] })}>
			{#each [0, 1, 2, 3, 4] as p}<option value={String(p)}>P{p} · {getPriorityConfig(p).label}</option>{/each}
		</select>
	</label>
	<label class="chip" title="Type">
		<Icon name={getTypeIcon(issue.issue_type)} size={12} />
		<select aria-label="Type" value={issue.issue_type} onchange={(e) => ops.saveFields({ issue_type: val(e) })}>
			{#each types as t}<option value={t}>{typeLabel(t)}</option>{/each}
		</select>
	</label>
</div>

<!-- Exceptions only: nothing renders for an unblocked, undated, human-owned issue. -->
{#if links > 0 || due || agent}
	<div class="flags">
		{#if blockedBy > 0}
			<button class="flag danger" onclick={showRelations}><Icon name="alert-circle" size={12} /> Blocked by {blockedBy}</button>
		{:else if links > 0}
			<button class="flag" onclick={showRelations}><Icon name="link" size={12} /> {pluralize(links, 'link')}</button>
		{/if}
		{#if due}
			<span class="flag due-{due.level}" title="Due {due.absolute}"><Icon name="calendar" size={12} /> {dueChipLabel(due.label)}</span>
		{/if}
		{#if agent}
			<span class="flag agent" title="Assigned to an agent">
				<Icon name="agent" size={12} /> {issue.assignee}
				{#if chatPane}<span class="pulse" title="Agent running"></span>{/if}
			</span>
			{#if chatPane}
				<button class="flag agent" onclick={() => ops.openAgentPane(chatPane)}><Icon name="message" size={12} /> Chat</button>
			{/if}
		{/if}
	</div>
{/if}

<style>
	.chips,
	.flags {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.375rem;
	}

	.chips { margin-top: 0.5rem; }
	.flags { margin-top: 0.4375rem; }

	/* A native select drawn as a chip: keyboard and screen readers work unchanged. */
	.chip {
		position: relative;
		display: inline-flex;
		align-items: center;
		border-radius: var(--radius-sm);
		background: var(--cta-muted);
		color: var(--text-primary);
		font-size: 0.75rem;
		font-weight: 500;
	}

	.chip:hover { background: var(--cta-muted-hover); }
	.chip:focus-within { outline: 2px solid var(--accent-primary); outline-offset: 1px; }

	.chip > :global(svg),
	.dot {
		position: absolute;
		left: 0.5rem;
		pointer-events: none;
	}

	.chip > :global(svg) { color: var(--text-secondary); }

	.chip select {
		height: 1.75rem;
		padding: 0 1.375rem 0 0.625rem;
		border: none;
		background: var(--pane-chevron) no-repeat right 0.4375rem center;
		color: inherit;
		font: inherit;
		appearance: none;
		field-sizing: content;
		cursor: pointer;
		outline: none;
	}

	.chip:has(> :global(svg)) select,
	.status select { padding-left: 1.5rem; }

	.chip option { background: var(--surface-elevated); color: var(--text-primary); }

	.status { background: color-mix(in srgb, var(--c) 16%, transparent); }
	.status:hover { background: color-mix(in srgb, var(--c) 24%, transparent); }

	.dot {
		width: 0.5rem;
		height: 0.5rem;
		border-radius: var(--radius-full);
		background: var(--c);
	}

	/* Priority is a neutral-to-red ramp: only P0/P1 draw attention. */
	.prio-0 { background: rgba(239, 68, 68, 0.16); color: var(--tone-danger); font-weight: 600; }
	.prio-1 { background: rgba(249, 115, 22, 0.16); color: var(--tone-orange); font-weight: 600; }

	.flag {
		display: inline-flex;
		align-items: center;
		gap: 0.3125rem;
		height: 1.5rem;
		padding: 0 0.5rem;
		border: 1px solid var(--border-default);
		border-radius: var(--radius-sm);
		background: none;
		color: var(--text-secondary);
		font: inherit;
		font-size: 0.75rem;
		white-space: nowrap;
	}

	button.flag { cursor: pointer; }
	button.flag:hover { color: var(--text-primary); border-color: var(--border-strong); }
	button.flag:focus-visible { outline: 2px solid var(--accent-primary); outline-offset: 1px; }

	.danger,
	.due-overdue {
		border-color: rgba(239, 68, 68, 0.4);
		background: rgba(239, 68, 68, 0.1);
		color: var(--tone-danger);
		font-weight: 600;
	}

	button.danger:hover { color: var(--tone-danger); border-color: var(--tone-danger); }

	.due-soon { border-color: rgba(217, 119, 6, 0.4); color: var(--tone-warn); }

	.agent { border-color: rgba(20, 184, 166, 0.4); color: var(--tone-agent); }
	button.agent:hover { color: var(--tone-agent); border-color: var(--tone-agent); }

	.pulse {
		width: 0.375rem;
		height: 0.375rem;
		border-radius: var(--radius-full);
		background: var(--tone-agent);
		animation: pulse 1.6s ease-in-out infinite;
	}

	@keyframes pulse { 50% { opacity: 0.3; } }
</style>
