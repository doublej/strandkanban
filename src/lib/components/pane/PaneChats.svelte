<script lang="ts">
	import { fetchJSON } from '$lib/http'
	import { formatTimestamp } from '$lib/utils'
	import MarkdownContent from '../MarkdownContent.svelte'
	import Icon from '../Icon.svelte'

	let { issueId }: { issueId: string } = $props()

	type Session = { sessionId: string; agentName?: string; timestamp: string; summary?: string; preview: string[] }
	type Message = { role: 'user' | 'assistant' | 'tool'; content: string; toolName?: string }

	// The pane is keyed by issue id, so this component lives for exactly one issue.
	let sessions = $state<Session[] | null>(null)
	let error = $state('')
	let openId = $state<string | null>(null)
	let messages = $state<Message[] | null>(null)
	let transcriptError = $state('')

	$effect(() => {
		fetchJSON<{ sessions: Session[] }>(`/api/issues/${encodeURIComponent(issueId)}/agent-sessions`)
			.then((d) => (sessions = d.sessions ?? []))
			.catch((e: Error) => (error = e.message))
	})

	async function toggle(sessionId: string) {
		if (openId === sessionId) {
			openId = null
			return
		}
		openId = sessionId
		messages = null
		transcriptError = ''
		const d = await fetchJSON<{ messages: Message[] }>(`/api/agent-sessions/${encodeURIComponent(sessionId)}/history`)
			.catch((e: Error) => {
				transcriptError = e.message
				return { messages: [] }
			})
		if (openId === sessionId) messages = d.messages ?? []
	}
</script>

{#if sessions === null && !error}
	<p class="pane-meta">Loading related chats…</p>
{:else if error}
	<p class="pane-meta">Related chats unavailable: {error}</p>
{:else if sessions && sessions.length > 0}
	<section class="pane-section">
		<div class="pane-section-head">
			<h3 class="pane-section-label">Related chats</h3>
			<span class="count">{sessions.length}</span>
		</div>
		{#each sessions as s (s.sessionId)}
			<div class="chat">
				<button class="row" aria-expanded={openId === s.sessionId} onclick={() => toggle(s.sessionId)}>
					<Icon name={openId === s.sessionId ? 'chevron-down' : 'chevron-right'} size={12} />
					<span class="name">{s.summary || s.agentName || s.sessionId.slice(0, 8)}</span>
					<span class="pane-meta">{formatTimestamp(s.timestamp).relative}</span>
				</button>
				{#if s.preview[0] && openId !== s.sessionId}<p class="preview">{s.preview[0]}</p>{/if}
				{#if openId === s.sessionId}
					<div class="transcript">
						{#if transcriptError}
							<p class="pane-meta">Transcript unavailable: {transcriptError}</p>
						{:else if messages === null}
							<p class="pane-meta">Loading…</p>
						{:else}
							{#each messages as m, i (i)}
								<div class="msg msg-{m.role}">
									<span class="role">{m.role === 'tool' ? (m.toolName ?? 'tool') : m.role}</span>
									{#if m.role === 'assistant'}<MarkdownContent content={m.content} />{:else}<p>{m.content}</p>{/if}
								</div>
							{/each}
						{/if}
					</div>
				{/if}
			</div>
		{/each}
	</section>
{/if}

<style>
	h3, p { margin: 0; }

	.row {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		width: 100%;
		padding: 0.375rem 0.25rem;
		border: none;
		border-radius: var(--radius-sm);
		background: none;
		color: var(--text-primary);
		font: inherit;
		font-size: 0.8125rem;
		text-align: left;
		cursor: pointer;
	}

	.row:hover { background: var(--cta-muted); }

	.name {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.preview {
		padding-left: 1.375rem;
		font-size: 0.75rem;
		color: var(--text-secondary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.transcript {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin: 0.25rem 0 0.5rem 1.375rem;
		font-size: 0.8125rem;
		line-height: 1.5;
	}

	.msg p { white-space: pre-wrap; overflow-wrap: anywhere; }

	.role {
		display: block;
		font-size: 0.6875rem;
		font-weight: 600;
		color: var(--text-secondary);
		text-transform: capitalize;
	}

	.msg-tool { color: var(--text-secondary); }
</style>
