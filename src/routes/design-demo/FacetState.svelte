<script lang="ts">
	import type { Issue } from '$lib/types';
	import { columns, getPriorityConfig, getTypeIcon, isAgentAssignee } from '$lib/utils';
	import { untrack } from 'svelte';
	import Icon from './Icon.svelte';

	type Props = { issue: Issue };
	let { issue }: Props = $props();

	let status = $state<Issue['status']>(untrack(() => issue.status));
	let priority = $state<Issue['priority']>(untrack(() => issue.priority));
	let issueType = $state(untrack(() => issue.issue_type));
	let assignee = $state(untrack(() => issue.assignee ?? ''));
	let labels = $state<string[]>(untrack(() => [...(issue.labels ?? [])]));

	let openPicker = $state<'status' | 'priority' | 'type' | 'assignee' | 'labels' | null>(null);

	const col = $derived(columns.find((c) => c.status === status)!);
	const pri = $derived(getPriorityConfig(priority));
	const isAgent = $derived(isAgentAssignee(assignee));

	const types = ['task', 'bug', 'feature', 'epic', 'chore'] as const;
	const priorities: Array<{ p: Issue['priority']; label: string }> = [
		{ p: 0, label: 'P0 · Critical' },
		{ p: 1, label: 'P1 · High' },
		{ p: 2, label: 'P2 · Medium' },
		{ p: 3, label: 'P3 · Low' },
		{ p: 4, label: 'P4 · Backlog' }
	];
	const agents = ['agent-claude-1', 'agent-claude-2', 'agent-claude-3', 'jurre'];
	const labelOptions = ['auth', 'frontend', 'backend', 'mobile', 'tech-debt', 'reports'];

	function toggle(which: typeof openPicker) { openPicker = openPicker === which ? null : which; }
</script>

<div class="row">
	<!-- Status -->
	<div class="cell">
		<button class="ctrl" class:is-active={openPicker === 'status'} style="--st: {col.accent};" onclick={() => toggle('status')}>
			<Icon name={col.icon} size={12} />
			<span style="color: var(--st);">{col.label}</span>
		</button>
		{#if openPicker === 'status'}
			<div class="picker">
				{#each columns as c}
					<button class="ctrl picker-item" onclick={() => { status = c.status; openPicker = null; }}>
						<Icon name={c.icon} size={12} />
						<span>{c.label}</span>
					</button>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Priority -->
	<div class="cell">
		<button class="ctrl" class:is-active={openPicker === 'priority'} onclick={() => toggle('priority')}>
			<span class="dot" style="background: {pri.color};"></span>
			<span>{pri.label}</span>
		</button>
		{#if openPicker === 'priority'}
			<div class="picker">
				{#each priorities as { p, label }}
					<button class="ctrl picker-item" onclick={() => { priority = p; openPicker = null; }}>
						<span class="dot" style="background: {getPriorityConfig(p).color};"></span>
						<span>{label}</span>
					</button>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Type -->
	<div class="cell">
		<button class="ctrl" class:is-active={openPicker === 'type'} onclick={() => toggle('type')}>
			<Icon name={getTypeIcon(issueType)} size={12} />
			<span class="cap">{issueType}</span>
		</button>
		{#if openPicker === 'type'}
			<div class="picker">
				{#each types as t}
					<button class="ctrl picker-item" onclick={() => { issueType = t; openPicker = null; }}>
						<Icon name={getTypeIcon(t)} size={12} />
						<span class="cap">{t}</span>
					</button>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Assignee -->
	<div class="cell">
		<button class="ctrl" class:is-active={openPicker === 'assignee'} onclick={() => toggle('assignee')}>
			<span class="dot" style="background: {assignee ? (isAgent ? 'var(--agent)' : 'var(--human)') : 'transparent'};" class:is-ring={!assignee} style:color="var(--line-3)"></span>
			<span class="mono">{assignee || 'Unassigned'}</span>
		</button>
		{#if openPicker === 'assignee'}
			<div class="picker">
				<button class="ctrl picker-item" onclick={() => { assignee = ''; openPicker = null; }}>
					<span class="dot is-ring" style="color: var(--line-3);"></span>
					<span>Unassigned</span>
				</button>
				{#each agents as a}
					<button class="ctrl picker-item" onclick={() => { assignee = a; openPicker = null; }}>
						<span class="dot" style="background: {isAgentAssignee(a) ? 'var(--agent)' : 'var(--human)'};"></span>
						<span class="mono">{a}</span>
					</button>
				{/each}
			</div>
		{/if}
	</div>
</div>

<div class="row labels-row">
	{#each labels as l (l)}
		<button class="ctrl is-sm chip" onclick={() => (labels = labels.filter((x) => x !== l))} title="Remove">
			<span>{l}</span>
		</button>
	{/each}
	<div class="cell">
		<button class="ctrl is-sm ghost" onclick={() => toggle('labels')}>
			<Icon name="plus" size={12} />
			<span>label</span>
		</button>
		{#if openPicker === 'labels'}
			<div class="picker">
				{#each labelOptions as l}
					{#if !labels.includes(l)}
						<button class="ctrl picker-item" onclick={() => { labels = [...labels, l]; openPicker = null; }}>
							<span class="dot is-ring" style="color: var(--line-3);"></span>
							<span>{l}</span>
						</button>
					{/if}
				{/each}
			</div>
		{/if}
	</div>
</div>

<style>
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-1);
		align-items: center;
	}
	.labels-row {
		min-height: var(--ctrl-md);
	}
	.cell { position: relative; }

	.cap { text-transform: capitalize; }

	.chip {
		background: var(--surf-2);
		color: var(--ink-2);
	}
	.chip:hover {
		background: color-mix(in srgb, var(--danger) 12%, var(--surf-2));
		color: var(--danger);
	}

	.ghost {
		color: var(--ink-4);
		border: 1px dashed var(--line-2);
	}
	.ghost:hover {
		color: var(--ink-2);
		border-color: var(--line-3);
		background: transparent;
	}

	.picker {
		position: absolute;
		top: calc(100% + var(--sp-1));
		left: 0;
		min-width: 200px;
		background: var(--surf-1);
		border: 1px solid var(--line-2);
		border-radius: var(--r-sm);
		box-shadow: var(--shadow-2);
		padding: var(--sp-1);
		z-index: 5;
		display: flex;
		flex-direction: column;
	}
	.picker-item {
		justify-content: flex-start;
		width: 100%;
		text-align: left;
	}
	.picker-item:hover {
		background: var(--surf-2);
	}
</style>
