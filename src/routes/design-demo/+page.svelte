<script lang="ts">
	import { columns } from '$lib/utils';
	import { demoIssues, pinnedIds, worktreeIds, impactScores } from './fixtures';
	import TaskCard from './TaskCard.svelte';
	import NewIssuePane from './NewIssuePane.svelte';
	import DetailPanel from './DetailPanel.svelte';
	import Icon from './Icon.svelte';
	import './tokens.css';

	let openId = $state<string | null>(null);
	let newOpen = $state(false);

	const openIssue = $derived(openId ? demoIssues.find((i) => i.id === openId) ?? null : null);

	function openIssueById(id: string) {
		newOpen = false;
		openId = id;
	}
	function closeAll() {
		openId = null;
		newOpen = false;
	}
	function openNew() {
		openId = null;
		newOpen = true;
	}

	function columnIssues(status: string) {
		return demoIssues
			.filter((i) => i.status === status)
			.sort((a, b) => {
				const ap = pinnedIds.has(a.id) ? 0 : 1;
				const bp = pinnedIds.has(b.id) ? 0 : 1;
				if (ap !== bp) return ap - bp;
				return a.priority - b.priority;
			});
	}

	function onGlobalKey(e: KeyboardEvent) {
		const tag = (e.target as HTMLElement)?.tagName;
		if (tag === 'INPUT' || tag === 'TEXTAREA') return;
		if (e.key === 'n' || e.key === 'N') {
			e.preventDefault();
			openNew();
		}
	}
</script>

<svelte:head>
	<title>Design Demo · Strandkanban</title>
</svelte:head>

<svelte:window on:keydown={onGlobalKey} />

<div class="design-demo page">
	<header class="top">
		<div class="top-left">
			<span class="top-eyebrow mono">design-demo · pass 2</span>
			<h1 class="top-title">Four core surfaces</h1>
			<p class="top-sub">
				Click any card. Click anything inside the panel to edit.
				Press <span class="kbd">N</span> to capture a new issue.
			</p>
		</div>
		<div class="top-right">
			<button class="new-btn" onclick={openNew}>
				<Icon name="plus" size={12} />
				<span>New</span>
				<span class="kbd dark">N</span>
			</button>
		</div>
	</header>

	<section class="board scrollarea">
		{#each columns as col (col.key)}
			{@const issues = columnIssues(col.status)}
			<div class="column" style="--accent: {col.accent};">
				<header class="col-head">
					<span class="col-dot" style="background: {col.accent};"></span>
					<span class="col-label">{col.label}</span>
					<span class="col-count mono">{issues.length}</span>
				</header>
				<div class="col-body">
					{#each issues as issue (issue.id)}
						<TaskCard
							{issue}
							pinned={pinnedIds.has(issue.id)}
							worktree={worktreeIds.has(issue.id)}
							impact={impactScores[issue.id] ?? 0}
							selected={openId === issue.id}
							onopen={openIssueById}
						/>
					{/each}
				</div>
			</div>
		{/each}
	</section>

	{#if openId}
		<div class="scrim" onclick={closeAll} role="presentation"></div>
	{/if}

	<NewIssuePane open={newOpen} onclose={closeAll} />

	{#if openIssue}
		{#key openIssue.id}
			<DetailPanel issue={openIssue} onclose={closeAll} />
		{/key}
	{/if}
</div>

<style>
	.page {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		background: var(--dd-bg-0);
	}

	.top {
		display: flex;
		align-items: flex-end;
		gap: 16px;
		padding: 22px 28px 16px;
		border-bottom: 1px solid var(--dd-border-1);
	}
	.top-left { flex: 1; display: flex; flex-direction: column; gap: 4px; }
	.top-eyebrow {
		font-size: 10.5px;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--dd-fg-3);
	}
	.top-title {
		margin: 0;
		font-size: 22px;
		font-weight: 600;
		letter-spacing: -0.02em;
	}
	.top-sub {
		margin: 4px 0 0;
		font-size: 12.5px;
		color: var(--dd-fg-2);
	}
	.kbd {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 18px;
		height: 18px;
		padding: 0 5px;
		font-size: 10.5px;
		font-family: var(--dd-font-mono);
		border-radius: 3px;
		background: var(--dd-bg-2);
		color: var(--dd-fg-2);
		border: 1px solid var(--dd-border-2);
	}
	.kbd.dark {
		background: rgba(255, 255, 255, 0.22);
		color: rgba(255, 255, 255, 0.96);
		border-color: transparent;
		margin-left: 4px;
	}

	.new-btn {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 8px 12px;
		border-radius: var(--dd-r-2);
		background: var(--dd-fg-1);
		color: white;
		font-size: 12.5px;
		font-weight: 500;
		transition: background 80ms;
	}
	.new-btn:hover { background: color-mix(in srgb, var(--dd-fg-1) 80%, var(--dd-fg-2)); }

	.board {
		flex: 1;
		display: grid;
		grid-template-columns: repeat(5, minmax(240px, 1fr));
		gap: 14px;
		padding: 18px 20px 24px;
		overflow-x: auto;
		min-height: 0;
	}

	.column {
		display: flex;
		flex-direction: column;
		gap: 10px;
		min-width: 0;
	}
	.col-head {
		display: flex;
		align-items: center;
		gap: 7px;
		padding: 4px 4px 8px;
	}
	.col-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
	}
	.col-label {
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.07em;
		color: var(--dd-fg-2);
	}
	.col-count {
		margin-left: auto;
		font-size: 10.5px;
		color: var(--dd-fg-4);
	}

	.col-body {
		display: flex;
		flex-direction: column;
		gap: 6px;
		min-height: 60px;
	}

	.scrim {
		position: fixed;
		inset: 0;
		background: rgba(20, 20, 25, 0.18);
		z-index: 40;
		animation: fade-in 160ms ease-out;
	}
	@keyframes fade-in {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	@media (max-width: 900px) {
		.board {
			grid-template-columns: repeat(5, 240px);
		}
	}
</style>
