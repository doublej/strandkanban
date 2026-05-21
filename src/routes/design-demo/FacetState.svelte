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

	function setStatus(s: Issue['status']) { status = s; openPicker = null; }
	function setPriority(p: Issue['priority']) { priority = p; openPicker = null; }
	function setType(t: string) { issueType = t; openPicker = null; }
	function setAssignee(a: string) { assignee = a; openPicker = null; }
	function toggle(which: typeof openPicker) {
		openPicker = openPicker === which ? null : which;
	}
</script>

<section class="state" onclickoutside={() => (openPicker = null)}>
	<!-- Status -->
	<div class="cell" class:open={openPicker === 'status'}>
		<button class="prop status" style="--accent: {col.accent};" onclick={() => toggle('status')}>
			<Icon name={col.icon} size={11} />
			<span>{col.label}</span>
		</button>
		{#if openPicker === 'status'}
			<div class="picker">
				{#each columns as c}
					<button class="pick" onclick={() => setStatus(c.status)}>
						<Icon name={c.icon} size={11} />
						<span>{c.label}</span>
					</button>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Priority -->
	<div class="cell" class:open={openPicker === 'priority'}>
		<button class="prop" onclick={() => toggle('priority')}>
			<span class="dot" style="background: {pri.color};"></span>
			<span>{pri.label}</span>
		</button>
		{#if openPicker === 'priority'}
			<div class="picker">
				{#each priorities as { p, label }}
					<button class="pick" onclick={() => setPriority(p)}>
						<span class="dot" style="background: {getPriorityConfig(p).color};"></span>
						<span>{label}</span>
					</button>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Type -->
	<div class="cell" class:open={openPicker === 'type'}>
		<button class="prop" onclick={() => toggle('type')}>
			<Icon name={getTypeIcon(issueType)} size={11} />
			<span>{issueType}</span>
		</button>
		{#if openPicker === 'type'}
			<div class="picker">
				{#each types as t}
					<button class="pick" onclick={() => setType(t)}>
						<Icon name={getTypeIcon(t)} size={11} />
						<span>{t}</span>
					</button>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Assignee -->
	<div class="cell" class:open={openPicker === 'assignee'}>
		<button class="prop" class:agent={isAgent} onclick={() => toggle('assignee')}>
			<span class="dot" style="background: {isAgent ? 'var(--dd-agent)' : 'var(--dd-human)'};"></span>
			<span class="mono">{assignee || 'Unassigned'}</span>
		</button>
		{#if openPicker === 'assignee'}
			<div class="picker">
				<button class="pick" onclick={() => setAssignee('')}>
					<span class="dot empty"></span>
					<span>Unassigned</span>
				</button>
				{#each agents as a}
					<button class="pick" onclick={() => setAssignee(a)}>
						<span class="dot" style="background: {isAgentAssignee(a) ? 'var(--dd-agent)' : 'var(--dd-human)'};"></span>
						<span class="mono">{a}</span>
					</button>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Labels -->
	<div class="cell labels-cell">
		{#each labels as l (l)}
			<button class="label" onclick={() => (labels = labels.filter((x) => x !== l))} title="Remove label">
				<span>{l}</span>
			</button>
		{/each}
		<button class="add-label" onclick={() => (openPicker = openPicker === 'labels' ? null : 'labels')}>
			<Icon name="plus" size={10} />
			<span>label</span>
		</button>
		{#if openPicker === 'labels'}
			<div class="picker label-picker">
				{#each ['auth', 'frontend', 'backend', 'mobile', 'tech-debt', 'reports'] as l}
					{#if !labels.includes(l)}
						<button class="pick" onclick={() => { labels = [...labels, l]; openPicker = null; }}>
							<span class="dot empty"></span>
							<span>{l}</span>
						</button>
					{/if}
				{/each}
			</div>
		{/if}
	</div>
</section>

<style>
	.state {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px;
		position: relative;
	}

	.cell { position: relative; }

	.prop {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: 26px;
		padding: 0 10px;
		border-radius: var(--dd-r-2);
		background: transparent;
		color: var(--dd-fg-1);
		font-size: 12px;
		font-weight: 500;
		transition: background 80ms;
	}
	.prop:hover {
		background: var(--dd-bg-2);
	}
	.cell.open .prop {
		background: var(--dd-bg-3);
	}
	.prop.status {
		background: color-mix(in srgb, var(--accent) 12%, var(--dd-bg-1));
		color: var(--accent);
	}
	.prop.status:hover {
		background: color-mix(in srgb, var(--accent) 18%, var(--dd-bg-1));
	}

	.dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
	}
	.dot.empty {
		background: transparent;
		border: 1.5px dashed var(--dd-border-3);
	}

	.labels-cell {
		display: inline-flex;
		flex-wrap: wrap;
		gap: 4px;
		align-items: center;
		margin-left: 6px;
	}
	.label {
		display: inline-flex;
		align-items: center;
		padding: 4px 8px;
		height: 22px;
		font-size: 11px;
		text-transform: lowercase;
		color: var(--dd-fg-2);
		background: var(--dd-bg-2);
		border-radius: var(--dd-r-2);
		transition: background 80ms, color 80ms;
	}
	.label:hover {
		color: var(--dd-danger);
		background: color-mix(in srgb, var(--dd-danger) 10%, var(--dd-bg-2));
	}
	.add-label {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		height: 22px;
		padding: 0 7px;
		font-size: 11px;
		color: var(--dd-fg-4);
		border: 1px dashed var(--dd-border-2);
		border-radius: var(--dd-r-2);
		transition: color 80ms, border-color 80ms;
	}
	.add-label:hover {
		color: var(--dd-fg-2);
		border-color: var(--dd-border-3);
	}

	.picker {
		position: absolute;
		top: calc(100% + 4px);
		left: 0;
		min-width: 180px;
		background: var(--dd-bg-1);
		border: 1px solid var(--dd-border-2);
		border-radius: var(--dd-r-2);
		box-shadow: var(--dd-shadow-2);
		padding: 4px;
		z-index: 5;
		display: flex;
		flex-direction: column;
		gap: 1px;
	}
	.pick {
		display: flex;
		align-items: center;
		gap: 7px;
		padding: 6px 8px;
		border-radius: 3px;
		font-size: 12px;
		color: var(--dd-fg-1);
		text-align: left;
		text-transform: capitalize;
	}
	.pick:hover {
		background: var(--dd-bg-2);
	}
	.pick .mono {
		text-transform: none;
	}
	.label-picker {
		min-width: 160px;
	}
</style>
