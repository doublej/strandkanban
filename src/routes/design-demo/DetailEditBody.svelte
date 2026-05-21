<script lang="ts">
	import type { Issue, AgentModel, AgentEffort } from '$lib/types';
	import { columns, getPriorityConfig, getTypeIcon } from '$lib/utils';
	import Icon from './Icon.svelte';
	import Pill from './Pill.svelte';
	import DetailRelations from './DetailRelations.svelte';
	import DetailComments from './DetailComments.svelte';

	type Props = { issue: Issue };
	let { issue }: Props = $props();

	// Local state mirrors the issue but doesn't write back (demo only).
	let title = $state(issue.title);
	let description = $state(issue.description);
	let status = $state<Issue['status']>(issue.status);
	let priority = $state<Issue['priority']>(issue.priority);
	let issueType = $state(issue.issue_type);
	let assignee = $state(issue.assignee ?? '');
	let model = $state<AgentModel>(issue.agent_model ?? '');
	let effort = $state<AgentEffort>(issue.agent_effort ?? '');
	let labels = $state<string[]>([...(issue.labels ?? [])]);
	let labelDraft = $state('');

	let showDesign = $state(!!issue.design);
	let showAcceptance = $state(!!issue.acceptance_criteria);
	let showNotes = $state(!!issue.notes);
	let designText = $state(issue.design ?? '');
	let acceptanceText = $state(issue.acceptance_criteria ?? '');
	let notesText = $state(issue.notes ?? '');

	const priorities = [0, 1, 2, 3, 4] as const;
	const types = ['task', 'bug', 'feature', 'epic', 'chore'] as const;
	const models: AgentModel[] = ['', 'haiku', 'sonnet', 'opus'];
	const efforts: AgentEffort[] = ['', 'low', 'medium', 'high'];
	const agentNames = ['agent-claude-1', 'agent-claude-2', 'agent-claude-3'];

	function addLabel() {
		const v = labelDraft.trim();
		if (!v || labels.includes(v)) return;
		labels = [...labels, v];
		labelDraft = '';
	}
	function removeLabel(l: string) {
		labels = labels.filter((x) => x !== l);
	}
	function modelLabel(m: AgentModel) {
		return m === '' ? 'Default' : m[0].toUpperCase() + m.slice(1);
	}
	function effortLabel(e: AgentEffort) {
		return e === '' ? 'Default' : e[0].toUpperCase() + e.slice(1);
	}
</script>

