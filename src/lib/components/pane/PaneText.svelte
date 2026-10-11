<script lang="ts">
	import type { PageOps } from '$lib/stores/page-ops.svelte'
	import type { DraftField } from '$lib/pane-logic'
	import MarkdownContent from '../MarkdownContent.svelte'
	import Icon from '../Icon.svelte'

	interface Props {
		ops: PageOps
		field: DraftField
		label: string
		value: string | undefined
		placeholder?: string
		/** Offer × to empty the section (Design/Acceptance/Notes; not Description). */
		removable?: boolean
	}

	let { ops, field, label, value, placeholder = 'Nothing here yet.', removable = false }: Props = $props()

	const draft = $derived(ops.drafts[field])
	const dirty = $derived(!!draft && draft.value !== draft.base)

	function focusOnMount(node: HTMLTextAreaElement) {
		node.focus()
	}

	function handleKey(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
			e.preventDefault()
			e.stopPropagation()
			ops.saveDraft(field)
		}
	}

	function remove() {
		if (value && !confirm(`Remove the ${label} section?`)) return
		ops.cancelDraft(field)
		ops.saveFields({ [field]: '' })
	}
</script>

<section class="pane-section text" class:editing={!!draft}>
	<div class="pane-section-head">
		<h3 class="pane-section-label">{label}</h3>
		{#if dirty}<span class="unsaved">Unsaved</span>{/if}
		<span class="push"></span>
		{#if !draft}
			<button class="pane-link" onclick={() => ops.startDraft(field)}><Icon name="edit" size={12} /> Edit</button>
		{/if}
		{#if removable}
			<button class="pane-link danger" aria-label="Remove {label}" title="Remove section" onclick={remove}><Icon name="close" size={12} /></button>
		{/if}
	</div>

	{#if draft}
		<textarea
			class="pane-textarea"
			aria-label={label}
			placeholder="Markdown supported"
			bind:value={draft.value}
			onkeydown={handleKey}
			use:focusOnMount
		></textarea>
		<div class="actions">
			<span class="pane-meta">⌘↵ to save</span>
			<span class="push"></span>
			<button class="btn btn-ghost btn-sm" onclick={() => ops.cancelDraft(field)}>Cancel</button>
			<button class="btn btn-primary btn-sm" disabled={!dirty} onclick={() => ops.saveDraft(field)}>Save</button>
		</div>
	{:else if value}
		<div class="body"><MarkdownContent content={value} /></div>
	{:else}
		<button class="empty" onclick={() => ops.startDraft(field)}>{placeholder}</button>
	{/if}
</section>

<style>
	.body {
		font-size: 0.875rem;
		line-height: 1.6;
		color: var(--text-primary);
		overflow-wrap: anywhere;
	}

	h3 { margin: 0; }

	.unsaved {
		font-size: 0.6875rem;
		font-weight: 600;
		color: var(--pane-warn);
	}

	.empty {
		padding: 0.5rem 0.625rem;
		border: 1px dashed var(--border-default);
		border-radius: var(--radius-sm);
		background: none;
		color: var(--text-secondary);
		font: inherit;
		font-size: 0.8125rem;
		text-align: left;
		cursor: text;
	}

	.empty:hover { border-color: var(--border-strong); color: var(--text-primary); }

	.actions {
		display: flex;
		align-items: center;
		gap: 0.375rem;
	}

	.push { flex: 1; }
</style>
