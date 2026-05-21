<script lang="ts">
	import type { Issue, Comment } from '$lib/types';
	import { formatTimestamp } from '$lib/utils';
	import Icon from './Icon.svelte';

	type Props = { issue: Issue };
	let { issue }: Props = $props();

	type Item =
		| { kind: 'comment'; ts: string; author: string; text: string }
		| { kind: 'msg'; ts: string; role: 'user' | 'assistant' | 'tool'; text: string; session: string }
		| { kind: 'event'; ts: string; text: string; by: string };

	// Per-issue activity. Mixes comments with agent chat + system events, chronologically.
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
	function send() {
		if (!draft.trim()) return;
		draft = '';
	}
</script>

<section class="activity">
	<div class="thread scrollarea">
		{#if items.length === 0}
			<div class="empty">No activity yet.</div>
		{:else}
			{#each items as item, i (i)}
				{@const ts = formatTimestamp(item.ts)}
				{#if item.kind === 'event'}
					<div class="item event">
						<span class="dot"></span>
						<span class="event-text">{item.text}</span>
						<span class="by mono">by {item.by}</span>
						<span class="ts mono">{ts.relative}</span>
					</div>
				{:else if item.kind === 'comment'}
					<div class="item comment" class:agent={item.author.startsWith('agent')}>
						<header class="head">
							<span class="author">{item.author}</span>
							<span class="ts mono">{ts.relative}</span>
						</header>
						<p class="body">{item.text}</p>
					</div>
				{:else if item.kind === 'msg'}
					<div class="item msg" class:user={item.role === 'user'} class:assistant={item.role === 'assistant'} class:tool={item.role === 'tool'}>
						<header class="head">
							<span class="role">
								{#if item.role === 'user'}
									<Icon name="message" size={10} /><span>jurre</span>
								{:else if item.role === 'assistant'}
									<span class="pulse-tiny"></span><span>agent-claude-1</span>
								{:else}
									<Icon name="chore" size={10} /><span>tool</span>
								{/if}
							</span>
							<span class="session mono">{item.session}</span>
							<span class="ts mono">{ts.relative}</span>
						</header>
						<p class="body" class:mono={item.role === 'tool'}>{item.text}</p>
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
			onkeydown={(e) => {
				if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); }
			}}
		></textarea>
		<button class="send" type="submit" disabled={!draft.trim()} title="Send (⌘↵)">
			<Icon name="send" size={13} />
		</button>
	</form>
</section>

<style>
	.activity {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.thread {
		max-height: 320px;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 14px;
		padding: 4px 2px 4px 0;
	}

	.empty {
		padding: 14px;
		text-align: center;
		font-size: 12px;
		color: var(--dd-fg-4);
	}

	.item.event {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 11.5px;
		color: var(--dd-fg-3);
	}
	.item.event .dot {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: var(--dd-border-3);
	}
	.event-text { flex: 1; }
	.by { color: var(--dd-fg-4); font-size: 10.5px; }
	.ts { font-size: 10.5px; color: var(--dd-fg-4); }

	.head {
		display: flex;
		align-items: baseline;
		gap: 6px;
		margin-bottom: 4px;
	}
	.author {
		font-size: 12px;
		font-weight: 500;
		color: var(--dd-accent);
	}
	.comment.agent .author { color: var(--dd-agent); }
	.body {
		margin: 0;
		font-size: 12.5px;
		line-height: 1.55;
		color: var(--dd-fg-1);
		white-space: pre-wrap;
	}

	.msg .role {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: 12px;
		font-weight: 500;
		color: var(--dd-fg-2);
	}
	.msg.assistant .role {
		color: var(--dd-agent);
	}
	.msg.user .role {
		color: var(--dd-accent);
	}
	.msg.tool .role {
		color: var(--dd-fg-3);
		font-weight: 400;
	}
	.session {
		font-size: 10px;
		text-transform: lowercase;
		padding: 1px 5px;
		border-radius: 3px;
		background: var(--dd-bg-2);
		color: var(--dd-fg-3);
	}
	.msg.tool .body {
		font-size: 11.5px;
		color: var(--dd-fg-3);
		padding: 4px 8px;
		background: var(--dd-bg-2);
		border-radius: 3px;
		display: inline-block;
	}
	.pulse-tiny {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--dd-agent);
		animation: pulse 1.4s ease-in-out infinite;
	}

	.composer {
		position: relative;
		display: flex;
		margin-top: 6px;
	}
	.composer-input {
		flex: 1;
		resize: vertical;
		min-height: 52px;
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
		background: transparent;
		color: var(--dd-fg-3);
		transition: background 80ms, color 80ms;
	}
	.send:not(:disabled):hover {
		background: var(--dd-accent);
		color: white;
	}
	.send:disabled {
		opacity: 0.4;
		cursor: default;
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; transform: scale(1); }
		50% { opacity: 0.45; transform: scale(0.7); }
	}
</style>
