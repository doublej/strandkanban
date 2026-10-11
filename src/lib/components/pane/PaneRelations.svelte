<script lang="ts">
	import type { Issue, Dependency } from '$lib/types'
	import type { PageOps } from '$lib/stores/page-ops.svelte'
	import { getDepTypeConfig, getIssueColumn } from '$lib/utils'
	import Icon from '../Icon.svelte'

	interface Props {
		ops: PageOps
		issue: Issue
		issues: Issue[]
	}

	let { ops, issue, issues }: Props = $props()

	/** One row per link, worded from this issue's side ("blocked by #12", "blocks #14"). */
	type Row = { dep: Dependency; verb: string; from: string; to: string }

	const VERBS: Record<string, [string, string]> = {
		blocks: ['Blocked by', 'Blocks'],
		'parent-child': ['Child of', 'Parent of'],
		'discovered-from': ['Found during', 'Led to']
	}

	function verb(type: string, outgoing: boolean): string {
		const pair = VERBS[type]
		if (pair) return outgoing ? pair[0] : pair[1]
		return getDepTypeConfig(type).label
	}

	const rows = $derived<Row[]>([
		...(issue.dependencies ?? []).map((dep) => ({ dep, verb: verb(dep.dependency_type, true), from: issue.id, to: dep.id })),
		...(issue.dependents ?? []).map((dep) => ({ dep, verb: verb(dep.dependency_type, false), from: dep.id, to: issue.id }))
	])

	/** Grouped by direction so "Blocked by" never reads like "Blocks"; blockers lead. */
	const groups = $derived.by(() => {
		const byVerb = new Map<string, Row[]>()
		for (const row of rows) byVerb.set(row.verb, [...(byVerb.get(row.verb) ?? []), row])
		return [...byVerb].sort(([a], [b]) => Number(b === 'Blocked by') - Number(a === 'Blocked by'))
	})

	function seqOf(id: string): string {
		const seq = issues.find((i) => i.id === id)?.seq
		return seq ? `#${seq}` : id
	}

	function remove(row: Row) {
		if (!confirm(`Remove the link "${row.verb} ${seqOf(row.dep.id)}"?`)) return
		ops.removeDependency(row.from, row.to)
	}
</script>

{#if rows.length > 0}
	<section class="pane-section" id="pane-relations">
		<div class="pane-section-head">
			<h3 class="pane-section-label">Relations</h3>
			<span class="count">{rows.length}</span>
		</div>
		{#each groups as [verb, group] (verb)}
			{@const blockedBy = verb === 'Blocked by'}
			{@const open = blockedBy && group.some((r) => r.dep.status !== 'closed')}
			<div class="group">
				<h4 class:open>
					<Icon name={blockedBy ? 'alert-circle' : getDepTypeConfig(group[0].dep.dependency_type).icon} size={12} />
					{verb} <span class="n">{group.length}</span>
				</h4>
				<ul>
					{#each group as row (row.from + row.to)}
						{@const col = getIssueColumn({ ...issue, status: row.dep.status })}
						<li>
							<span class="dot" style:background={col.accent} title={col.label}></span>
							<span class="seq" title={row.dep.id}>{seqOf(row.dep.id)}</span>
							<span class="title" class:done={row.dep.status === 'closed'}>{row.dep.title}</span>
							<button class="pane-icon-btn rm" aria-label="Remove link: {row.verb} {seqOf(row.dep.id)}" title="Remove link" onclick={() => remove(row)}>
								<Icon name="close" size={13} />
							</button>
						</li>
					{/each}
				</ul>
			</div>
		{/each}
	</section>
{/if}

<style>
	h3 { margin: 0; }

	.group { display: flex; flex-direction: column; gap: 0.125rem; }

	h4 {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		margin: 0;
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--text-secondary);
	}

	h4.open { color: var(--pane-danger); font-weight: 600; }
	.n { font-variant-numeric: tabular-nums; opacity: 0.8; }

	ul {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
	}

	li {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-height: 2rem;
		padding: 0 0.25rem 0 1.125rem;
		border-radius: var(--radius-sm);
		font-size: 0.8125rem;
	}

	li:hover { background: var(--cta-muted); }

	.dot {
		flex: none;
		width: 0.5rem;
		height: 0.5rem;
		border-radius: var(--radius-full);
	}

	.seq {
		flex: none;
		font-family: var(--font-mono);
		font-size: 0.75rem;
		color: var(--text-secondary);
	}

	.title {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.title.done { color: var(--text-secondary); text-decoration: line-through; }

	.rm { flex: none; width: 1.5rem; height: 1.5rem; }
	.rm:hover { color: var(--pane-danger); }
</style>
