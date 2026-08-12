<script lang="ts">
	import type { Pane, SlashCommandInfo, ChatImage } from '$lib/wsStore.svelte';

	interface Props {
		pane: Pane;
		messageInput: string;
		disabled: boolean;
		inputRef: HTMLInputElement | null;
		onSendMessage: (name: string, message: string, images?: ChatImage[]) => void;
		onInputChange: (value: string) => void;
		onInterrupt?: (name: string) => void;
	}

	let {
		pane,
		messageInput = $bindable(),
		disabled,
		inputRef = $bindable(),
		onSendMessage,
		onInputChange,
		onInterrupt
	}: Props = $props();

	let slashMenuOpen = $state(false);
	let slashMenuIndex = $state(0);
	let attachedImages = $state<ChatImage[]>([]);
	let isDraggingOver = $state(false);

	const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
	const MAX_IMAGE_SIZE = 20 * 1024 * 1024; // 20MB

	async function fileToBase64(file: File): Promise<ChatImage | null> {
		if (!SUPPORTED_IMAGE_TYPES.includes(file.type)) {
			console.warn('Unsupported image type:', file.type);
			return null;
		}
		if (file.size > MAX_IMAGE_SIZE) {
			console.warn('Image too large:', file.size);
			return null;
		}
		return new Promise((resolve) => {
			const reader = new FileReader();
			reader.onload = () => {
				const result = reader.result as string;
				const base64 = result.split(',')[1];
				resolve({ mediaType: file.type, data: base64 });
			};
			reader.onerror = () => resolve(null);
			reader.readAsDataURL(file);
		});
	}

	async function handlePaste(e: ClipboardEvent) {
		const items = e.clipboardData?.items;
		if (!items) return;

		for (const item of items) {
			if (item.type.startsWith('image/')) {
				e.preventDefault();
				const file = item.getAsFile();
				if (file) {
					const img = await fileToBase64(file);
					if (img) attachedImages = [...attachedImages, img];
				}
				return;
			}
		}
	}

	async function handleDrop(e: DragEvent) {
		e.preventDefault();
		isDraggingOver = false;

		const files = e.dataTransfer?.files;
		if (!files) return;

		for (const file of files) {
			if (file.type.startsWith('image/')) {
				const img = await fileToBase64(file);
				if (img) attachedImages = [...attachedImages, img];
			}
		}
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		isDraggingOver = true;
	}

	function handleDragLeave(e: DragEvent) {
		e.preventDefault();
		isDraggingOver = false;
	}

	function removeImage(index: number) {
		attachedImages = attachedImages.filter((_, i) => i !== index);
	}

	function getFilteredSlashCommands(): SlashCommandInfo[] {
		const commands = pane.slashCommands || [];
		if (!messageInput.startsWith('/')) return [];
		const query = messageInput.slice(1).toLowerCase();
		return commands.filter(cmd => {
			const name = cmd.name.toLowerCase();
			return name.startsWith(query) || name.includes(query) ||
				cmd.description.toLowerCase().includes(query);
		});
	}

	function handleSubmit(e: Event) {
		e.preventDefault();
		slashMenuOpen = false;
		const hasImages = attachedImages.length > 0;
		const hasText = messageInput?.trim();
		if (hasText || hasImages) {
			onSendMessage(pane.name, messageInput?.trim() || '', hasImages ? attachedImages : undefined);
			onInputChange('');
			attachedImages = [];
		}
	}

	function handleChange(value: string) {
		onInputChange(value);
		if (value.startsWith('/') && value.length >= 1) {
			slashMenuOpen = true;
			slashMenuIndex = 0;
		} else {
			slashMenuOpen = false;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			if (slashMenuOpen) {
				slashMenuOpen = false;
			} else if (pane.streaming && onInterrupt) {
				e.preventDefault();
				onInterrupt(pane.name);
			}
			return;
		}

		if (!slashMenuOpen) return;
		const filtered = getFilteredSlashCommands();
		if (filtered.length === 0) return;

		if (e.key === 'ArrowDown') {
			e.preventDefault();
			slashMenuIndex = (slashMenuIndex + 1) % filtered.length;
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			slashMenuIndex = (slashMenuIndex - 1 + filtered.length) % filtered.length;
		} else if (e.key === 'Tab' || e.key === 'Enter') {
			if (filtered.length > 0) {
				e.preventDefault();
				const cmd = filtered[slashMenuIndex];
				onInputChange('/' + cmd.name + ' ');
				slashMenuOpen = false;
			}
		}
	}

	function selectSlashCommand(command: string) {
		onInputChange(command + ' ');
		slashMenuOpen = false;
		inputRef?.focus();
	}
