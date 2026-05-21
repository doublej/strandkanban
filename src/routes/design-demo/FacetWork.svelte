<script lang="ts">
	import type { Issue } from '$lib/types';
	import { untrack, tick } from 'svelte';

	type Props = { issue: Issue };
	let { issue }: Props = $props();

	let title = $state(untrack(() => issue.title));
	let description = $state(untrack(() => issue.description));
	let editingTitle = $state(false);
	let editingDesc = $state(false);
	let titleEl: HTMLTextAreaElement;
	let descEl: HTMLTextAreaElement;

	async function startTitle() {
		editingTitle = true;
		await tick();
		titleEl?.focus();
		titleEl?.setSelectionRange(title.length, title.length);
	}
	async function startDesc() {
		editingDesc = true;
		await tick();
		descEl?.focus();
	}
	function endTitle(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); editingTitle = false; }
		else if (e.key === 'Escape') editingTitle = false;
	}
</script>

{#if editingTitle}
	<textarea
		bind:this={titleEl}
		class="title-input"
		bind:value={title}
		rows="2"
		onblur={() => (editingTitle = false)}
		onkeydown={endTitle}
	></textarea>
{:else}
	<h1 class="title" onclick={startTitle} role="button" tabindex="0">{title}</h1>
{/if}

{#if editingDesc}
	<textarea
		bind:this={descEl}
		class="desc-input"
		bind:value={description}
		rows="6"
		placeholder="Describe the work…"
		onblur={() => (editingDesc = false)}
	></textarea>
{:else if description}
	<p class="desc" onclick={startDesc} role="button" tabindex="0">{description}</p>
{:else}
	<button class="desc-empty" onclick={startDesc}>Add a description…</button>
{/if}

<style>
	.title {
		margin: 0;
		font-size: var(--fs-xxl);
		font-weight: 600;
		line-height: var(--lh-tight);
		letter-spacing: -0.022em;
		color: var(--ink-1);
		cursor: text;
		border-radius: var(--r-sm);
		padding: var(--sp-1) var(--sp-1);
		margin-left: calc(var(--sp-1) * -1);
		transition: background 80ms;
	}
	.title:hover { background: var(--surf-2); }

	.title-input {
		font-size: var(--fs-xxl);
		font-weight: 600;
		line-height: var(--lh-tight);
		letter-spacing: -0.022em;
		resize: vertical;
		min-height: calc(var(--fs-xxl) * 2);
		padding: var(--sp-1);
		margin-left: calc(var(--sp-1) * -1);
		background: transparent;
		border-color: var(--accent);
	}

	.desc {
		margin: 0;
		font-size: var(--fs-md);
		line-height: var(--lh-prose);
		color: var(--ink-2);
		white-space: pre-wrap;
		cursor: text;
		padding: var(--sp-1);
		margin-left: calc(var(--sp-1) * -1);
		border-radius: var(--r-sm);
		transition: background 80ms;
	}
	.desc:hover { background: var(--surf-2); }

	.desc-input {
		font-size: var(--fs-md);
		line-height: var(--lh-prose);
		resize: vertical;
		min-height: calc(var(--fs-md) * 6);
		padding: var(--sp-1);
		margin-left: calc(var(--sp-1) * -1);
		background: transparent;
		border-color: var(--accent);
	}

	.desc-empty {
		text-align: left;
		font-size: var(--fs-sm);
		color: var(--ink-4);
		padding: var(--sp-1);
		margin-left: calc(var(--sp-1) * -1);
		border-radius: var(--r-sm);
		transition: background 80ms, color 80ms;
	}
	.desc-empty:hover { background: var(--surf-2); color: var(--ink-3); }
</style>
