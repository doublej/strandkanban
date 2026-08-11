<script lang="ts">
	import type { Issue, TableColumnKey, Column } from '$lib/types';
	import {
		getIssueColumn,
		getPriorityConfig,
		getTypeIcon,
		getDueInfo,
		formatMinutes,
		formatTimestamp,
		calculateImpactScore,
		getImpactLevel,
		isAgentAssignee
	} from '$lib/utils';
	import { TYPE_OPTS, type TableEdit } from '$lib/stores/table-edit.svelte';
	import Icon from './Icon.svelte';

	interface Props {
		issue: Issue;
		colKey: TableColumnKey;
		width: number;
		num: boolean;
		statusColumns: Column[];
		edit: TableEdit;
	}

	let { issue, colKey, width, num, statusColumns, edit }: Props = $props();

	const PRIORITY_OPTS = [0, 1, 2, 3, 4].map((p) => ({ value: p, label: getPriorityConfig(p).label }));

	const editable = $derived(edit.isEditable(colKey));
	const editing = $derived(edit.isEditing(issue.id, colKey));
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="td"
	style="width: {width}px;"
	class:num
	class:editable
	class:editing
	ondblclick={(e) => editable && edit.onCellDblClick(e, issue, colKey)}
>
	{#if colKey === 'seq'}
		<span class="mono muted" title={issue.id}>#{issue.seq}</span>
	{:else if colKey === 'title'}
		{#if editing}
			<input
				type="text"
				class="edit-input"
				bind:value={edit.value}
				onkeydown={edit.onEditKeydown}
				onblur={edit.onEditBlur}
				autofocus
			/>
		{:else}
			<span class="cell-title">{issue.title}</span>
		{/if}
	{:else if colKey === 'status'}
		{#if editing}
			<select class="edit-select" bind:value={edit.value} onkeydown={edit.onEditKeydown} onblur={edit.onEditBlur} autofocus>
				{#each statusColumns as col (col.status)}
					<option value={col.status}>{col.label}</option>
				{/each}
			</select>
		{:else}
			{@const col = getIssueColumn(issue)}
			<span class="pill" style="--c: {col.accent};"><span class="dot"></span>{col.label}</span>
		{/if}
	{:else if colKey === 'priority'}
		{#if editing}
			<select class="edit-select" bind:value={edit.value} onkeydown={edit.onEditKeydown} onblur={edit.onEditBlur} autofocus>
				{#each PRIORITY_OPTS as p (p.value)}
					<option value={p.value}>{p.label}</option>
				{/each}
			</select>
		{:else}
			{@const p = getPriorityConfig(issue.priority)}
			<span class="pill" style="--c: {p.color};"><span class="dot"></span>{p.label}</span>
		{/if}
	{:else if colKey === 'type'}
		{#if editing}
			<select class="edit-select" bind:value={edit.value} onkeydown={edit.onEditKeydown} onblur={edit.onEditBlur} autofocus>
				{#each TYPE_OPTS as t (t)}
					<option value={t}>{t}</option>
				{/each}
			</select>
		{:else}
			<span class="type"><Icon name={getTypeIcon(issue.issue_type)} size={12} />{issue.issue_type}</span>
		{/if}
	{:else if colKey === 'assignee'}
		{#if editing}
			<input
				type="text"
				class="edit-input"
				bind:value={edit.value}
				onkeydown={edit.onEditKeydown}
				onblur={edit.onEditBlur}
				placeholder="Unassigned"
				autofocus
			/>
		{:else if issue.assignee}
			<span class="assignee" class:agent={isAgentAssignee(issue.assignee)}>{issue.assignee}</span>
		{:else}
			<span class="muted">—</span>
		{/if}
	{:else if colKey === 'labels'}
		{@const ls = issue.labels ?? []}
		{#if ls.length}
			<span class="tags">
				{#each ls.slice(0, 3) as l (l)}<span class="tag">{l}</span>{/each}
				{#if ls.length > 3}<span class="muted">+{ls.length - 3}</span>{/if}
			</span>
		{:else}
			<span class="muted">—</span>
		{/if}
	{:else if colKey === 'due'}
		{@const d = getDueInfo(issue.due_at)}
		{#if d}<span class="due {d.level}" title={d.absolute}>{d.label}</span>{:else}<span class="muted">—</span>{/if}
	{:else if colKey === 'estimate'}
		{@const m = formatMinutes(issue.estimated_minutes)}
		{#if m}<span class="mono">{m}</span>{:else}<span class="muted">—</span>{/if}
	{:else if colKey === 'dependents'}
		{@const n = issue.dependent_count ?? issue.dependents?.length ?? 0}
		{#if n > 0}<span class="mono">{n}</span>{:else}<span class="muted">—</span>{/if}
	{:else if colKey === 'impact'}
		{@const s = calculateImpactScore(issue)}
		<span class="mono" style="color: {getImpactLevel(s).color};">{s}</span>
	{:else if colKey === 'created'}
		{@const t = formatTimestamp(issue.created_at)}
		<span class="muted" title={t.absolute}>{t.relative}</span>
	{:else if colKey === 'updated'}
		{@const t = formatTimestamp(issue.updated_at)}
		<span class="muted" title={t.absolute}>{t.relative}</span>
	{/if}
</div>

<style>
	.td {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.5rem 0.75rem;
		font-size: 0.8125rem;
		color: var(--text-secondary);
		flex-shrink: 0;
		overflow: hidden;
	}
	.td.num {
		justify-content: flex-end;
	}
	.td.editable {
		cursor: default;
	}
	.td.editable:hover:not(.editing) {
		background: var(--bg-elevated);
	}
	.td.editing {
		padding: 0.25rem 0.375rem;
	}

	.edit-input,
	.edit-select {
		width: 100%;
		height: 1.75rem;
		padding: 0 0.5rem;
		background: var(--surface-panel);
		border: 1px solid var(--accent-primary);
		border-radius: var(--radius-xs);
		color: var(--text-primary);
		font-family: inherit;
		font-size: 0.8125rem;
		outline: none;
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent-primary) 20%, transparent);
	}
	.edit-input::placeholder {
		color: var(--text-muted);
	}
	.edit-select {
		cursor: pointer;
	}

	.cell-title {
		color: var(--text-primary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.mono {
		font-family: var(--font-mono);
		font-size: 0.75rem;
	}
	.muted {
		color: var(--text-muted);
	}

	.pill {
		display: inline-flex;
		align-items: center;
		gap: 0.3125rem;
		padding: 0.125rem 0.4375rem;
		border-radius: var(--radius-full);
		background: color-mix(in srgb, var(--c) 12%, transparent);
		color: var(--c);
		font-size: 0.6875rem;
		font-weight: 600;
		white-space: nowrap;
	}
	.pill .dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--c);
	}

	.type {
		display: inline-flex;
		align-items: center;
		gap: 0.3125rem;
		text-transform: capitalize;
	}
	.type :global(svg) {
		opacity: 0.7;
	}

	.assignee {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.assignee.agent {
		color: var(--accent-primary);
		font-family: var(--font-mono);
		font-size: 0.75rem;
	}

	.tags {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		overflow: hidden;
	}
	.tag {
		padding: 0.0625rem 0.3125rem;
		background: var(--bg-elevated);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-xs);
		font-size: 0.625rem;
		color: var(--text-tertiary);
		white-space: nowrap;
	}

	.due {
		font-size: 0.75rem;
		font-weight: 600;
	}
	.due.overdue {
		color: var(--state-blocked);
	}
	.due.soon {
		color: var(--state-in-progress);
	}
	.due.normal {
		color: var(--text-secondary);
	}
</style>