<div class="body scrollarea">
	<label class="block">
		<span class="field-label">Title</span>
		<input class="title-input" type="text" bind:value={title} />
	</label>

	<label class="block">
		<span class="field-label">Description</span>
		<textarea class="desc-input" rows="4" bind:value={description}></textarea>
	</label>

	<div class="block">
		<span class="field-label">Status</span>
		<div class="pill-row five">
			{#each columns as col}
				<Pill active={status === col.status} accent={col.accent} onclick={() => (status = col.status)}>
					<Icon name={col.icon} size={11} />
					<span>{col.label}</span>
				</Pill>
			{/each}
		</div>
	</div>

	<div class="row-2">
		<div class="block">
			<span class="field-label">Priority</span>
			<div class="pill-row five">
				{#each priorities as p, i}
					<Pill
						active={priority === p}
						accent={getPriorityConfig(p).color}
						onclick={() => (priority = p)}
					>
						<span class="dot" style="background: {getPriorityConfig(p).color};"></span>
						<span class="mono">P{i}</span>
					</Pill>
				{/each}
			</div>
		</div>
		<div class="block">
			<span class="field-label">Type</span>
			<div class="pill-row five">
				{#each types as t}
					<Pill
						active={issueType === t}
						accent="var(--dd-fg-2)"
						onclick={() => (issueType = t)}
					>
						<Icon name={getTypeIcon(t)} size={11} />
						<span>{t}</span>
					</Pill>
				{/each}
			</div>
		</div>
	</div>

	<!-- Optional sections (ghost buttons until added) -->
	<div class="optionals">
		{#if showDesign}
			<div class="opt-block">
				<header class="opt-head">
					<span class="field-label">Design</span>
					<button class="opt-x" onclick={() => { showDesign = false; designText = ''; }} title="Remove">
						<Icon name="x" size={10} />
					</button>
				</header>
				<textarea rows="3" bind:value={designText} placeholder="How we plan to solve it…"></textarea>
			</div>
		{/if}
		{#if showAcceptance}
			<div class="opt-block">
				<header class="opt-head">
					<span class="field-label">Acceptance</span>
					<button class="opt-x" onclick={() => { showAcceptance = false; acceptanceText = ''; }} title="Remove">
						<Icon name="x" size={10} />
					</button>
				</header>
				<textarea rows="3" bind:value={acceptanceText} placeholder="Definition of done…"></textarea>
			</div>
		{/if}
		{#if showNotes}
			<div class="opt-block">
				<header class="opt-head">
					<span class="field-label">Notes</span>
					<button class="opt-x" onclick={() => { showNotes = false; notesText = ''; }} title="Remove">
						<Icon name="x" size={10} />
					</button>
				</header>
				<textarea rows="3" bind:value={notesText} placeholder="Progress updates…"></textarea>
			</div>
		{/if}

		<div class="ghost-row">
			{#if !showDesign}
				<button class="ghost-add" onclick={() => (showDesign = true)}>
					<Icon name="plus" size={11} /><span>Design</span>
				</button>
			{/if}
			{#if !showAcceptance}
				<button class="ghost-add" onclick={() => (showAcceptance = true)}>
					<Icon name="plus" size={11} /><span>Acceptance</span>
				</button>
			{/if}
			{#if !showNotes}
				<button class="ghost-add" onclick={() => (showNotes = true)}>
					<Icon name="plus" size={11} /><span>Notes</span>
				</button>
			{/if}
		</div>
	</div>

	<label class="block">
		<span class="field-label">
			Assignee
			<span class="hint">(3 agents)</span>
		</span>
		<input list="agents-dl" type="text" bind:value={assignee} placeholder="@jurre or agent-claude-1" />
		<datalist id="agents-dl">
			{#each agentNames as a}<option value={a} />{/each}
		</datalist>
	</label>

	<div class="overrides">
		<div class="overrides-head">
			<span class="field-label">Agent Overrides</span>
			<span class="hint">per-issue, overrides global</span>
		</div>
		<div class="row-2">
			<div class="block">
				<span class="sub-label">Model</span>
				<div class="pill-row four">
					{#each models as m}
						<Pill active={model === m} accent="var(--dd-accent)" onclick={() => (model = m)}>
							<span>{modelLabel(m)}</span>
						</Pill>
					{/each}
				</div>
			</div>
			<div class="block">
				<span class="sub-label">Effort</span>
				<div class="pill-row four">
					{#each efforts as e}
						<Pill active={effort === e} accent="var(--dd-accent)" onclick={() => (effort = e)}>
							<span>{effortLabel(e)}</span>
						</Pill>
					{/each}
				</div>
			</div>
		</div>
	</div>

	<div class="block">
		<span class="field-label">Labels</span>
		<div class="label-chips">
			{#each labels as l (l)}
				<span class="chip">
					<span>{l}</span>
					<button class="chip-x" title="Remove" onclick={() => removeLabel(l)}>
						<Icon name="x" size={10} />
					</button>
				</span>
			{/each}
		</div>
		<div class="label-add">
			<input
				type="text"
				bind:value={labelDraft}
				placeholder="Add label…"
				onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLabel(); } }}
			/>
			<button class="add-btn" disabled={!labelDraft.trim()} onclick={addLabel} title="Add">
				<Icon name="plus" size={12} />
			</button>
		</div>
	</div>

	<DetailRelations dependencies={issue.dependencies} dependents={issue.dependents} editable />

	<DetailComments comments={issue.comments} />
</div>

<style>
	.body {
		flex: 1;
		overflow-y: auto;
		padding: 18px;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.block { display: flex; flex-direction: column; gap: 6px; }
	.row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }

	.field-label {
		font-size: 10.5px;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--dd-fg-3);
		font-weight: 500;
	}
	.sub-label {
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--dd-fg-4);
	}
	.hint {
		text-transform: none;
		letter-spacing: 0;
		color: var(--dd-fg-4);
		font-weight: 400;
		margin-left: 4px;
	}

	.title-input {
		font-size: 15px;
		font-weight: 500;
		padding: 8px 10px;
	}
	.desc-input { resize: vertical; min-height: 90px; line-height: 1.55; }

	.pill-row { display: flex; gap: 4px; }
	.pill-row.five > :global(.pill),
	.pill-row.four > :global(.pill) {
		flex: 1;
		justify-content: center;
	}

	.dot { width: 7px; height: 7px; border-radius: 50%; display: inline-block; }

	.optionals { display: flex; flex-direction: column; gap: 10px; }
	.opt-block { display: flex; flex-direction: column; gap: 6px; }
	.opt-head {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.opt-x {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 16px;
		height: 16px;
		border-radius: 3px;
		color: var(--dd-fg-4);
	}
	.opt-x:hover {
		color: var(--dd-fg-1);
		background: var(--dd-bg-3);
	}

	.ghost-row { display: flex; flex-wrap: wrap; gap: 6px; }
	.ghost-add {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 5px 10px;
		border: 1px dashed var(--dd-border-2);
		border-radius: var(--dd-r-2);
		color: var(--dd-fg-3);
		font-size: 11.5px;
	}
	.ghost-add:hover {
		color: var(--dd-fg-1);
		background: var(--dd-bg-3);
		border-color: var(--dd-border-3);
	}

	.overrides {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding-top: 14px;
		border-top: 1px solid var(--dd-border-1);
	}
	.overrides-head { display: flex; align-items: baseline; gap: 6px; }

	.label-chips { display: flex; flex-wrap: wrap; gap: 5px; min-height: 22px; }
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 3px 4px 3px 9px;
		background: var(--dd-bg-3);
		border: 1px solid var(--dd-border-2);
		border-radius: var(--dd-r-2);
		font-size: 11.5px;
		color: var(--dd-fg-1);
	}
	.chip-x {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 16px;
		height: 16px;
		border-radius: 3px;
		color: var(--dd-fg-3);
	}
	.chip-x:hover { color: var(--dd-fg-1); background: var(--dd-bg-4); }

	.label-add { display: flex; gap: 6px; }
	.label-add input { flex: 1; }
	.add-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 34px;
		border-radius: var(--dd-r-2);
		background: color-mix(in srgb, var(--dd-agent) 18%, var(--dd-bg-2));
		color: var(--dd-agent);
		border: 1px solid color-mix(in srgb, var(--dd-agent) 38%, var(--dd-border-2));
	}
	.add-btn:not(:disabled):hover {
		background: color-mix(in srgb, var(--dd-agent) 28%, var(--dd-bg-2));
	}
	.add-btn:disabled { opacity: 0.4; cursor: default; }
</style>
