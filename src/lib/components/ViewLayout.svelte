<script lang="ts">
	import type { Issue } from '$lib/types';
	import type { Pane } from '$lib/wsStore.svelte';
	import type { PageOps } from '$lib/stores/page-ops.svelte';
	import type { CardDrag } from '$lib/drag-drop/card-drag.svelte';
	import type { ViewState } from '$lib/stores/view-state.svelte';
	import type { BoardAnimation } from '$lib/stores/board-animation.svelte';
	import { getColumnsWithCustom } from '$lib/utils';
	import { settings } from '$lib/stores/settings.svelte';
	import BoardView from './BoardView.svelte';
	import DetailPanelHost from './DetailPanelHost.svelte';
	import SelectionGrid from './SelectionGrid.svelte';
	import TableView from './TableView.svelte';
	import FlowView from './flow/FlowView.svelte';
	import GridView from './GridView.svelte';

	interface Props {
		ops: PageOps;
		cardDrag: CardDrag;
		viewState: ViewState;
		issues: Issue[];
		filteredIssues: Issue[];
		orderedTableIssues: Issue[];
		activeAgents: string[];
		queuedTicketIds: Set<string>;
		animatingIds: Set<string>;
		selectedId: string | null;
		activeColumnIndex: number;
		tableSelectedIds: string[];
		isFilterPreviewing: boolean;
		projectTransition: 'idle' | 'wipe-out' | 'wipe-in';
		worktreeTicketIds: Set<string>;
		anim: BoardAnimation;
		managerSession: Pane | null;
		wsConnected: boolean;
		currentProjectPath: string;
		onbulkupdate: (ids: string[], updates: Partial<Issue>) => Promise<void>;
		onbulkdelete: (ids: string[]) => Promise<void>;
	}

	let {
		ops,
		cardDrag,
		viewState,
		issues,
		filteredIssues,
		orderedTableIssues,
		activeAgents,
		queuedTicketIds,
		animatingIds,
		selectedId,
		activeColumnIndex = $bindable(),
		tableSelectedIds = $bindable(),
		isFilterPreviewing,
		projectTransition,
		worktreeTicketIds,
		anim,
		managerSession,
		wsConnected,
		currentProjectPath,
		onbulkupdate,
		onbulkdelete
	}: Props = $props();

	const statusColumns = $derived(getColumnsWithCustom(issues));
	const tableSelectedIssues = $derived(orderedTableIssues.filter((i) => tableSelectedIds.includes(i.id)));
	// >1 rows selected shows a grid of blocks in the detail slot instead of one ticket.
	const showSelectionGrid = $derived(viewState.viewMode === 'table' && tableSelectedIds.length > 1);
</script>

{#if viewState.viewMode === 'kanban'}
	<BoardView
		{ops}
		{cardDrag}
		{viewState}
		{issues}
		{filteredIssues}
		{activeAgents}
		{queuedTicketIds}
		{animatingIds}
		{selectedId}
		bind:activeColumnIndex
		{isFilterPreviewing}
		{projectTransition}
		{worktreeTicketIds}
		{anim}
		{managerSession}
		{wsConnected}
		{currentProjectPath}
	/>
{:else if viewState.viewMode === 'table'}
	<div class="table-layout" class:wipe-out={projectTransition === 'wipe-out'} class:wipe-in={projectTransition === 'wipe-in'}>
		{#if showSelectionGrid}
			<SelectionGrid
				issues={tableSelectedIssues}
				onselect={(issue) => { tableSelectedIds = []; ops.openEditPanel(issue); }}
				ondeselect={(id) => tableSelectedIds = tableSelectedIds.filter((x) => x !== id)}
				onclear={() => tableSelectedIds = []}
			/>
		{:else if ops.panelOpen}
			<DetailPanelHost {ops} {cardDrag} {issues} {activeAgents} />
		{/if}
		<TableView
			issues={orderedTableIssues}
			columnConfig={settings.tableColumns}
			sort={settings.tableSort}
			{selectedId}
			selectedIds={tableSelectedIds}
			{statusColumns}
			onselect={(issue) => ops.openEditPanel(issue)}
			onselectionchange={(ids) => tableSelectedIds = ids}
			oncreate={ops.openCreatePanel}
			oncolumnschange={(cols) => { settings.tableColumns = cols; }}
			onsortchange={(s) => { settings.tableSort = s; }}
			onbulkupdate={onbulkupdate}
			onbulkdelete={onbulkdelete}
			onupdate={(id, updates) => ops.updateIssue(id, updates)}
		/>
	</div>
{:else if viewState.viewMode === 'flow'}
	<div class="flow-layout" class:wipe-out={projectTransition === 'wipe-out'} class:wipe-in={projectTransition === 'wipe-in'}>
		{#if ops.panelOpen}
			<DetailPanelHost {ops} {cardDrag} {issues} {activeAgents} />
		{/if}
		<FlowView
			issues={filteredIssues}
			{selectedId}
			isDark={viewState.isDarkMode}
			onselect={(issue) => ops.openEditPanel(issue)}
		/>
	</div>
{:else if viewState.viewMode === 'grid'}
	<div class="grid-layout" class:wipe-out={projectTransition === 'wipe-out'} class:wipe-in={projectTransition === 'wipe-in'}>
		{#if ops.panelOpen}
			<DetailPanelHost {ops} {cardDrag} {issues} {activeAgents} />
		{/if}
		<GridView
			issues={filteredIssues}
			{selectedId}
			isDark={viewState.isDarkMode}
			onselect={(issue) => ops.openEditPanel(issue)}
		/>
	</div>
{/if}

<style>
	.table-layout {
		display: flex;
		flex: 1;
		gap: 1rem;
		padding: 1.25rem;
		min-width: 0;
		min-height: 0;
		overflow: hidden;
	}

	/* Wider detail panel in table view — more room than the 420px kanban panel */
	.table-layout :global(.panel) {
		flex: 0 0 clamp(480px, 40%, 760px);
		min-width: 480px;
		max-width: 760px;
	}

	/* Multi-select grid occupies the same side slot as the detail panel */
	.table-layout :global(.selection-grid) {
		flex: 0 0 clamp(480px, 40%, 760px);
		min-width: 480px;
		max-width: 760px;
	}

	.flow-layout {
		display: flex;
		flex: 1;
		gap: 1rem;
		padding: 1.25rem;
		min-width: 0;
		min-height: 0;
		overflow: hidden;
	}

	.flow-layout :global(.panel) {
		flex: 0 0 clamp(420px, 34%, 620px);
		min-width: 420px;
		max-width: 620px;
	}

	.grid-layout {
		display: flex;
		flex: 1;
		gap: 1rem;
		padding: 1.25rem;
		min-width: 0;
		min-height: 0;
		overflow: hidden;
	}

	.grid-layout :global(.panel) {
		flex: 0 0 clamp(380px, 30%, 520px);
		min-width: 380px;
		max-width: 520px;
	}
</style>
