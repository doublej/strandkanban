<script lang="ts">
	import type { Issue } from '$lib/types';
	import { columns, getPriorityConfig, getTypeIcon, isAgentAssignee, formatTimestamp } from '$lib/utils';
	import Icon from './Icon.svelte';
	import DetailRelations from './DetailRelations.svelte';
	import DetailComments from './DetailComments.svelte';

	type Props = { issue: Issue };
	let { issue }: Props = $props();

	const col = $derived(columns.find((c) => c.status === issue.status)!);
	const pri = $derived(getPriorityConfig(issue.priority));
	const created = $derived(formatTimestamp(issue.created_at));
	const isAgent = $derived(isAgentAssignee(issue.assignee));
	const isClosed = $derived(issue.status === 'closed');

	const relatedChats = [
		{ id: 1, title: 'Auth token refresh — investigation', preview: 'Started exploring why the CSRF token is stale after the…', ts: '2h ago' },
		{ id: 2, title: 'Patch sketch v2', preview: 'Tried the boundary refresh, here is the diff and why I…', ts: '38m ago' }
	];

	let openChat = $state<number | null>(null);
</script>

<div class="body scrollarea">
	<!-- Spec bar -->
	<div class="spec-bar">
		<div class="spec-row primary">
			<span class="chip status" style="--bg: {col.accent};">
				<Icon name={col.icon} size={11} />
				<span>{col.label}</span>
			</span>
			<span class="chip neutral">
				<span class="dot" style="background: {pri.color};"></span>
				<span>{pri.label}</span>
			</span>
			<span class="chip neutral">
				<Icon name={getTypeIcon(issue.issue_type)} size={11} />
				<span>{issue.issue_type}</span>
			</span>
		</div>

		<div class="spec-row secondary">
			<span class="meta-bit mono" title={created.absolute}>
				<span class="meta-label">created</span>
				{created.relative}
			</span>
			{#if isAgent && issue.assignee}
				<span class="chip agent" class:working={issue.status === 'in_progress'}>
					{#if issue.status === 'in_progress'}
						<span class="pulse-dot"></span>
					{:else}
						<Icon name="agent" size={11} />
					{/if}
					<span class="mono">{issue.assignee}</span>
				</span>
				{#if issue.status === 'in_progress'}
					<button class="chip-link">
						<Icon name="message" size={11} />
						<span>Chat</span>
					</button>
				{/if}
			{:else if issue.assignee}
				<span class="chip neutral">
					<span class="dot" style="background: var(--dd-human);"></span>
					<span>{issue.assignee}</span>
				</span>
			{/if}
		</div>
	</div>

	<!-- Close callouts (only on closed) -->
	{#if isClosed && issue.notes}
		<aside class="callout summary">
			<span class="callout-label">SUMMARY</span>
			<p>{issue.notes}</p>
		</aside>
	{/if}

	<!-- Title & description -->
	<h1 class="title">{issue.title}</h1>
	<p class="desc">{issue.description}</p>

	<!-- Optional structured sections -->
	{#if issue.design}
		<section class="struct">
			<span class="section-label">Design</span>
			<p>{issue.design}</p>
		</section>
	{/if}
	{#if issue.acceptance_criteria}
		<section class="struct">
			<span class="section-label">Acceptance</span>
			<p>{issue.acceptance_criteria}</p>
		</section>
	{/if}
	{#if issue.notes && !isClosed}
		<section class="struct">
			<span class="section-label">Notes</span>
			<p>{issue.notes}</p>
		</section>
	{/if}

	<!-- Labels strip -->
	{#if issue.labels && issue.labels.length > 0}
		<div class="labels">
			{#each issue.labels as label}
				<span class="label">{label}</span>
			{/each}
		</div>
	{/if}

	<DetailRelations dependencies={issue.dependencies} dependents={issue.dependents} />

	<DetailComments comments={issue.comments} />

	<!-- Attachments stub -->
	<section class="atts">
		<header class="section-head">
			<span class="section-label">Attachments</span>
		</header>
		<div class="att-empty">
			<Icon name="paperclip" size={13} />
			<span>Drop or paste files here</span>
		</div>
	</section>

	<!-- Related chats -->
	<section class="chats">
		<header class="section-head">
			<span class="section-label">Related Chats</span>
			<span class="section-count mono">{relatedChats.length}</span>
		</header>
		<div class="chat-list">
			{#each relatedChats as chat (chat.id)}
				<button
					class="chat-row"
					onclick={() => (openChat = openChat === chat.id ? null : chat.id)}
				>
					<Icon name={openChat === chat.id ? 'chevron-down' : 'chevron-right'} size={10} />
					<span class="chat-title">{chat.title}</span>
					<span class="chat-preview">{chat.preview}</span>
					<span class="chat-ts mono">{chat.ts}</span>
				</button>
				{#if openChat === chat.id}
					<div class="chat-detail">
						<div class="msg user">Looked into this — the token expires before the second factor screen even loads.</div>
						<div class="msg assistant">Confirmed. The challenge endpoint reads the token from the cookie which is already invalidated by the boundary middleware. Patch sketch in next message.</div>
						<div class="msg tool mono">[edit auth/challenge.ts:142 — 8 lines]</div>
					</div>
				{/if}
			{/each}
		</div>
	</section>
</div>

<style>
	.body {
		flex: 1;
		overflow-y: auto;
		padding: 18px;
		display: flex;
		flex-direction: column;
		gap: 18px;
	}

	.spec-bar {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.spec-row {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		align-items: center;
	}

	.chip {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: 24px;
		padding: 0 9px;
		border-radius: var(--dd-r-2);
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		font-weight: 500;
	}
	.chip.status {
		background: var(--bg);
		color: white;
	}
	.chip.neutral {
		background: var(--dd-bg-3);
		color: var(--dd-fg-1);
		border: 1px solid var(--dd-border-1);
	}
	.chip.agent {
		background: color-mix(in srgb, var(--dd-agent) 18%, var(--dd-bg-2));
		color: var(--dd-agent);
		border: 1px solid color-mix(in srgb, var(--dd-agent) 38%, var(--dd-border-1));
	}
	.chip-link {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		height: 24px;
		padding: 0 9px;
		border-radius: var(--dd-r-2);
		background: transparent;
		border: 1px solid var(--dd-border-2);
		color: var(--dd-fg-2);
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.chip-link:hover {
		color: var(--dd-fg-1);
		background: var(--dd-bg-3);
	}
	.dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
	}
	.pulse-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: currentColor;
		animation: pulse 1.4s ease-in-out infinite;
	}

	.meta-bit {
		font-size: 11px;
		color: var(--dd-fg-3);
	}
	.meta-label {
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--dd-fg-4);
		margin-right: 4px;
	}

	.callout {
		position: relative;
		padding: 12px 14px 12px 18px;
		background: color-mix(in srgb, var(--dd-agent) 8%, var(--dd-bg-2));
		border: 1px solid color-mix(in srgb, var(--dd-agent) 22%, var(--dd-border-1));
		border-radius: var(--dd-r-2);
	}
	.callout::before {
		content: '';
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: 3px;
		background: var(--dd-agent);
		border-radius: 2px 0 0 2px;
	}
	.callout-label {
		display: block;
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--dd-agent);
		font-weight: 600;
		margin-bottom: 6px;
	}
	.callout p {
		margin: 0;
		font-size: 13px;
		line-height: 1.55;
		color: var(--dd-fg-1);
	}

	.title {
		margin: 4px 0 0;
		font-size: 22px;
		font-weight: 600;
		line-height: 1.25;
		letter-spacing: -0.022em;
		color: var(--dd-fg-1);
	}

	.desc {
		margin: 0;
		font-size: 13.5px;
		line-height: 1.65;
		color: var(--dd-fg-2);
		white-space: pre-wrap;
	}

	.struct {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 12px 14px;
		background: var(--dd-bg-2);
		border: 1px solid var(--dd-border-1);
		border-radius: var(--dd-r-2);
	}
	.struct p {
		margin: 0;
		font-size: 13px;
		line-height: 1.55;
		color: var(--dd-fg-1);
		white-space: pre-wrap;
	}

	.section-label {
		font-size: 10.5px;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--dd-fg-3);
		font-weight: 500;
	}

	.labels {
		display: flex;
		flex-wrap: wrap;
		gap: 5px;
	}
	.label {
		font-size: 10.5px;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 3px 7px;
		border-radius: 3px;
		background: var(--dd-bg-3);
		color: var(--dd-fg-2);
		border: 1px solid var(--dd-border-1);
	}

	.section-head {
		display: flex;
		align-items: baseline;
		gap: 6px;
	}
	.section-count {
		font-size: 10.5px;
		color: var(--dd-fg-4);
	}

	.atts { display: flex; flex-direction: column; gap: 8px; }
	.att-empty {
		display: flex;
		align-items: center;
		gap: 8px;
		justify-content: center;
		padding: 14px;
		border: 1px dashed var(--dd-border-1);
		border-radius: var(--dd-r-2);
		color: var(--dd-fg-3);
		font-size: 11.5px;
	}

	.chats { display: flex; flex-direction: column; gap: 8px; }
	.chat-list {
		display: flex;
		flex-direction: column;
		gap: 1px;
		background: var(--dd-bg-2);
		border: 1px solid var(--dd-border-1);
		border-radius: var(--dd-r-2);
		overflow: hidden;
	}
	.chat-row {
		display: grid;
		grid-template-columns: auto auto 1fr auto;
		gap: 10px;
		align-items: center;
		padding: 8px 12px;
		background: var(--dd-bg-1);
		text-align: left;
		transition: background 80ms;
		color: var(--dd-fg-3);
	}
	.chat-row:hover {
		background: var(--dd-bg-3);
	}
	.chat-title {
		color: var(--dd-fg-1);
		font-size: 12px;
		font-weight: 500;
	}
	.chat-preview {
		color: var(--dd-fg-3);
		font-size: 11.5px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.chat-ts {
		color: var(--dd-fg-4);
		font-size: 10.5px;
	}
	.chat-detail {
		padding: 8px 12px 12px 32px;
		background: var(--dd-bg-2);
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.msg {
		padding: 7px 10px;
		border-radius: var(--dd-r-2);
		font-size: 12px;
		line-height: 1.5;
	}
	.msg.user {
		background: var(--dd-bg-1);
		color: var(--dd-fg-2);
		border: 1px solid var(--dd-border-1);
	}
	.msg.assistant {
		background: color-mix(in srgb, var(--dd-agent) 8%, var(--dd-bg-2));
		color: var(--dd-fg-1);
		border: 1px solid color-mix(in srgb, var(--dd-agent) 18%, var(--dd-border-1));
	}
	.msg.tool {
		font-size: 11px;
		color: var(--dd-fg-3);
		background: transparent;
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; transform: scale(1); }
		50% { opacity: 0.5; transform: scale(0.85); }
	}
</style>
