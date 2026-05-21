<script lang="ts">
	import type { Issue } from '$lib/types';
	import { formatTimestamp } from '$lib/utils';
	import Icon from './Icon.svelte';

	type Props = { issue: Issue };
	let { issue }: Props = $props();

	type Item =
		| { kind: 'comment'; ts: string; author: string; text: string }
		| { kind: 'msg'; ts: string; role: 'user' | 'assistant' | 'tool'; text: string; session: string }
		| { kind: 'event'; ts: string; text: string; by: string };

	const extraActivity: Record<string, Item[]> = {
		'bk-0142': [
			{ kind: 'event', ts: new Date(Date.now() - 60 * 60 * 1000 * 3).toISOString(), text: 'Status changed to In Progress', by: 'jurre' },
			{ kind: 'msg', ts: new Date(Date.now() - 60 * 60 * 1000 * 2.5).toISOString(), role: 'user', text: 'Take a look at the 2FA timeout regression. Repro on Safari and Chrome.', session: 'investigation' },
			{ kind: 'msg', ts: new Date(Date.now() - 60 * 60 * 1000 * 2.4).toISOString(), role: 'assistant', text: 'Reproduced. The CSRF token is invalidated before the second-factor screen mounts. Reading the challenge handler now.', session: 'investigation' },
			{ kind: 'msg', ts: new Date(Date.now() - 60 * 60 * 1000 * 2.3).toISOString(), role: 'tool', text: 'read auth/challenge.ts:120-160', session: 'investigation' },
			{ kind: 'msg', ts: new Date(Date.now() - 60 * 60 * 1000 * 1.5).toISOString(), role: 'assistant', text: 'Found it. The boundary middleware refreshes the token but the challenge handler captured the old reference in a closure. Two-line fix.', session: 'investigation' }
		]
	};

	const items = $derived.by<Item[]>(() => {
		const comments: Item[] = (issue.comments ?? []).map((c) => ({
			kind: 'comment' as const,
			ts: c.created_at,
			author: c.author,
			text: c.text
		}));
		const extras = extraActivity[issue.id] ?? [];
		return [...comments, ...extras].sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
	});

	let draft = $state('');
	function send() { if (draft.trim()) draft = ''; }

	function authorColor(item: Item): string {
		if (item.kind === 'comment') {
			return item.author.startsWith('agent') ? 'var(--agent)' : 'var(--accent)';
		}
		if (item.kind === 'msg') {
			if (item.role === 'assistant') return 'var(--agent)';
			if (item.role === 'user') return 'var(--accent)';
		}
		return 'var(--ink-3)';
	}
</script>

<div class="thread scrollarea">
	{#if items.length === 0}
		<div class="empty">No activity yet.</div>
	{:else}
		{#each items as item, i (i)}
			{@const ts = formatTimestamp(item.ts)}
			{#if item.kind === 'event'}
				<div class="item event">
					<span class="event-rail"></span>
					<span class="event-text">{item.text}</span>
					<span class="event-by mono">{item.by}</span>
					<span class="event-ts mono">{ts.relative}</span>
				</div>
			{:else}
				<div class="item">
					<div class="head">
						<span class="author" style="color: {authorColor(item)};">
							{#if item.kind === 'comment'}
								{item.author}
							{:else if item.role === 'user'}
								jurre
							{:else if item.role === 'assistant'}
								<span class="dot pulse"></span> agent-claude-1
							{:else}
								<Icon name="chore" size={12} /> tool
							{/if}
						</span>
						{#if item.kind === 'msg'}
							<span class="session label">{item.session}</span>
						{/if}
						<span class="ts mono">{ts.relative}</span>
					</div>
					{#if item.kind === 'msg' && item.role === 'tool'}
						<pre class="body code mono">{item.text}</pre>
					{:else}
						<p class="body">{item.text}</p>
					{/if}
				</div>
			{/if}
		{/each}
	{/if}
</div>

<form class="composer" onsubmit={(e) => { e.preventDefault(); send(); }}>
	<textarea
		class="composer-input"
		rows="2"
		placeholder="Add a comment…"
		bind:value={draft}
		onkeydown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); } }}
	></textarea>
	<button class="icon-btn send" type="submit" disabled={!draft.trim()} title="Send (⌘↵)">
		<Icon name="send" size={12} />
	</button>
</form>

<style>
	.thread {
		max-height: 320px;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: var(--sp-4);
		padding-right: var(--sp-1);
	}

	.empty {
		padding: var(--sp-4);
		text-align: center;
		font-size: var(--fs-sm);
		color: var(--ink-4);
	}

	.item.event {
		display: grid;
		grid-template-columns: var(--sp-4) 1fr auto auto;
		gap: var(--sp-2);
		align-items: center;
		height: var(--ctrl-md);
		font-size: var(--fs-xs);
		color: var(--ink-3);
	}
	.event-rail {
		justify-self: end;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--line-3);
	}
	.event-by { color: var(--ink-4); }
	.event-ts { color: var(--ink-4); }

	.item:not(.event) {
		display: flex;
		flex-direction: column;
		gap: var(--sp-1);
	}
	.head {
		display: flex;
		align-items: baseline;
		gap: var(--sp-2);
		min-height: var(--ctrl-md);
	}
	.author {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-1);
		font-size: var(--fs-sm);
		font-weight: 500;
	}
	.author .dot {
		background: currentColor;
		animation: pulse 1.4s ease-in-out infinite;
	}
	.session {
		font-size: 10px;
		text-transform: lowercase;
		letter-spacing: 0;
		padding: 1px var(--sp-1);
		border-radius: var(--r-sm);
		background: var(--surf-2);
		color: var(--ink-3);
		font-weight: 400;
	}
	.ts {
		font-size: var(--fs-xs);
		color: var(--ink-4);
		margin-left: auto;
	}

	.body {
		margin: 0;
		font-size: var(--fs-md);
		line-height: var(--lh-prose);
		color: var(--ink-1);
		white-space: pre-wrap;
	}
	.body.code {
		font-size: var(--fs-sm);
		color: var(--ink-2);
		padding: var(--sp-2) var(--sp-3);
		background: var(--surf-2);
		border-radius: var(--r-sm);
		display: block;
	}

	.composer {
		position: relative;
		display: flex;
		margin-top: var(--sp-2);
	}
	.composer-input {
		flex: 1;
		resize: vertical;
		min-height: calc(var(--ctrl-xl) + var(--sp-3));
		padding-right: calc(var(--ctrl-lg) + var(--sp-2));
	}
	.send {
		position: absolute;
		right: var(--sp-1);
		bottom: var(--sp-1);
	}
	.send:not(:disabled):hover {
		background: var(--accent);
		color: white;
	}
	.send:disabled { opacity: 0.4; cursor: default; }

	@keyframes pulse {
		0%, 100% { opacity: 1; transform: scale(1); }
		50% { opacity: 0.45; transform: scale(0.7); }
	}
</style>