</script>

<form
	class="input-area"
	class:dragging={isDraggingOver}
	onsubmit={handleSubmit}
	ondragover={handleDragOver}
	ondragleave={handleDragLeave}
	ondrop={handleDrop}
>
	{#if attachedImages.length > 0}
		<div class="image-preview-row">
			{#each attachedImages as img, i}
				<div class="image-preview">
					<img src="data:{img.mediaType};base64,{img.data}" alt="Attached" />
					<button type="button" class="remove-btn" onclick={() => removeImage(i)}>×</button>
				</div>
			{/each}
		</div>
	{/if}
	<div class="input-row">
		<div class="input-wrapper">
			<input
				type="text"
				bind:this={inputRef}
				value={messageInput || ''}
				oninput={(e) => handleChange(e.currentTarget.value)}
				onkeydown={handleKeydown}
				onpaste={handlePaste}
				onblur={() => setTimeout(() => { slashMenuOpen = false; }, 150)}
				placeholder={pane.error ? "Session error - cannot send messages" : disabled ? "connecting..." : pane.slashCommands?.length ? "/ for commands, paste or drop images" : "paste or drop images"}
				class="msg-input"
				class:error={pane.error}
				disabled={disabled || pane.error}
			/>
		{#if slashMenuOpen}
			{@const filtered = getFilteredSlashCommands()}
			{#if filtered.length > 0}
				<div class="slash-menu">
					{#each filtered.slice(0, 8) as cmd, i}
						<button
							type="button"
							class="slash-item"
							class:selected={i === slashMenuIndex}
							onmousedown={() => selectSlashCommand('/' + cmd.name)}
						>
							<span class="slash-cmd">/{cmd.name}</span>
							{#if cmd.argumentHint}
								<span class="slash-hint">{cmd.argumentHint}</span>
							{/if}
							{#if cmd.description}
								<span class="slash-desc">{cmd.description}</span>
							{/if}
						</button>
					{/each}
				</div>
			{/if}
		{/if}
		</div>
		<button type="submit" class="send-btn" class:error={pane.error} disabled={disabled || (!messageInput?.trim() && attachedImages.length === 0) || pane.error}>
			{#if disabled}
				<span class="spinner"></span>
			{:else}
				&#8629;
			{/if}
		</button>
	</div>
</form>

<style>
	.input-area {
		display: flex;
		flex-direction: column;
		background: rgba(0, 0, 0, 0.15);
		border-top: 1px solid rgba(255, 255, 255, 0.04);
		flex-shrink: 0;
		transition: background 100ms ease;
	}

	.input-area.dragging {
		background: rgba(99, 102, 241, 0.1);
		border-top-color: rgba(99, 102, 241, 0.3);
	}

	:global(.app.light) .input-area {
		background: rgba(0, 0, 0, 0.03);
		border-top-color: rgba(0, 0, 0, 0.06);
	}

	:global(.app.light) .input-area.dragging {
		background: rgba(99, 102, 241, 0.08);
	}

	.image-preview-row {
		display: flex;
		gap: 0.375rem;
		padding: 0.375rem 0.375rem 0;
		overflow-x: auto;
	}

	.image-preview {
		position: relative;
		flex-shrink: 0;
		width: 48px;
		height: 48px;
		border-radius: 4px;
		overflow: hidden;
		border: 1px solid rgba(255, 255, 255, 0.1);
	}

	.image-preview img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.image-preview .remove-btn {
		position: absolute;
		top: 2px;
		right: 2px;
		width: 16px;
		height: 16px;
		padding: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.7);
		border: none;
		border-radius: 50%;
		color: white;
		font-size: 12px;
		line-height: 1;
		cursor: pointer;
		opacity: 0;
		transition: opacity 100ms ease;
	}

	.image-preview:hover .remove-btn {
		opacity: 1;
	}

	:global(.app.light) .image-preview {
		border-color: rgba(0, 0, 0, 0.1);
	}

	:global(.app.light) .image-preview .remove-btn {
		background: rgba(0, 0, 0, 0.6);
	}

	.input-row {
		display: flex;
		gap: 0.25rem;
		padding: 0.375rem;
		flex-shrink: 0;
	}

	.input-wrapper { position: relative; flex: 1; display: flex; }
	.input-wrapper .msg-input { flex: 1; width: 100%; }

	.slash-menu {
		position: absolute;
		bottom: 100%;
		left: 0; right: 0;
		margin-bottom: 4px;
		background: var(--bg-secondary, #1a1a1e);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 6px;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
		overflow: hidden;
		animation: slashMenuIn 100ms ease;
		z-index: 100;
	}

	@keyframes slashMenuIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }

	.slash-item {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 6px 10px;
		background: transparent;
		border: none;
		font: 11px/1 'IBM Plex Mono', ui-monospace, monospace;
		color: var(--text-primary);
		cursor: pointer;
		text-align: left;
		transition: background 60ms ease;
	}

	.slash-item:hover, .slash-item.selected { background: rgba(99, 102, 241, 0.15); }

	.slash-cmd { color: #6366f1; font-weight: 500; flex-shrink: 0; }
	.slash-hint { color: var(--text-tertiary, #666); font-size: 10px; flex-shrink: 0; }
	.slash-desc {
		color: var(--text-secondary, #888);
		font-size: 10px;
		white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
		flex: 1; text-align: right;
	}

	:global(.app.light) .slash-menu { background: var(--surface-elevated); border-color: var(--border-default); box-shadow: var(--shadow-lg); }
	:global(.app.light) .slash-item:hover, :global(.app.light) .slash-item.selected { background: rgba(99, 102, 241, 0.1); }

	.msg-input {
		flex: 1;
		padding: 0.375rem 0.5rem;
		font: 11px/1.2 'IBM Plex Mono', ui-monospace, monospace;
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid transparent;
		border-radius: 4px;
		color: var(--text-primary);
		transition: all 100ms ease;
	}

	.msg-input:focus { outline: none; background: rgba(255, 255, 255, 0.1); border-color: rgba(99, 102, 241, 0.4); }
	.msg-input::placeholder { color: var(--text-tertiary); opacity: 0.6; }
	.msg-input:disabled { opacity: 0.5; cursor: not-allowed; }

	.msg-input.error {
		background: rgba(239, 68, 68, 0.05);
		border-color: rgba(239, 68, 68, 0.3);
		cursor: not-allowed;
	}

	.msg-input.error::placeholder {
		color: rgba(239, 68, 68, 0.6);
	}

	:global(.app.light) .msg-input { background: rgba(0, 0, 0, 0.04); }
	:global(.app.light) .msg-input:focus { background: rgba(0, 0, 0, 0.06); }

	.send-btn {
		width: 28px; height: 28px;
		display: flex; align-items: center; justify-content: center;
		background: rgba(99, 102, 241, 0.9);
		border: none; border-radius: 4px;
		color: white; font: 600 12px/1 system-ui;
		cursor: pointer; transition: all 100ms ease; flex-shrink: 0;
	}

	.send-btn:hover:not(:disabled) { background: #6366f1; }
	.send-btn:active:not(:disabled) { transform: scale(0.95); }
	.send-btn:disabled { background: rgba(255, 255, 255, 0.08); color: var(--text-tertiary); cursor: default; }

	.send-btn.error {
		background: rgba(239, 68, 68, 0.1);
		color: rgba(239, 68, 68, 0.5);
		cursor: not-allowed;
	}

	:global(.app.light) .send-btn:disabled { background: rgba(0, 0, 0, 0.06); }

	.spinner {
		width: 10px; height: 10px;
		border: 1.5px solid currentColor;
		border-top-color: transparent;
		border-radius: 50%;
		animation: spin 0.6s linear infinite;
	}

	@keyframes spin { to { transform: rotate(360deg); } }

	@media (max-width: 768px) {
		.input-row { padding: 0.5rem; }
		.msg-input { padding: 0.5rem 0.625rem; font-size: 13px; }
		.send-btn { width: 36px; height: 36px; }
	}
</style>
