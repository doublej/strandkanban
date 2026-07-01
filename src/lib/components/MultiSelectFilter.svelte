<script lang="ts">
	interface Props {
		options: string[];
		selected: string[];
		placeholder?: string;
		/** Display transform for an option/chip (raw value is used for matching). */
		formatOption?: (value: string) => string;
		onchange: (next: string[]) => void;
	}

	let { options, selected, placeholder = 'Add…', formatOption, onchange }: Props = $props();

	let query = $state('');
	let open = $state(false);
	let highlight = $state(0);
	let inputEl: HTMLInputElement | undefined = $state();

	const display = (v: string) => (formatOption ? formatOption(v) : v);

	const available = $derived.by(() => {
		const q = query.trim().toLowerCase();
		return options
			.filter((o) => !selected.includes(o))
			.filter((o) => !q || o.toLowerCase().includes(q) || display(o).toLowerCase().includes(q))
			.slice(0, 50);
	});

	function add(v: string) {
		if (!selected.includes(v)) onchange([...selected, v]);
		query = '';
		highlight = 0;
	}

	function remove(v: string) {
		onchange(selected.filter((s) => s !== v));
	}

	function handleKeydown(e: KeyboardEvent) {
		const list = available;
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			open = true;
			highlight = Math.min(highlight + 1, list.length - 1);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			highlight = Math.max(highlight - 1, 0);
		} else if (e.key === 'Enter') {
			e.preventDefault();
			if (list[highlight]) add(list[highlight]);
		} else if (e.key === 'Escape') {
			open = false;
			inputEl?.blur();
		} else if (e.key === 'Backspace' && query === '' && selected.length > 0) {
			remove(selected[selected.length - 1]);
		}
	}

	function handleBlur(e: FocusEvent) {
		setTimeout(() => {
			const related = e.relatedTarget as HTMLElement | null;
			if (!related?.closest('.msf-dropdown')) open = false;
		}, 150);
	}

	$effect(() => {
		query;
		highlight = 0;
	});
</script>

<div class="msf">
	<div class="msf-control" class:has-selection={selected.length > 0}>
		{#each selected as s (s)}
			<span class="msf-chip">
				<span class="msf-chip-text">{display(s)}</span>
				<button class="msf-chip-remove" onclick={() => remove(s)} title="Remove" aria-label="Remove {display(s)}">×</button>
			</span>
		{/each}
		<input
			bind:this={inputEl}
			bind:value={query}
			class="msf-input"
			type="text"
			placeholder={selected.length ? '' : placeholder}
			onfocus={() => (open = true)}
			onblur={handleBlur}
			onkeydown={handleKeydown}
		/>
	</div>
	{#if open && available.length > 0}
		<div class="msf-dropdown">
			{#each available as o, i (o)}
				<button
					class="msf-option"
					class:highlight={i === highlight}
					onmouseenter={() => (highlight = i)}
					onclick={() => add(o)}
				>
					{display(o)}
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.msf {
		position: relative;
	}

	.msf-control {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.25rem;
		padding: 0.25rem;
		min-height: 1.9rem;
		background: var(--bg-elevated);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		transition: border-color var(--transition-fast);
	}

	.msf-control:focus-within {
		border-color: var(--accent-primary);
	}

	.msf-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.0625rem 0.125rem 0.0625rem 0.375rem;
		background: var(--accent-glow);
		border: 1px solid color-mix(in srgb, var(--accent-primary) 30%, transparent);
		border-radius: var(--radius-xs);
		color: var(--text-primary);
		font-size: 0.6875rem;
		font-weight: 500;
		max-width: 100%;
	}

	.msf-chip-text {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.msf-chip-remove {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1rem;
		height: 1rem;
		padding: 0;
		background: transparent;
		border: none;
		border-radius: var(--radius-xs);
		color: var(--text-tertiary);
		font-size: 0.875rem;
		line-height: 1;
		cursor: pointer;
	}

	.msf-chip-remove:hover {
		color: var(--text-primary);
		background: rgba(255, 255, 255, 0.08);
	}

	.msf-input {
		flex: 1;
		min-width: 4rem;
		padding: 0.125rem 0.25rem;
		background: transparent;
		border: none;
		outline: none;
		color: var(--text-primary);
		font-family: inherit;
		font-size: 0.75rem;
	}

	.msf-input::placeholder {
		color: var(--text-tertiary);
	}

	.msf-dropdown {
		position: absolute;
		top: calc(100% + 0.25rem);
		left: 0;
		right: 0;
		max-height: 220px;
		overflow-y: auto;
		background: var(--bg-secondary);
		border: 1px solid var(--border-default);
		border-radius: var(--radius-sm);
		box-shadow: var(--shadow-lg);
		z-index: 200;
		padding: 0.25rem;
	}

	.msf-option {
		display: block;
		width: 100%;
		padding: 0.375rem 0.5rem;
		text-align: left;
		background: transparent;
		border: none;
		border-radius: var(--radius-xs);
		color: var(--text-secondary);
		font-family: inherit;
		font-size: 0.75rem;
		cursor: pointer;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.msf-option:hover,
	.msf-option.highlight {
		background: var(--accent-glow);
		color: var(--text-primary);
	}
</style>
