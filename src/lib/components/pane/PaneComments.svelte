<script lang="ts">
	import type { PageOps } from '$lib/stores/page-ops.svelte'
	import { formatTimestamp } from '$lib/utils'
	import MarkdownContent from '../MarkdownContent.svelte'
	import Icon from '../Icon.svelte'

	let { ops }: { ops: PageOps } = $props()

	const canSend = $derived(ops.newComment.trim().length > 0)

	function handleKey(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
			e.preventDefault()
			e.stopPropagation()
			if (canSend) ops.addComment()
		}
	}
</script>

<section class="pane-section">
	<div class="pane-section-head">
		<h3 class="pane-section-label">Comments</h3>
		{#if ops.comments.length > 0}<span class="count">{ops.comments.length}</span>{/if}
		{#if ops.loadingComments}<span class="pane-meta">Loading…</span>{/if}
	</div>

	{#each ops.comments as c (c.id)}
		{@const ts = formatTimestamp(c.created_at)}
		<article class="comment">
			<header>
				<span class="author">{c.author}</span>
				<time datetime={c.created_at} title="{ts.absolute} {ts.time}">{ts.relative}</time>
			</header>
			<div class="text"><MarkdownContent content={c.text} /></div>
		</article>
	{/each}

	<form class="composer" onsubmit={(e) => { e.preventDefault(); if (canSend) ops.addComment() }}>
		<textarea
			class="pane-textarea"
			rows="2"
			placeholder="Add a comment…"
			aria-label="Add a comment"
			bind:value={ops.newComment}
			onkeydown={handleKey}
		></textarea>
		<button type="submit" class="pane-icon-btn send" aria-label="Send comment" title="Send (⌘↵)" disabled={!canSend}>
			<Icon name="send" size={14} />
		</button>
	</form>
</section>

<style>
	h3 { margin: 0; }

	.comment {
		padding-left: 0.75rem;
		border-left: 2px solid var(--border-default);
	}

	.comment header {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		margin-bottom: 0.125rem;
	}

	.author { font-size: 0.8125rem; font-weight: 600; }
	time { font-size: 0.75rem; color: var(--text-secondary); }

	.text {
		font-size: 0.8125rem;
		line-height: 1.55;
		overflow-wrap: anywhere;
	}

	.composer { position: relative; }

	.composer .pane-textarea {
		min-height: 2.75rem;
		padding-right: 2.25rem;
	}

	.send {
		position: absolute;
		right: 0.375rem;
		bottom: 0.5rem;
	}

	.send:disabled { opacity: 0.35; cursor: default; }
</style>
