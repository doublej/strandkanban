<script lang="ts">
	import type { Issue } from '$lib/types'
	import type { PageOps } from '$lib/stores/page-ops.svelte'
	import { getTypeIcon } from '$lib/utils'
	import { copyState } from '$lib/stores/copy-state.svelte'
	import Icon from '../Icon.svelte'

	interface Props {
		ops: PageOps
		issue: Issue
	}

	let { ops, issue }: Props = $props()

	let editingTitle = $state(false)
	let titleDraft = $state('')
	let menuOpen = $state(false)

	const copied = $derived(copyState.copiedId === issue.id)

	function startTitleEdit() {
		titleDraft = issue.title
		editingTitle = true
	}

	/** Saves on Enter or blur; an empty title reverts (every issue needs one). */
	function commitTitle() {
		if (!editingTitle) return
		editingTitle = false
		const title = titleDraft.trim()
		if (title && title !== issue.title) ops.saveFields({ title })
	}

	function handleTitleKey(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault()
			commitTitle()
		} else if (e.key === 'Escape') {
			editingTitle = false
		}
	}

	function focusOnMount(node: HTMLTextAreaElement) {
		node.focus()
		node.select()
	}

	function runMenu(action: () => void) {
		menuOpen = false
		action()
	}
</script>

<svelte:window onclick={() => (menuOpen = false)} />

<header class="panel-header">
	<div class="bar">
		<span class="type" title={issue.issue_type}>
			<Icon name={getTypeIcon(issue.issue_type)} size={14} />
		</span>
		<button
			class="seq"
			class:copied
			title="Copy {issue.id}"
			aria-label="Copy issue ID {issue.id}"
			onclick={() => ops.copyToClipboard(issue.id, issue.id)}
		>
			#{issue.seq}
			<Icon name={copied ? 'check' : 'copy'} size={12} />
		</button>
		<span class="spacer"></span>
		<div class="menu-wrap">
			<button
				class="pane-icon-btn"
				aria-label="More actions"
				aria-haspopup="menu"
				aria-expanded={menuOpen}
				onclick={(e) => { e.stopPropagation(); menuOpen = !menuOpen }}
			>
				<Icon name="more-h" size={16} />
			</button>
			{#if menuOpen}
				<div class="menu" role="menu">
					<button role="menuitem" onclick={() => runMenu(() => ops.copyToClipboard(issue.id, issue.id))}>
						<Icon name="copy" size={14} /> Copy ID
					</button>
					{#if issue.ephemeral}
						<button role="menuitem" onclick={() => runMenu(() => ops.promoteWisp())}>
							<Icon name="pin" size={14} /> Promote to permanent
						</button>
					{/if}
					<hr />
					<button role="menuitem" class="danger" onclick={() => runMenu(() => ops.deleteIssue(issue.id))}>
						<Icon name="trash" size={14} /> Delete issue…
					</button>
				</div>
			{/if}
		</div>
		<button class="pane-icon-btn" aria-label="Close panel" title="Close (Esc)" onclick={() => ops.closePanel()}>
			<Icon name="close" size={16} />
		</button>
	</div>

	{#if editingTitle}
		<textarea
			class="title-input"
			rows="1"
			aria-label="Title"
			bind:value={titleDraft}
			onkeydown={handleTitleKey}
			onblur={commitTitle}
			use:focusOnMount
		></textarea>
	{:else}
		<h2 class="title">
			<button class="title-btn" title="Click to rename" onclick={startTitleEdit}>{issue.title}</button>
		</h2>
	{/if}
</header>

<style>
	.panel-header {
		padding: 0.75rem 1.25rem 0.875rem;
		border-bottom: 1px solid var(--border-subtle);
		background: var(--surface-panel);
		touch-action: pan-x;
	}

	.bar {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		margin-bottom: 0.375rem;
	}

	.spacer { flex: 1; }

	.type {
		display: inline-flex;
		color: var(--text-secondary);
	}

	.seq {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.125rem 0.375rem;
		border: none;
		border-radius: var(--radius-xs);
		background: none;
		color: var(--text-secondary);
		font-family: var(--font-mono);
		font-size: 0.75rem;
		cursor: pointer;
	}

	.seq :global(svg) { opacity: 0.6; }
	.seq:hover { background: var(--cta-muted); color: var(--text-primary); }
	.seq.copied { color: var(--state-done); }

	.menu-wrap { position: relative; }

	.menu {
		position: absolute;
		top: calc(100% + 4px);
		right: 0;
		z-index: 20;
		min-width: 12rem;
		padding: 0.25rem;
		border: 1px solid var(--border-default);
		border-radius: var(--radius-sm);
		background: var(--surface-elevated);
		box-shadow: var(--shadow-lg);
	}

	.menu button {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		padding: 0.4375rem 0.625rem;
		border: none;
		border-radius: var(--radius-xs);
		background: none;
		color: var(--text-primary);
		font: inherit;
		font-size: 0.8125rem;
		text-align: left;
		cursor: pointer;
	}

	.menu button:hover { background: var(--cta-muted-hover); }
	.menu button.danger { color: var(--cta-danger); }
	.menu hr { margin: 0.25rem 0; border: none; border-top: 1px solid var(--border-subtle); }

	.title { margin: 0; }

	.title-btn,
	.title-input {
		display: block;
		width: 100%;
		margin: 0 -0.375rem;
		padding: 0.25rem 0.375rem;
		border: 1px solid transparent;
		border-radius: var(--radius-sm);
		background: none;
		color: var(--text-primary);
		font: inherit;
		font-size: 1.125rem;
		font-weight: 600;
		line-height: 1.35;
		text-align: left;
		box-sizing: content-box;
	}

	.title-btn { cursor: text; overflow-wrap: anywhere; }
	.title-btn:hover { background: var(--cta-muted); }

	.title-input {
		resize: none;
		field-sizing: content;
		background: var(--surface-card);
		border-color: var(--accent-primary);
		outline: none;
	}
</style>
