<script lang="ts">
	import type { Issue } from '$lib/types'
	import { cardLabels, wrappedCount } from '$lib/card-logic'
	import Icon from './Icon.svelte'

	interface Props {
		issue: Issue
		agent: boolean
		inWorktree: boolean
		/** Show every label on as many lines as needed instead of one line with "+n". */
		wrap?: boolean
	}

	let { issue, agent, inWorktree, wrap = false }: Props = $props()

	const labels = $derived(cardLabels(issue.labels))
	const working = $derived(agent && issue.status === 'in_progress')
	const initial = $derived((issue.assignee ?? '').replace(/^@/, '').charAt(0).toUpperCase())

	// The label row is one wrapping line with overflow hidden, so a label is never cut mid-word;
	// whatever wraps onto the hidden line is counted into "+n", which sits right after the last
	// visible label (the row reserves room for it).
	let row: HTMLElement | undefined = $state()
	let hidden = $state(0)
	let moreLeft = $state(0)

	$effect(() => {
		void labels
		if (!row || wrap) {
			hidden = 0
			return
		}
		const el = row
		const observer = new ResizeObserver(() => {
			const tags = [...el.querySelectorAll<HTMLElement>('.tag')]
			hidden = wrappedCount(tags.map((t) => t.offsetTop))
			const last = tags[tags.length - 1 - hidden]
			moreLeft = last ? last.offsetLeft + last.offsetWidth : 0
		})
		observer.observe(el)
		return () => observer.disconnect()
	})

	const hiddenTitle = $derived(
		labels.slice(labels.length - hidden).map((l) => (l.key ? `${l.key}: ${l.text}` : l.text)).join('\n')
	)
</script>

{#if labels.length > 0 || issue.assignee}
	<div class="footer">
		<div class="labels" class:overflowing={hidden > 0} class:wrap bind:this={row}>
			{#each labels as label (`${label.key ?? ''}:${label.text}`)}
				<span class="tag">{#if label.key}<span class="key">{label.key}</span>{/if}{label.text}</span>
			{/each}
			{#if hidden > 0}
				<span class="more" style:left="{moreLeft}px" title={hiddenTitle}>+{hidden}</span>
			{/if}
		</div>
		{#if issue.assignee}
			<!-- One owner slot for people and agents; an agent is told apart by its icon and colour. -->
			<span class="owner" class:agent class:working title={working ? `${issue.assignee} is working` : issue.assignee}>
				{#if agent}
					<Icon name="agent" size={13} />
				{:else}
					<span class="avatar">{initial}</span>
				{/if}
				<span class="name">{issue.assignee}</span>
				{#if working}<span class="pulse"></span>{/if}
				{#if inWorktree}
					<span class="worktree" title="Running in an isolated git worktree"><Icon name="view-tree" size={12} /></span>
				{/if}
			</span>
		{/if}
	</div>
{/if}

<style>
	.footer {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 0.5rem;
		font-size: 0.6875rem;
		line-height: 1rem;
		color: var(--text-secondary);
	}

	.labels {
		position: relative;
		display: flex;
		flex-wrap: wrap;
		gap: 0 0.625rem;
		flex: 1;
		min-width: 0;
		height: 1rem;
		overflow: hidden;
	}

	.labels.overflowing { padding-right: 2rem; }
	.labels.wrap { height: auto; }

	.tag {
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* key:value state labels: the key recedes, the value reads (pane: two-part state chip). */
	.key { margin-right: 0.25em; color: var(--text-tertiary); }

	.more {
		position: absolute;
		top: 0;
		margin-left: 0.5rem;
		color: var(--text-tertiary);
	}

	.owner {
		display: inline-flex;
		align-items: center;
		gap: 0.3125rem;
		flex: none;
		max-width: 50%;
		margin-left: auto;
	}

	.owner.agent { color: var(--tone-agent); }
	.owner.agent:not(.working) .name { color: var(--text-secondary); }

	.avatar {
		display: grid;
		place-items: center;
		flex: none;
		width: 1.0625rem;
		height: 1.0625rem;
		border-radius: var(--radius-full);
		background: var(--cta-muted-hover);
		color: var(--text-primary);
		font-size: 0.6875rem;
		font-weight: 600;
		line-height: 1;
	}

	.name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.pulse {
		flex: none;
		width: 0.375rem;
		height: 0.375rem;
		border-radius: var(--radius-full);
		background: var(--tone-agent);
		animation: pulse 1.6s ease-in-out infinite;
	}

	.worktree { display: inline-flex; color: var(--text-tertiary); }

	@keyframes pulse { 50% { opacity: 0.3; } }

	@media (prefers-reduced-motion: reduce) {
		.pulse { animation: none; }
	}
</style>
