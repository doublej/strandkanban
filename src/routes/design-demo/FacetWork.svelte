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
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			editingTitle = false;
		} else if (e.key === 'Escape') {
			editingTitle = false;
		}
	}
</script>

<section class="work">
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
		<h1 class="title" onclick={startTitle} role="button" tabindex="0">
			{title}
		</h1>
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
</section>

<style>
	.work {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.title {
		margin: 0;
		font-size: 22px;
		font-weight: 600;
		line-height: 1.22;
		letter-spacing: -0.022em;
		color: var(--dd-fg-1);
		cursor: text;
		border-radius: var(--dd-r-2);
		padding: 2px 4px;
		margin-left: -4px;
		transition: background 80ms;
	}
	.title:hover {
		background: var(--dd-bg-2);
	}
	.title-input {
		font-size: 22px;
		font-weight: 600;
		line-height: 1.22;
		letter-spacing: -0.022em;
		resize: vertical;
		min-height: 50px;
		padding: 2px 4px;
		margin-left: -4px;
		background: transparent;
		border-color: var(--dd-accent);
	}

	.desc {
		margin: 0;
		font-size: 13.5px;
		line-height: 1.65;
		color: var(--dd-fg-2);
		white-space: pre-wrap;
		cursor: text;
		padding: 4px;
		margin-left: -4px;
		border-radius: var(--dd-r-2);
		transition: background 80ms;
	}
	.desc:hover {
		background: var(--dd-bg-2);
	}

	.desc-input {
		font-size: 13.5px;
		line-height: 1.65;
		resize: vertical;
		min-height: 110px;
		padding: 4px;
		margin-left: -4px;
		background: transparent;
		border-color: var(--dd-accent);
	}

	.desc-empty {
		text-align: left;
		font-size: 13px;
		color: var(--dd-fg-4);
		padding: 4px;
		margin-left: -4px;
		border-radius: var(--dd-r-2);
		transition: background 80ms, color 80ms;
	}
	.desc-empty:hover {
		background: var(--dd-bg-2);
		color: var(--dd-fg-3);
	}
</style>
