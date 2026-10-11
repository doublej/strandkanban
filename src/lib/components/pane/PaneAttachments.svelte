<script lang="ts">
	import type { PageOps } from '$lib/stores/page-ops.svelte'
	import { attachmentUrl } from '$lib/api'
	import { formatTimestamp } from '$lib/utils'
	import Icon from '../Icon.svelte'
	import TheatreViewer from '../TheatreViewer.svelte'

	interface Props {
		ops: PageOps
		issueId: string
	}

	let { ops, issueId }: Props = $props()

	let fileInput: HTMLInputElement
	let dragOver = $state(false)
	let theatreIndex = $state<number | null>(null)

	const images = $derived(ops.attachments.filter((a) => a.mimetype.startsWith('image/')))
	const files = $derived(ops.attachments.filter((a) => !a.mimetype.startsWith('image/')))

	function formatSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
	}

	function upload(file: File | undefined) {
		if (file) ops.handleUploadAttachment(file)
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault()
		dragOver = false
		upload(e.dataTransfer?.files[0]) // only the first file of a multi-file drop
	}

	function remove(filename: string) {
		if (confirm(`Delete ${filename}?`)) ops.handleDeleteAttachment(filename)
	}
</script>

<section
	class="pane-section"
	class:drag-over={dragOver}
	aria-label="Attachments"
	ondragover={(e) => { e.preventDefault(); dragOver = true }}
	ondragleave={() => (dragOver = false)}
	ondrop={handleDrop}
>
	<div class="pane-section-head">
		<h3 class="pane-section-label">Attachments</h3>
		{#if ops.attachments.length > 0}<span class="count">{ops.attachments.length}</span>{/if}
		{#if ops.loadingAttachments}<span class="pane-meta">Loading…</span>{/if}
		<span class="push"></span>
		<button class="pane-link" onclick={() => fileInput.click()}><Icon name="plus" size={12} /> Attach</button>
		<input
			type="file"
			hidden
			bind:this={fileInput}
			onchange={(e) => { upload(e.currentTarget.files?.[0]); e.currentTarget.value = '' }}
		/>
	</div>

	{#if images.length > 0}
		<div class="thumbs">
			{#each images as img, i (img.filename)}
				<figure>
					<button
						class="thumb"
						aria-label="View {img.filename}"
						title="{img.filename} · {formatSize(img.size)} · {formatTimestamp(img.created_at).relative}"
						onclick={() => (theatreIndex = i)}
					>
						<img src={attachmentUrl(issueId, img.filename)} alt={img.filename} loading="lazy" />
					</button>
					<button class="pane-icon-btn rm" aria-label="Delete {img.filename}" onclick={() => remove(img.filename)}>
						<Icon name="trash" size={12} />
					</button>
				</figure>
			{/each}
		</div>
	{/if}

	{#each files as f (f.filename)}
		<div class="file">
			<Icon name="file" size={14} />
			<a href={attachmentUrl(issueId, f.filename)} download={f.filename}>{f.filename}</a>
			<span class="pane-meta" title={formatTimestamp(f.created_at).absolute}>{formatSize(f.size)} · {formatTimestamp(f.created_at).relative}</span>
			<button class="pane-icon-btn" aria-label="Delete {f.filename}" onclick={() => remove(f.filename)}><Icon name="trash" size={12} /></button>
		</div>
	{/each}

	{#if ops.attachments.length === 0 && !ops.loadingAttachments}
		<p class="pane-empty">Drop a file here or paste an image.</p>
	{/if}
</section>

{#if theatreIndex !== null}
	<TheatreViewer {issueId} attachments={images} initialIndex={theatreIndex} onclose={() => (theatreIndex = null)} />
{/if}

<style>
	h3 { margin: 0; }
	p { margin: 0; }
	.push { flex: 1; }

	section {
		margin: -0.5rem;
		padding: 0.5rem;
		border: 1px dashed transparent;
		border-radius: var(--radius-sm);
	}

	section.drag-over { border-color: var(--accent-primary); background: var(--accent-glow); }

	.thumbs {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(5.5rem, 1fr));
		gap: 0.5rem;
	}

	figure { position: relative; margin: 0; }

	.thumb {
		display: block;
		width: 100%;
		aspect-ratio: 1;
		padding: 0;
		overflow: hidden;
		border: 1px solid var(--border-default);
		border-radius: var(--radius-sm);
		background: var(--surface-card);
		cursor: zoom-in;
	}

	.thumb img { width: 100%; height: 100%; object-fit: cover; }

	.rm {
		position: absolute;
		top: 0.25rem;
		right: 0.25rem;
		width: 1.5rem;
		height: 1.5rem;
		background: rgba(0, 0, 0, 0.55);
		color: #fff;
		opacity: 0;
	}

	figure:hover .rm,
	.rm:focus-visible { opacity: 1; }

	.file {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.8125rem;
		color: var(--text-secondary);
	}

	.file a {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--text-primary);
	}
</style>
