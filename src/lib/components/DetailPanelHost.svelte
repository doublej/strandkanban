<script lang="ts">
	import type { Issue } from '$lib/types'
	import type { PageOps } from '$lib/stores/page-ops.svelte'
	import type { CardDrag } from '$lib/drag-drop/card-drag.svelte'
	import PaneIssue from './pane/PaneIssue.svelte'
	import PaneCreate from './pane/PaneCreate.svelte'
	import './pane/pane.css'

	interface Props {
		ops: PageOps
		cardDrag: CardDrag
		issues: Issue[]
		activeAgents: string[]
	}

	let { ops, cardDrag, issues, activeAgents }: Props = $props()

	const dragOffset = $derived(cardDrag.isPanelDragging ? cardDrag.panelDragOffset : 0)

	/** A pasted image anywhere in the open pane becomes an attachment. */
	function handlePaste(e: ClipboardEvent) {
		if (!ops.editingIssue) return
		const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith('image/'))
		const file = item?.getAsFile()
		if (!file) return
		e.preventDefault()
		ops.handleUploadAttachment(file)
	}
</script>

<!-- Swipe-down-to-close listens on the whole pane; card-drag only starts it from .panel-header. -->
<aside
	class="panel"
	class:dragging={cardDrag.isPanelDragging}
	aria-label={ops.isCreating ? 'New issue' : 'Issue details'}
	style:transform={dragOffset ? `translateY(${dragOffset}px)` : undefined}
	style:opacity={dragOffset ? Math.max(0.3, 1 - dragOffset / 300) : undefined}
	ontouchstart={cardDrag.handlePanelTouchStart}
	ontouchmove={cardDrag.handlePanelTouchMove}
	ontouchend={cardDrag.handlePanelTouchEnd}
	onpaste={handlePaste}
>
	{#if ops.isCreating}
		<PaneCreate {ops} {issues} />
	{:else if ops.editingIssue}
		<!-- Keyed: per-issue UI state (menus, inputs, open sections) never leaks to the next issue. -->
		{#key ops.editingIssue.id}
			<PaneIssue {ops} {issues} {activeAgents} />
		{/key}
	{/if}
</aside>
