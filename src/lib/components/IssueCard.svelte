<script lang="ts">
	import type { Issue } from '$lib/types'
	import { getDueInfo, isAgentAssignee } from '$lib/utils'
	import { relationSummary } from '$lib/card-logic'
	import { typeLabel, dueChipLabel } from '$lib/pane-logic'
	import IssueCardTop from './IssueCardTop.svelte'
	import IssueCardFooter from './IssueCardFooter.svelte'

	interface Props {
		issue: Issue
		seqById: Map<string, number>
		selected: boolean
		dragging: boolean
		animating: boolean
		editing?: boolean
		filterDimmed?: boolean
		flyingHidden?: boolean
		shrinkingSource?: boolean
		inWorktree?: boolean
		registerCard: (node: HTMLElement, id: string) => void
		onclick: () => void
		ondragstart: (e: DragEvent) => void
		ondragend: (e: DragEvent) => void
		oncontextmenu: (e: MouseEvent) => void
	}

	let {
		issue,
		seqById,
		selected,
		dragging,
		animating,
		editing = false,
		filterDimmed = false,
		flyingHidden = false,
		shrinkingSource = false,
		inWorktree = false,
		registerCard,
		onclick,
		ondragstart,
		ondragend,
		oncontextmenu
	}: Props = $props()

	// A finished issue can't be late or hold anything up, so it shows neither.
	const closed = $derived(issue.status === 'closed')
	const relation = $derived(closed ? null : relationSummary(issue, seqById))
	const due = $derived(closed ? null : getDueInfo(issue.due_at))
	const agent = $derived(isAgentAssignee(issue.assignee))

	// Screen readers get the card as one sentence instead of a run of badges.
	const ariaLabel = $derived(
		[
			`#${issue.seq} ${issue.title}`,
			typeLabel(issue.issue_type),
			issue.priority <= 1 ? `P${issue.priority}` : '',
			relation?.text ?? '',
			due ? dueChipLabel(due.label) : '',
			issue.assignee ? `assigned to ${issue.assignee}` : ''
		].filter(Boolean).join(', ')
	)

	function handleKey(e: KeyboardEvent) {
		if (e.key !== 'Enter' && e.key !== ' ') return
		e.preventDefault()
		onclick()
	}
</script>

<div
	role="button"
	tabindex="0"
	aria-label={ariaLabel}
	class="card"
	class:animating
	class:selected
	class:editing
	class:dragging
	class:wisp={issue.ephemeral}
	class:filter-dimmed={filterDimmed}
	class:flying-hidden={flyingHidden}
	class:shrinking-source={shrinkingSource}
	draggable="true"
	{ondragstart}
	{ondragend}
	{onclick}
	onkeydown={handleKey}
	{oncontextmenu}
	use:registerCard={issue.id}
	data-card-id={issue.id}
>
	<IssueCardTop {issue} {relation} {due} />
	<h3 class="title">{issue.title}</h3>
	{#if issue.description}
		<p class="description">{issue.description}</p>
	{/if}
	<IssueCardFooter {issue} {agent} {inWorktree} />
</div>

<style>
	.card {
		position: relative;
		flex-shrink: 0;
		margin: 2px 4px;
		padding: 0.625rem 0.75rem 0.6875rem;
		background: var(--surface-card);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition:
			transform var(--transition-fast),
			box-shadow var(--transition-fast),
			border-color var(--transition-fast);
		overflow: hidden;
		/* Skip rendering offscreen cards. Every card stays in the DOM (find-in-page,
		   keyboard nav, drag targets and counts keep working) — only layout/paint is
		   deferred, which is why this beats a virtual list here. */
		content-visibility: auto;
		contain-intrinsic-size: auto 96px;
	}

	.card:hover {
		border-color: var(--border-default);
		transform: translateY(-1px);
	}

	.card:active {
		transform: translateY(0) scale(0.995);
		transition: transform 80ms ease-out;
	}

	.card:focus-visible {
		outline: 2px solid var(--accent-primary);
		outline-offset: 2px;
	}

	.card.selected,
	.card.editing {
		border-color: var(--accent-primary);
		box-shadow: 0 0 0 1px var(--accent-primary);
	}

	.card.editing { z-index: 5; }

	/* Wisps are temporary: a dashed edge says so without another badge. */
	.card.wisp { border-style: dashed; border-color: var(--border-strong); }

	.card.dragging {
		opacity: 0.85;
		transform: rotate(1deg) scale(1.01);
		box-shadow: var(--shadow-lg);
		cursor: grabbing;
		z-index: 100;
	}

	.card.animating {
		animation: cardPulse 300ms ease-out;
		z-index: 10;
	}

	@keyframes cardPulse {
		0% { box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.5); }
		100% { box-shadow: none; }
	}

	.card.filter-dimmed {
		opacity: 0.15;
		pointer-events: none;
		transform: scale(0.98);
		filter: grayscale(0.5);
	}

	.card.flying-hidden {
		opacity: 0;
		pointer-events: none;
	}

	.card.shrinking-source {
		height: 0;
		min-height: 0;
		margin-top: 0;
		margin-bottom: 0;
		padding-top: 0;
		padding-bottom: 0;
		border-top-width: 0;
		border-bottom-width: 0;
		overflow: hidden;
		transition:
			height 300ms cubic-bezier(0.22, 1, 0.36, 1),
			margin 300ms cubic-bezier(0.22, 1, 0.36, 1),
			padding 300ms cubic-bezier(0.22, 1, 0.36, 1),
			border-width 300ms cubic-bezier(0.22, 1, 0.36, 1),
			opacity 150ms linear 300ms;
		opacity: 0;
		pointer-events: none;
	}

	.title {
		margin: 0.4375rem 0 0;
		font-size: 0.8125rem;
		font-weight: 550;
		line-height: 1.25rem;
		color: var(--text-primary);
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.description {
		margin: 0.125rem 0 0;
		font-size: 0.75rem;
		line-height: 1.125rem;
		color: var(--text-secondary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	@media (max-width: 768px) {
		.card { margin: 1px 2px; }
	}

	/* Light theme */
	:global(.app.light) .card { box-shadow: var(--shadow-sm); }
	:global(.app.light) .card:hover { box-shadow: var(--shadow-md); }
	:global(.app.light) .card.selected,
	:global(.app.light) .card.editing { box-shadow: 0 0 0 1px var(--accent-primary), var(--shadow-sm); }
	:global(.app.light) .card.dragging { box-shadow: var(--shadow-lg); }
</style>
