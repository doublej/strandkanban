<script lang="ts">
	import type { Issue } from '$lib/types'
	import { formatTimestamp, isStale } from '$lib/utils'

	let { issue }: { issue: Issue } = $props()

	const created = $derived(formatTimestamp(issue.created_at))
	const updated = $derived(formatTimestamp(issue.updated_at))
	// formatTimestamp capitalises for standalone use ("Just now"); mid-sentence reads lower-case.
	const lower = (s: string) => (s === 'Just now' || s === 'Yesterday' ? s.toLowerCase() : s)
</script>

<p class="pane-meta meta">
	{#if created.relative}<span title="{created.absolute} {created.time}">Created {lower(created.relative)}</span>{/if}
	{#if updated.relative}<span title="{updated.absolute} {updated.time}">Updated {lower(updated.relative)}</span>{/if}
	{#if isStale(issue)}<span class="flag">Stale</span>{/if}
</p>

<style>
	.meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem 0.75rem;
		margin: -0.5rem 0 0;
	}

	.flag { color: var(--pane-warn); }
</style>
