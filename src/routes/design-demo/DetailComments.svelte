<script lang="ts">
	import type { Comment } from '$lib/types';
	import { formatTimestamp } from '$lib/utils';
	import Icon from './Icon.svelte';

	type Props = { comments?: Comment[] };
	let { comments = [] }: Props = $props();

	let draft = $state('');

	function send() {
		if (!draft.trim()) return;
		draft = '';
	}
</script>

<section class="comments">
	<header class="section-head">
		<span class="section-label">Comments</span>
		<span class="section-count mono">{comments.length}</span>
	</header>

	<div class="thread scrollarea">
		{#if comments.length === 0}
			<div class="empty">No comments yet.</div>
		{:else}
			{#each comments as c (c.id)}
				{@const ts = formatTimestamp(c.created_at)}
				<article class="comment">
					<header class="comment-head">
						<span class="author" class:agent={c.author.startsWith('agent')}>{c.author}</span>
						<span class="ts mono" title={ts.absolute}>{ts.relative}</span>
					</header>
					<p class="body">{c.text}</p>
				</article>
			{/each}
		{/if}
	</div>

	<form class="composer" onsubmit={(e) => { e.preventDefault(); send(); }}>
		<textarea
			class="composer-input"
			rows="2"
			placeholder="Add comment…"
			bind:value={draft}
			onkeydown={(e) => {
				if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
					e.preventDefault();
					send();
				}
			}}
		></textarea>
		<button class="send" type="submit" disabled={!draft.trim()} title="Send (⌘↵)">
			<Icon name="send" size={13} />
		</button>
	</form>
</section>

<style>
	.comments {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.section-head {
		display: flex;
		align-items: baseline;
		gap: 6px;
	}
	.section-label {
		font-size: 10.5px;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--dd-fg-3);
		font-weight: 500;
	}
	.section-count {
		font-size: 10.5px;
		color: var(--dd-fg-4);
	}

	.thread {
		max-height: 220px;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 4px 2px;
	}

	.empty {
		padding: 16px 12px;
		text-align: center;
		font-size: 12px;
		color: var(--dd-fg-4);
		border: 1px dashed var(--dd-border-1);
		border-radius: var(--dd-r-2);
	}

	.comment-head {
		display: flex;
		align-items: baseline;
		gap: 8px;
		margin-bottom: 3px;
	}
	.author {
		font-size: 12px;
		font-weight: 500;
		color: var(--dd-accent);
	}
	.author.agent {
		color: var(--dd-agent);
	}
	.ts {
		font-size: 10.5px;
		color: var(--dd-fg-4);
	}
	.body {
		margin: 0;
		font-size: 12.5px;
		line-height: 1.5;
		color: var(--dd-fg-1);
		white-space: pre-wrap;
	}

	.composer {
		position: relative;
		display: flex;
		align-items: stretch;
	}
	.composer-input {
		flex: 1;
		resize: vertical;
		min-height: 50px;
		padding-right: 38px;
	}
	.send {
		position: absolute;
		right: 6px;
		bottom: 6px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border-radius: 4px;
		background: var(--dd-bg-3);
		color: var(--dd-fg-3);
		transition: background 80ms, color 80ms;
	}
	.send:not(:disabled):hover {
		background: var(--dd-accent);
		color: white;
	}
	.send:disabled {
		opacity: 0.45;
		cursor: default;
	}
</style>
