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
		<ul>
			{#each rows as row (row.from + row.to)}
				{@const col = getIssueColumn({ ...issue, status: row.dep.status })}
				{@const kind = getDepTypeConfig(row.dep.dependency_type)}
				<li>
					<span class="kind" style:color={kind.color}><Icon name={kind.icon} size={13} /></span>
					<span class="verb">{row.verb}</span>
					<span class="dot" style:background={col.accent} title={col.label}></span>
					<span class="seq" title={row.dep.id}>{seqOf(row.dep.id)}</span>
					<span class="title" class:done={row.dep.status === 'closed'}>{row.dep.title}</span>
					<button class="pane-icon-btn rm" aria-label="Remove link to {row.dep.id}" title="Remove link" onclick={() => remove(row)}>
						<Icon name="unlink" size={13} />
					</button>
				</li>
			{/each}
		</ul>
	</section>
{/if}

<style>
	h3 { margin: 0; }

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
		padding: 0 0.25rem;
		border-radius: var(--radius-sm);
		font-size: 0.8125rem;
	}

	li:hover { background: var(--cta-muted); }

	.kind { display: inline-flex; flex: none; }

	.verb {
		flex: none;
		width: 5.5rem;
		color: var(--text-secondary);
		font-size: 0.75rem;
	}

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
</style>
