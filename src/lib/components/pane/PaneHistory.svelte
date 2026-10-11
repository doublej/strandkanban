<script lang="ts">
	import { loadIssueHistoryApi, type IssueHistoryEntry } from '$lib/api'
	import { formatTimestamp } from '$lib/utils'
	import Icon from '../Icon.svelte'

	let { issueId }: { issueId: string } = $props()

	let open = $state(false)
	let entries = $state<IssueHistoryEntry[] | null>(null)
	let error = $state('')
	let showAll = $state(false)

	const CAP = 8
	const visible = $derived(entries && !showAll ? entries.slice(0, CAP) : entries)

	async function toggle() {
		open = !open
		if (!open || entries) return
		error = ''
		entries = await loadIssueHistoryApi(issueId).catch((e: Error) => {
			error = e.message
			return null
		})
	}
</script>

<section class="pane-section">
	<button class="pane-section-head toggle" aria-expanded={open} onclick={toggle}>
		<Icon name={open ? 'chevron-down' : 'chevron-right'} size={12} />
		<span class="pane-section-label">History</span>
	</button>
	{#if open}
		{#if error}
			<p class="pane-meta">History unavailable: {error}</p>
		{:else if entries === null}
			<p class="pane-meta">Loading…</p>
		{:else if entries.length === 0}
			<p class="pane-meta">No version history.</p>
		{:else}
			<ol>
				{#each visible ?? [] as e (e.hash)}
					{@const ts = formatTimestamp(e.date)}
					<li>
						<span class="what">{e.changes.join(', ')}</span>
						<span class="pane-meta" title="{ts.absolute} {ts.time}">{ts.relative} · {e.committer}</span>
					</li>
				{/each}
			</ol>
			{#if !showAll && entries.length > CAP}
				<button class="pane-link more" onclick={() => (showAll = true)}>Show all {entries.length}</button>
			{/if}
		{/if}
	{/if}
</section>

<style>
	p { margin: 0; }

	.toggle {
		padding: 0;
		border: none;
		background: none;
		color: var(--text-secondary);
		font: inherit;
		cursor: pointer;
	}

	.toggle:hover .pane-section-label { color: var(--text-primary); }

	ol {
		margin: 0;
		padding: 0 0 0 0.75rem;
		list-style: none;
		border-left: 2px solid var(--border-default);
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.more { align-self: flex-start; margin-left: -0.375rem; }

	li { display: flex; flex-direction: column; }
	.what { font-size: 0.8125rem; }
</style>
