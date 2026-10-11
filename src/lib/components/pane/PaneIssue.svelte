<script lang="ts">
	import type { Issue } from '$lib/types'
	import type { PageOps } from '$lib/stores/page-ops.svelte'
	import type { DraftField } from '$lib/pane-logic'
	import { mergeLiveIssue } from '$lib/pane-logic'
	import { lintIssueApi } from '$lib/api'
	import { ApiClientError } from '$lib/http'
	import { settings } from '$lib/stores/settings.svelte'
	import Icon from '../Icon.svelte'
	import PaneHeader from './PaneHeader.svelte'
	import PaneProperties from './PaneProperties.svelte'
	import PaneText from './PaneText.svelte'
	import PaneRelations from './PaneRelations.svelte'
	import PaneComments from './PaneComments.svelte'
	import PaneAttachments from './PaneAttachments.svelte'
	import PaneChats from './PaneChats.svelte'
	import PaneHistory from './PaneHistory.svelte'
	import MarkdownContent from '../MarkdownContent.svelte'

	interface Props {
		ops: PageOps
		issues: Issue[]
		activeAgents: string[]
	}

	let { ops, issues, activeAgents }: Props = $props()

	/** The full read of the open issue, kept live by the board list (agents, CLI, optimistic writes). */
	const issue = $derived(mergeLiveIssue(ops.editingIssue!, issues))
	const closed = $derived(issue.status === 'closed')

	const SECTIONS: { field: DraftField; label: string }[] = [
		{ field: 'design', label: 'Design' },
		{ field: 'acceptance_criteria', label: 'Acceptance criteria' },
		{ field: 'notes', label: 'Notes' }
	]

	// Recommended-but-missing sections from `bd lint`. A failed lint only costs the hint.
	// Derived values only notify on change, so live list updates don't re-run the lint.
	const id = $derived(issue.id)
	let lintMissing = $state<string[]>([])
	$effect(() => {
		if (closed) return
		lintIssueApi(id)
			.then((m) => (lintMissing = m.map((s) => s.replace(/^#+\s*/, ''))))
			.catch((e: unknown) => {
				if (!(e instanceof ApiClientError)) throw e
				console.warn(`[pane] lint unavailable for ${id}: ${e.message}`)
			})
	})

	const isCriteria = (m: string) => /acceptance|success/i.test(m)
	const criteriaRecommended = $derived(lintMissing.some(isCriteria))
	const otherMissing = $derived(lintMissing.filter((m) => !isCriteria(m)))

	/** Shown as a section when filled or being edited; Notes move into the Summary once closed. */
	function sectionVisible(field: DraftField): boolean {
		if (ops.drafts[field]) return true
		if (field === 'notes' && closed) return false
		return !!issue[field]
	}

	const addable = $derived(SECTIONS.filter((s) => !sectionVisible(s.field) && !(s.field === 'notes' && closed && issue.notes)))
	const canStartAgent = $derived(settings.agentEnabled && !closed)

	function startAgent() {
		if (ops.confirmDiscard()) ops.startAgentForIssue(issue)
	}
</script>

<PaneHeader {ops} {issue} {issues} {activeAgents} />

<div class="pane-body">
	{#if ops.issueClosedExternally}
		<div class="pane-banner warn" role="status">
			<Icon name="info" size={14} /> Completed elsewhere while you had it open.
			<button class="pane-link push" onclick={() => (ops.issueClosedExternally = false)}>Dismiss</button>
		</div>
	{/if}
	{#if issue.ephemeral}
		<div class="pane-banner">
			<span>Wisp{issue.wisp_type ? ` · ${issue.wisp_type}` : ''} — temporary, may be compacted</span>
			<button class="btn btn-secondary btn-sm push" onclick={() => ops.promoteWisp()}>Promote</button>
		</div>
	{/if}
	{#if closed && (issue.close_reason || issue.notes)}
		<div class="summary">
			{#if issue.close_reason}<p class="reason"><Icon name="check-circle" size={14} /> {issue.close_reason}</p>{/if}
			{#if issue.notes && !ops.drafts.notes}
				<MarkdownContent content={issue.notes} />
				<button class="pane-link" onclick={() => ops.startDraft('notes')}><Icon name="edit" size={12} /> Edit summary</button>
			{/if}
		</div>
	{/if}

	<PaneProperties {ops} {issue} {activeAgents} />

	<PaneText {ops} field="description" label="Description" value={issue.description} placeholder="Add a description…" />
	{#if otherMissing.length > 0}
		<p class="pane-meta recommend">Recommended in the description: {otherMissing.join(', ')}</p>
	{/if}

	{#each SECTIONS as s (s.field)}
		{#if sectionVisible(s.field)}
			<PaneText {ops} field={s.field} label={s.label} value={issue[s.field]} removable />
		{/if}
	{/each}

	{#if addable.length > 0}
		<div class="add-sections">
			{#each addable as s (s.field)}
				{@const rec = s.field === 'acceptance_criteria' && criteriaRecommended}
				<button class="pane-link" class:rec onclick={() => ops.startDraft(s.field)}>
					<Icon name="plus" size={12} /> {s.label}{rec ? ' (recommended)' : ''}
				</button>
			{/each}
		</div>
	{/if}

	<PaneRelations {ops} {issue} {issues} />
	<PaneComments {ops} />
	<PaneAttachments {ops} issueId={issue.id} />
	<PaneChats issueId={issue.id} />
	<PaneHistory issueId={issue.id} />
</div>

{#if canStartAgent}
	<footer class="pane-footer">
		<button class="btn {issue.assignee ? 'btn-secondary' : 'btn-primary'}" onclick={startAgent}>
			<Icon name="agent" size={14} /> Start agent
		</button>
	</footer>
{/if}

<style>
	.summary {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		padding: 0.75rem;
		border-left: 3px solid var(--state-done);
		border-radius: var(--radius-sm);
		background: var(--surface-card);
		font-size: 0.875rem;
		line-height: 1.55;
	}

	.summary .pane-link { align-self: flex-start; }

	.reason {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		margin: 0;
		font-weight: 600;
		color: var(--state-done);
	}

	.recommend { margin: calc(-1 * var(--pane-gap) + 0.25rem) 0 0; color: var(--pane-warn); }

	.add-sections {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		margin: calc(-1 * var(--pane-gap) + 0.5rem) 0 0 -0.375rem;
	}

	.rec { color: var(--pane-warn); }
</style>
