<script lang="ts">
	import type { Issue } from '$lib/types'
	import type { Relation } from '$lib/card-logic'
	import { getTypeIcon, getDueInfo, isStale, formatTimestamp } from '$lib/utils'
	import { typeLabel, dueChipLabel } from '$lib/pane-logic'
	import Icon from './Icon.svelte'

	interface Props {
		issue: Issue
		relation: Relation | null
		due: ReturnType<typeof getDueInfo>
		allPriorities?: boolean
	}

	let { issue, relation, due, allPriorities = false }: Props = $props()

	const stale = $derived(isStale(issue))
	// Dates live in the #seq tooltip: they rarely decide what to pick up next.
	const idTitle = $derived.by(() => {
		const lines = [issue.id]
		if (issue.created_at) lines.push(`Created ${formatTimestamp(issue.created_at).absolute}`)
		if (issue.updated_at) lines.push(`Updated ${formatTimestamp(issue.updated_at).relative}`)
		if (issue.ephemeral) lines.push(`Wisp${issue.wisp_type ? ` · ${issue.wisp_type}` : ''}`)
		return lines.join('\n')
	})
</script>

<!-- Identity left (type, #seq, P0/P1); exceptions right. Nothing here for the normal case. -->
<div class="top">
	<span class="type" title={typeLabel(issue.issue_type)}>
		<Icon name={getTypeIcon(issue.issue_type)} size={13} />
	</span>
	<span class="seq" title={idTitle}>#{issue.seq}</span>
	{#if issue.priority <= 1 || allPriorities}
		<span class="prio p{issue.priority}" title="Priority P{issue.priority}">P{issue.priority}</span>
	{/if}
	{#if issue.pinned}
		<span class="pin" title="Pinned"><Icon name="pin" size={12} /></span>
	{/if}
	<span class="flags">
		{#if relation}
			<span class="flag {relation.tone}" title={relation.title}>
				<Icon name={relation.icon} size={12} /><span class="text">{relation.text}</span>
			</span>
		{/if}
		{#if due}
			<span class="flag due-{due.level}" title="Due {due.absolute}">
				<Icon name="calendar" size={12} />{dueChipLabel(due.label)}
			</span>
		{/if}
		{#if stale}
			<span class="flag stale" title="No updates in 30+ days">Stale</span>
		{/if}
	</span>
</div>

<style>
	.top {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		height: 1rem;
		font-size: 0.6875rem;
		line-height: 1;
		color: var(--text-secondary);
	}

	.type,
	.pin {
		display: inline-flex;
		flex: none;
	}

	.pin { color: var(--text-tertiary); }

	.seq {
		flex: none;
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
	}

	/* Priority is a neutral-to-red ramp, as in the pane: only P0/P1 are shown at all. */
	.prio { flex: none; font-weight: 600; }
	.p0 { color: var(--tone-danger); }
	.p1 { color: var(--tone-orange); }

	.flags {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		min-width: 0;
		margin-left: auto;
	}

	.flag {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		white-space: nowrap;
	}

	/* Only the relation can be long (external ids); it gives way first. */
	.flag:has(.text) { min-width: 0; }
	.text { overflow: hidden; text-overflow: ellipsis; }

	.danger,
	.due-overdue { color: var(--tone-danger); font-weight: 600; }
	.due-soon { color: var(--tone-warn); font-weight: 600; }
	.stale { color: var(--text-tertiary); }
</style>
