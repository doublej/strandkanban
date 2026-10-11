<script lang="ts">
	import type { Issue } from '$lib/types'
	import type { PageOps } from '$lib/stores/page-ops.svelte'
	import { getPriorityConfig, getIssueColumn } from '$lib/utils'
	import { settings } from '$lib/stores/settings.svelte'
	import Icon from '../Icon.svelte'
	import IssueSearch from '../IssueSearch.svelte'

	interface Props {
		ops: PageOps
		issues: Issue[]
	}

	let { ops, issues }: Props = $props()

	const TYPES = ['task', 'bug', 'feature', 'epic', 'chore']
	const form = $derived(ops.createForm)
	const canCreate = $derived(form.title.trim().length > 0)
	const blockers = $derived(form.deps.map((id) => issues.find((i) => i.id === id)).filter((i): i is Issue => !!i))

	function addBlocker(issue: Issue) {
		if (!form.deps.includes(issue.id)) form.deps = [...form.deps, issue.id]
	}

	function removeBlocker(id: string) {
		form.deps = form.deps.filter((d) => d !== id)
	}
</script>

<header class="panel-header">
	<h2>New issue</h2>
	<button class="pane-icon-btn" aria-label="Close panel" title="Cancel (Esc)" onclick={() => ops.closePanel()}>
		<Icon name="close" size={16} />
	</button>
</header>

<!-- Not a <form>: Enter in the title or blocker search must not create; ⌘↵ does (global shortcut). -->
<div class="pane-body">
	<input id="create-title" class="title" placeholder="What needs to be done?" aria-label="Title" bind:value={form.title} />
	<textarea class="pane-textarea" placeholder="Add details… (Markdown)" aria-label="Description" bind:value={form.description}></textarea>

	<div class="row">
		<label>
			<span class="pane-section-label">Priority</span>
			<select class="pane-select boxed" bind:value={form.priority}>
				{#each [0, 1, 2, 3, 4] as p}<option value={p}>P{p} · {getPriorityConfig(p).label}</option>{/each}
			</select>
		</label>
		<label>
			<span class="pane-section-label">Type</span>
			<select class="pane-select boxed" bind:value={form.issue_type}>
				{#each TYPES as t}<option value={t}>{t}</option>{/each}
			</select>
		</label>
	</div>

	<div class="pane-section">
		<span class="pane-section-label">Blocked by</span>
		{#if blockers.length > 0}
			<div class="chips">
				{#each blockers as b (b.id)}
					<span class="pane-chip" title={b.id}>
						<span class="dot" style:background={getIssueColumn(b).accent}></span>
						#{b.seq} {b.title}
						<button aria-label="Remove blocker {b.id}" onclick={() => removeBlocker(b.id)}><Icon name="close" size={11} /></button>
					</span>
				{/each}
			</div>
		{/if}
		<IssueSearch {issues} excludeIds={form.deps} placeholder="Link a blocker…" onselect={addBlocker} />
	</div>
</div>

<footer class="pane-footer">
	<button class="btn btn-ghost" onclick={() => ops.closePanel()}>Cancel</button>
	<span class="spacer"></span>
	{#if settings.agentEnabled}
		<button class="btn btn-secondary" disabled={!canCreate} onclick={ops.createIssueAndStartAgent}>
			<Icon name="agent" size={14} /> Create + agent
		</button>
	{/if}
	<button class="btn btn-primary" disabled={!canCreate} onclick={ops.createIssue}>Create <kbd>⌘↵</kbd></button>
</footer>

<style>
	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 1.25rem;
		border-bottom: 1px solid var(--border-subtle);
	}

	h2 { margin: 0; font-size: 0.9375rem; font-weight: 600; }

	.pane-body { padding-top: 1rem; }

	.title {
		padding: 0.25rem 0;
		border: none;
		background: none;
		color: var(--text-primary);
		font: inherit;
		font-size: 1.125rem;
		font-weight: 600;
		outline: none;
	}

	.title::placeholder { color: var(--text-tertiary); }

	.row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
	}

	label { display: flex; flex-direction: column; gap: 0.25rem; }

	.chips { display: flex; flex-wrap: wrap; gap: 0.25rem; }

	.dot {
		flex: none;
		width: 0.4375rem;
		height: 0.4375rem;
		border-radius: var(--radius-full);
	}

	kbd {
		font-family: var(--font-sans);
		font-size: 0.6875rem;
		opacity: 0.75;
	}
</style>
