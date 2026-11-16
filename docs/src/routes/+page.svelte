<script lang="ts">
	import { base } from '$app/paths';

	const repo = 'https://github.com/doublej/strandkanban';
	const beads = 'https://github.com/gastownhall/beads';
	const installCommand = 'npm install -g github:doublej/strandkanban';

	let copied = $state(false);

	async function copyInstall() {
		await navigator.clipboard.writeText(installCommand);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}

	const statuses = [
		{ name: 'Backlog', status: 'open' },
		{ name: 'In Progress', status: 'in_progress' },
		{ name: 'Hooked', status: 'hooked' },
		{ name: 'Blocked', status: 'blocked' },
		{ name: 'Complete', status: 'closed' }
	];

	// Order here is the figure numbering on the page.
	const figures = [
		{
			name: 'Board',
			group: 'Board',
			file: 'keyboard-hints-light.png',
			alt: 'Board view with five columns of issue cards, each column header numbered 1 to 5',
			desc: 'Drag a card to another column to change its status. Reorder cards inside a column to set priority. The numbers on the column headers are keyboard hints.'
		},
		{
			name: 'Table',
			group: 'Views',
			file: 'table-view-light.png',
			alt: 'Table view with a filter sidebar and sortable columns',
			desc: 'Sortable, configurable columns with inline field editing. Select several rows for bulk actions.'
		},
		{
			name: 'Tree',
			group: 'Views',
			file: 'tree-view-light.png',
			alt: 'Tree view with one line per issue and collapsed branches',
			desc: 'Issues nested under their parents, one line each.'
		},
		{
			name: 'Tree, expanded',
			group: 'Views',
			file: 'tree-expanded-light.png',
			alt: 'Tree view with child issues nested under their parents',
			desc: 'Expand or collapse a branch to show or hide its child issues.'
		},
		{
			name: 'Graph',
			group: 'Views',
			file: 'graph-view-light.png',
			alt: 'Dependency graph view listing which issue blocks which',
			desc: 'See what blocks what. The flow view draws dependencies as an interactive graph, with grouped and timeline layouts.'
		},
		{
			name: 'Stats',
			group: 'Views',
			file: 'stats-view-light.png',
			alt: 'Stats view with bar charts per status, priority and type',
			desc: 'Issue counts by status, priority and type, next to created versus closed.'
		},
		{
			name: 'Ticket pane',
			group: 'Board',
			file: 'detail-panel-light.png',
			alt: 'Board view with a ticket pane open next to the Backlog column',
			desc: 'Open a card to edit its title, description and comments in place. Relations and attachments sit in the same pane.'
		},
		{
			name: 'Board, wide',
			group: 'Board',
			file: 'kanban-wide-light.png',
			alt: 'The whole board, dimmed, with 22 issues across five columns',
			desc: 'The whole board on a wide screen: 22 issues across five columns.'
		},
		{
			name: 'Agent pane',
			group: 'Agents',
			file: 'agent-kanban-light.png',
			alt: 'The board with five columns of issue cards and an agent pane open in the corner',
			desc: 'The board, with an agent pane open bottom right. The agent moves a ticket to In Progress and the card follows.'
		}
	];

	const facts = [
		{ term: 'Keyboard', desc: 'Drive the whole board with arrow keys or vim-style <kbd>h</kbd> <kbd>j</kbd> <kbd>k</kbd> <kbd>l</kbd>.' },
		{ term: 'Live updates', desc: 'The board updates when the CLI or an agent changes an issue. No refresh.' },
		{ term: 'Dependencies', desc: 'Link issues as parent, child or blocker, and see what blocks what.' },
		{ term: 'Search and filters', desc: 'Filter by text, priority, type, label, time and whether an issue is actionable.' },
		{ term: 'Notifications', desc: 'Browser push and desktop notifications when issues change.' },
		{ term: 'Deep links', desc: '<code>strand://issue-id</code> jumps straight to an issue on a running board.' }
	];

	const queue = [
		{ id: 'acme-21', state: 'claimed', note: 'worker 1, lease held' },
		{ id: 'acme-22', state: 'claimed', note: 'worker 2, lease held' },
		{ id: 'acme-24', state: 'claimed', note: 'worker 3, lease held' },
		{ id: 'acme-23', state: 'skipped', note: 'listed by bd blocked' },
		{ id: 'acme-25', state: 'waiting', note: 'cap reached' }
	];

	const commands = [
		{ cmd: 'strand', desc: 'Start against the current directory' },
		{ cmd: 'strand ~/code/my-project', desc: 'Start against another project' },
		{ cmd: 'strand open strand://proj-123', desc: 'Focus an issue on the running board' },
		{ cmd: 'strand zen proj-123,proj-456', desc: 'Open focus review for selected issues' },
		{ cmd: 'strand reap', desc: 'Clean up stale dolt sql-server processes from old sessions' }
	];

	const pad = (n: number) => String(n).padStart(2, '0');
</script>

<svelte:head>
	<title>strandkanban: a Kanban board for Beads issues</title>
</svelte:head>

{#snippet plate(i: number)}
	{@const f = figures[i]}
	<figure class="fig" id="fig-{pad(i + 1)}">
		<figcaption>
			<span class="fig-no">Fig. {pad(i + 1)}</span>
			<strong>{f.name}</strong>
			<span class="fig-desc">{f.desc}</span>
			<span class="fig-hint">Swipe to pan, tap for full size</span>
		</figcaption>
		<a class="shot" href="{base}/screenshots/{f.file}" aria-label="{f.name}, full size">
			<img
				src="{base}/screenshots/{f.file}"
				alt={f.alt}
				width="1600"
				height="900"
				loading={i === 0 ? 'eager' : 'lazy'}
				fetchpriority={i === 0 ? 'high' : 'auto'}
			/>
		</a>
	</figure>
{/snippet}

<a class="skip" href="#main">Skip to content</a>

<div class="page">
	<header class="top">
		<a class="brand" href="{base}/">strandkanban</a>
		<nav aria-label="Page sections">
			<a href="#views">Views</a>
			<a href="#board">Board</a>
			<a href="#agents">Agents</a>
			<a href="#install">Install</a>
			<a href={repo}>GitHub</a>
		</nav>
	</header>

	<main id="main">
		<section class="hero" aria-labelledby="hero-title">
			<h1 id="hero-title">Kanban board for the Beads issue tracker</h1>

			<div class="grid">
				<div class="hero-text">
					<p class="lead">
						strandkanban puts the issues from your repo's <code>.beads/</code> database on a
						drag-and-drop board. Every edit goes through the <a href={beads}>Beads</a>
						<code>bd</code> CLI, so the CLI, your agents and the board always work from the same data.
						Your issues never leave your repo.
					</p>

					<div class="install">
						<pre><code
								><span class="prompt" aria-hidden="true">$ </span>{installCommand}
<span class="prompt" aria-hidden="true">$ </span>strand /path/to/project</code
							></pre>
						<div class="install-meta">
							<span>Needs <code>bd</code> 1.3.4+ and Node 20.19+ or Bun 1.0+</span>
							<button type="button" onclick={copyInstall}>
								<span aria-live="polite">{copied ? 'Copied' : 'Copy install'}</span>
							</button>
						</div>
					</div>
				</div>

				<nav class="index" aria-labelledby="index-label">
					<p class="label" id="index-label">Screenshots</p>
					<ol>
						{#each figures as f, i}
							<li>
								<a href="#fig-{pad(i + 1)}">
									<span class="index-no">{pad(i + 1)}</span>
									<span class="index-name">{f.name}</span>
									<span class="index-group">{f.group}</span>
								</a>
							</li>
						{/each}
					</ol>
				</nav>
			</div>

			{@render plate(0)}

			<div class="flow">
				<ol aria-label="Five columns, five Beads statuses">
					{#each statuses as s, i}
						<li>
							<span class="flow-no">{i + 1}</span>
							<span class="flow-name">{s.name}</span>
							<code>{s.status}</code>
						</li>
					{/each}
				</ol>
				<p class="note">
					Five columns, five Beads statuses. The name is literal: a strand is a string of beads.
				</p>
			</div>
		</section>

		<section id="views" aria-labelledby="views-title">
			<header class="grid sec-head">
				<p class="label">01 / Views</p>
				<h2 id="views-title">Five views of the same issues</h2>
			</header>

			{@render plate(1)}
			{@render plate(2)}
			{@render plate(3)}
			{@render plate(4)}
			{@render plate(5)}

			<div class="grid block">
				<p class="label">Not pictured</p>
				<div class="prose">
					<h3>Zen focus review</h3>
					<p>
						A full-screen review of a list of issues, one at a time. Press <kbd>z</kbd> on a selected
						card, or run <code>strand zen proj-123,proj-456</code>. Cycle with <kbd>←</kbd>
						<kbd>→</kbd> or <kbd>h</kbd> <kbd>j</kbd> <kbd>k</kbd> <kbd>l</kbd>, open the detail pane
						with <kbd>Enter</kbd>, leave with <kbd>Esc</kbd>.
					</p>
				</div>
			</div>
		</section>

		<section id="board" aria-labelledby="board-title">
			<header class="grid sec-head">
				<p class="label">02 / Board</p>
				<h2 id="board-title">Working the board</h2>
			</header>

			<div class="grid block">
				<p class="label">Features</p>
				<dl class="facts">
					{#each facts as fact}
						<div>
							<dt>{fact.term}</dt>
							<dd>{@html fact.desc}</dd>
						</div>
					{/each}
				</dl>
			</div>

			{@render plate(6)}
			{@render plate(7)}
		</section>

		<section id="agents" aria-labelledby="agents-title">
			<header class="grid sec-head">
				<p class="label">03 / Agents</p>
				<h2 id="agents-title">Agents next to the board</h2>
			</header>

			<div class="grid block">
				<p class="label">Providers</p>
				<div class="prose">
					<p>
						Run agent sessions in panes beside the board and hand them tickets. Pick the provider
						in Settings.
					</p>
					<ul class="providers" aria-label="Agent providers">
						<li>Claude</li>
						<li>Codex</li>
						<li>OpenCode</li>
					</ul>
				</div>
			</div>

			<div class="grid block">
				<p class="label">Manager</p>
				<dl class="facts stacked">
					<div>
						<dt>Manager queue</dt>
						<dd>
							Runs several workers at once, up to a cap you set in Settings (default 3). It skips
							tickets that <code>bd blocked</code> lists instead of waiting behind them.
						</dd>
					</div>
					<div>
						<dt>Leased claims</dt>
						<dd>
							A worker claims its ticket with a lease and a heartbeat. A claim whose worker has
							stopped is reclaimed after 10 minutes.
						</dd>
					</div>
					<div>
						<dt>Panes fit the provider</dt>
						<dd>
							Controls a provider does not have stay hidden. Codex workers reach Beads through a
							built-in MCP bridge and never write to <code>~/.codex/config.toml</code>.
						</dd>
					</div>
				</dl>

				<figure class="queue">
					<table>
						<caption>manager queue, cap 3</caption>
						<tbody>
							{#each queue as row}
								<tr class={row.state}>
									<th scope="row">{row.id}</th>
									<td>{row.state}</td>
									<td>{row.note}</td>
								</tr>
							{/each}
						</tbody>
					</table>
					<figcaption>Illustration: five queued tickets with a cap of 3.</figcaption>
				</figure>
			</div>

			{@render plate(8)}
		</section>

		<section id="install" aria-labelledby="install-title">
			<header class="grid sec-head">
				<p class="label">04 / Install</p>
				<h2 id="install-title">Three commands to a board</h2>
			</header>

			<div class="grid block">
				<p class="label">Setup</p>
				<ol class="steps">
					<li>
						<h3>Install Beads</h3>
						<pre><code><span class="prompt" aria-hidden="true">$ </span>brew install beads</code></pre>
						<p>strandkanban needs <code>bd</code> 1.3.4 or newer.</p>
					</li>
					<li>
						<h3>Install strandkanban</h3>
						<pre><code><span class="prompt" aria-hidden="true">$ </span>{installCommand}</code></pre>
						<p>Needs Node 20.19+ or Bun 1.0+, on macOS or Linux.</p>
					</li>
					<li>
						<h3>Start a board</h3>
						<pre><code><span class="prompt" aria-hidden="true">$ </span>strand /path/to/project</code></pre>
						<p>
							The launcher checks <code>bd</code>, offers to run <code>bd init</code> when there is no
							<code>.beads/</code>, picks a free port and starts the agent server.
						</p>
					</li>
				</ol>
			</div>

			<div class="grid block">
				<p class="label">Without installing</p>
				<p class="prose">
					To try it once: <code>npx github:doublej/strandkanban /path/to/project</code>. Agent panes
					need an <code>ANTHROPIC_API_KEY</code>; the rest of the board works without one.
				</p>
			</div>

			<div class="grid block">
				<p class="label">Daily use</p>
				<dl class="commands">
					{#each commands as c}
						<div>
							<dt><code>{c.cmd}</code></dt>
							<dd>{c.desc}</dd>
						</div>
					{/each}
				</dl>
			</div>
		</section>
	</main>

	<footer>
		<p>strandkanban is built on <a href={beads}>Beads</a>.</p>
		<nav aria-label="Project links">
			<a href={repo}>GitHub</a>
			<a href="{repo}#readme">README</a>
			<a href="{repo}/blob/main/CHANGELOG.md">Changelog</a>
		</nav>
	</footer>
</div>

<style>
	:global(*),
	:global(*::before),
	:global(*::after) {
		box-sizing: border-box;
	}

	:global(html) {
		scroll-padding-top: 24px;
	}

	:global(body) {
		--bg: #fafafa;
		--paper: #ffffff;
		--ink: #141414;
		--mute: #666666;
		--rule: #dcdcdc;
		--edge: #c4c4c4;
		--sans: 'Instrument Sans', 'Helvetica Neue', sans-serif;
		--mono: 'DM Mono', ui-monospace, 'SF Mono', Menlo, monospace;

		margin: 0;
		background: var(--bg);
		color: var(--ink);
		font-family: var(--sans);
		font-size: 15px;
		line-height: 1.5;
		-webkit-font-smoothing: antialiased;
		text-rendering: optimizeLegibility;
	}

	:global(::selection) {
		background: var(--ink);
		color: var(--bg);
	}

	.page {
		max-width: 1680px;
		margin: 0 auto;
		padding: 0 clamp(16px, 2.3vw, 40px);
	}

	a {
		color: inherit;
		text-decoration: underline;
		text-decoration-thickness: 1px;
		text-underline-offset: 3px;
	}

	a:hover {
		text-decoration-thickness: 2px;
	}

	:global(:focus-visible) {
		outline: 2px solid var(--ink);
		outline-offset: 2px;
	}

	p {
		margin: 0;
	}

	.skip {
		position: absolute;
		left: -9999px;
	}

	.skip:focus {
		left: 16px;
		top: 16px;
		z-index: 10;
		background: var(--ink);
		color: var(--bg);
		padding: 8px 12px;
	}

	/* Mono metadata: labels, figure numbers, nav */
	.label,
	.top,
	.fig-no,
	.fig-hint,
	.index,
	.flow-no,
	.note,
	footer {
		font-family: var(--mono);
		font-size: 12px;
		line-height: 1.5;
		letter-spacing: 0.01em;
	}

	.label {
		color: var(--mute);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	code,
	:global(.facts code) {
		font-family: var(--mono);
		font-size: 0.9em;
	}

	:global(kbd) {
		font-family: var(--mono);
		font-size: 0.8em;
		padding: 1px 5px;
		border: 1px solid var(--edge);
		border-bottom-width: 2px;
		border-radius: 3px;
		background: var(--paper);
	}

	/* 12 columns: label in 1-2, content from 3 */
	.grid {
		display: grid;
		grid-template-columns: repeat(12, minmax(0, 1fr));
		column-gap: 24px;
	}

	.grid > .label {
		grid-column: 1 / span 2;
		padding-top: 2px;
	}

	/* Top bar */
	.top {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 16px;
		padding: 18px 0 14px;
		border-bottom: 1px solid var(--ink);
	}

	.top a {
		text-decoration: none;
	}

	.top a:hover {
		text-decoration: underline;
	}

	.brand {
		font-family: var(--sans);
		font-size: 15px;
		font-weight: 600;
		letter-spacing: -0.01em;
	}

	.top nav,
	footer nav {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 22px;
	}

	/* Hero */
	.hero {
		padding-top: clamp(40px, 5vw, 76px);
	}

	.hero .fig {
		margin-top: clamp(48px, 4.5vw, 64px);
	}

	h1 {
		margin: 0 0 clamp(28px, 3.5vw, 52px);
		max-width: 13em;
		font-size: clamp(2.3rem, 5.6vw, 5.25rem);
		font-weight: 600;
		line-height: 0.98;
		letter-spacing: -0.045em;
		text-wrap: balance;
	}

	.hero-text {
		grid-column: 1 / span 5;
	}

	.lead {
		max-width: 46ch;
		margin-bottom: 28px;
	}

	.lead code,
	.prose code,
	.steps p code {
		background: #efefef;
		padding: 1px 4px;
	}

	pre {
		margin: 0;
		overflow-x: auto;
		font-family: var(--mono);
		font-size: 13px;
		line-height: 1.7;
	}

	pre code {
		font-size: inherit;
	}

	.prompt {
		color: var(--mute);
		user-select: none;
	}

	.install {
		max-width: 520px;
		border: 1px solid var(--ink);
		background: var(--paper);
	}

	.install pre {
		padding: 14px 16px;
	}

	.install-meta {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: center;
		gap: 8px 16px;
		padding: 8px 8px 8px 16px;
		border-top: 1px solid var(--rule);
		font-size: 13px;
		color: var(--mute);
	}

	button {
		font-family: var(--mono);
		font-size: 12px;
		padding: 5px 10px;
		border: 1px solid var(--ink);
		border-radius: 0;
		background: var(--ink);
		color: var(--bg);
		cursor: pointer;
	}

	button:hover {
		background: var(--paper);
		color: var(--ink);
	}

	/* Screenshot index */
	.index {
		grid-column: 9 / span 4;
	}

	.index .label {
		padding-bottom: 8px;
		border-bottom: 1px solid var(--ink);
	}

	.index ol {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.index a {
		display: grid;
		grid-template-columns: 3.5ch 1fr auto;
		gap: 12px;
		padding: 5px 0;
		border-bottom: 1px solid var(--rule);
		text-decoration: none;
	}

	.index a:hover {
		background: var(--ink);
		color: var(--bg);
		box-shadow: 0 0 0 0 var(--ink), -8px 0 0 var(--ink), 8px 0 0 var(--ink);
	}

	.index-no,
	.index-group {
		color: var(--mute);
	}

	.index a:hover .index-no,
	.index a:hover .index-group {
		color: inherit;
	}

	/* Figures: the screenshots are the page */
	.fig {
		margin: clamp(56px, 7vw, 104px) 0 0;
		scroll-margin-top: 24px;
	}

	.fig figcaption {
		display: grid;
		grid-template-columns: repeat(12, minmax(0, 1fr));
		column-gap: 24px;
		align-items: baseline;
		padding: 10px 0 14px;
		border-top: 1px solid var(--ink);
	}

	.fig-no {
		grid-column: 1 / span 2;
		color: var(--mute);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.fig figcaption strong {
		grid-column: 3 / span 2;
		font-weight: 600;
	}

	.fig-desc {
		grid-column: 5 / span 5;
		max-width: 60ch;
		font-size: 14px;
	}

	.fig-hint {
		display: none;
		color: var(--mute);
	}

	.shot {
		display: block;
		border: 1px solid var(--edge);
		background: var(--paper);
		cursor: zoom-in;
	}

	.shot img {
		display: block;
		width: 100%;
		height: auto;
	}

	/* Status strip: five cells under the five board columns of Fig. 01 */
	.flow ol {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		margin: 0;
		padding: 0;
		list-style: none;
		border-bottom: 1px solid var(--rule);
	}

	.flow li {
		display: grid;
		grid-template-columns: 2.5ch 1fr;
		gap: 0 8px;
		padding: 12px 12px 12px 0;
	}

	.flow li + li {
		padding-left: 12px;
		border-left: 1px solid var(--rule);
	}

	.flow-no {
		grid-row: span 2;
		color: var(--mute);
		padding-top: 2px;
	}

	.flow-name {
		font-weight: 600;
	}

	.flow code {
		font-size: 12px;
		color: var(--mute);
	}

	.note {
		margin-top: 10px;
		color: var(--mute);
	}

	/* Sections */
	section:not(.hero) {
		margin-top: clamp(112px, 15vw, 232px);
		scroll-margin-top: 24px;
	}

	.sec-head {
		padding-top: 12px;
		border-top: 3px solid var(--ink);
	}

	h2 {
		grid-column: 3 / span 8;
		margin: 0;
		font-size: clamp(1.7rem, 3.3vw, 3rem);
		font-weight: 600;
		line-height: 1.02;
		letter-spacing: -0.035em;
	}

	h3 {
		margin: 0 0 6px;
		font-size: 15px;
		font-weight: 600;
	}

	.block {
		margin-top: clamp(40px, 5vw, 72px);
		padding-top: 10px;
		border-top: 1px solid var(--rule);
	}

	.sec-head + .block {
		margin-top: clamp(32px, 4vw, 56px);
	}

	.prose {
		grid-column: 3 / span 5;
		max-width: 58ch;
		font-size: 14px;
	}

	.prose p + ul {
		margin-top: 12px;
	}

	/* Dense fact lists */
	.facts {
		grid-column: 3 / span 10;
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 22px 24px;
		margin: 0;
		font-size: 14px;
	}

	.facts.stacked {
		grid-column: 3 / span 5;
		grid-template-columns: 1fr;
	}

	.facts dt,
	.commands dt {
		font-weight: 600;
	}

	.facts dd,
	.commands dd {
		margin: 0;
	}

	.facts dd {
		max-width: 44ch;
		color: #3a3a3a;
	}

	.providers {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin: 0;
		padding: 0;
		list-style: none;
		font-family: var(--mono);
		font-size: 12px;
	}

	.providers li {
		padding: 2px 8px;
		border: 1px solid var(--ink);
	}

	/* Queue illustration */
	.queue {
		grid-column: 9 / span 4;
		margin: 0;
		font-family: var(--mono);
		font-size: 12px;
	}

	.queue table {
		width: 100%;
		border-collapse: collapse;
		background: var(--paper);
		border: 1px solid var(--ink);
	}

	.queue caption {
		padding: 0 0 6px;
		text-align: left;
		color: var(--mute);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.queue th,
	.queue td {
		padding: 6px 10px;
		border-top: 1px solid var(--rule);
		text-align: left;
		font-weight: 400;
		vertical-align: baseline;
	}

	.queue tr:first-child > * {
		border-top: 0;
	}

	.queue th {
		white-space: nowrap;
	}

	.queue .claimed th::before,
	.queue .skipped th::before,
	.queue .waiting th::before {
		content: '';
		display: inline-block;
		width: 7px;
		height: 7px;
		margin-right: 8px;
		border: 1px solid var(--ink);
	}

	.queue .claimed th::before {
		background: var(--ink);
	}

	.queue .skipped,
	.queue .waiting {
		color: var(--mute);
	}

	.queue .skipped th {
		text-decoration: line-through;
	}

	.queue figcaption {
		margin-top: 8px;
		color: var(--mute);
	}

	/* Install */
	.steps {
		grid-column: 3 / span 10;
		margin: 0;
		padding: 0;
		list-style: none;
		counter-reset: step;
		font-size: 14px;
	}

	.steps li {
		counter-increment: step;
		display: grid;
		grid-template-columns: repeat(10, minmax(0, 1fr));
		column-gap: 24px;
		align-items: start;
		padding: 12px 0;
		border-bottom: 1px solid var(--rule);
	}

	.steps li:first-child {
		padding-top: 0;
	}

	.steps h3 {
		grid-column: span 2;
		margin: 0;
		padding-top: 9px;
	}

	.steps h3::before {
		content: counter(step) '  ';
		font-family: var(--mono);
		font-size: 12px;
		font-weight: 400;
		color: var(--mute);
		white-space: pre;
	}

	.steps pre {
		grid-column: span 4;
		padding: 8px 12px;
		border: 1px solid var(--ink);
		background: var(--paper);
	}

	.steps p {
		grid-column: span 4;
		max-width: 44ch;
		padding-top: 9px;
		color: #3a3a3a;
	}

	.commands {
		grid-column: 3 / span 10;
		margin: 0;
		font-size: 14px;
	}

	.commands div {
		display: grid;
		grid-template-columns: repeat(10, minmax(0, 1fr));
		column-gap: 24px;
		padding: 7px 0;
		border-bottom: 1px solid var(--rule);
	}

	.commands div:first-child {
		padding-top: 0;
	}

	.commands dt {
		grid-column: span 4;
		font-weight: 400;
		overflow-wrap: anywhere;
	}

	.commands dt code {
		font-size: 13px;
	}

	.commands dd {
		grid-column: span 6;
		color: #3a3a3a;
	}

	/* Footer */
	footer {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 8px 24px;
		margin-top: clamp(112px, 15vw, 232px);
		padding: 14px 0 40px;
		border-top: 1px solid var(--ink);
	}

	@media (max-width: 1100px) {
		.fig figcaption strong {
			grid-column: 3 / span 3;
		}

		.fig-desc {
			grid-column: 6 / span 7;
		}

		.hero-text {
			grid-column: 1 / span 7;
		}

		.prose,
		.facts.stacked {
			grid-column: 3 / span 6;
		}

		.facts:not(.stacked) {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.queue {
			grid-column: 3 / span 10;
			max-width: 440px;
			margin-top: 32px;
		}

		.steps li {
			display: block;
		}

		.steps h3,
		.steps p {
			padding-top: 0;
		}

		.steps pre {
			max-width: 520px;
			margin: 8px 0 10px;
		}
	}

	@media (max-width: 760px) {
		.grid,
		.fig figcaption {
			display: block;
		}

		.grid > .label {
			margin-bottom: 10px;
		}

		.top {
			flex-direction: column;
			gap: 6px;
		}

		.top nav {
			gap: 4px 18px;
		}

		pre {
			font-size: 12px;
		}

		.install pre {
			padding: 12px;
		}

		.install-meta {
			padding-left: 12px;
		}

		.index {
			margin-top: 40px;
		}

		.fig figcaption strong,
		.fig-desc,
		.fig-hint {
			display: block;
		}

		.fig figcaption strong {
			margin-top: 2px;
		}

		.fig-hint {
			margin-top: 8px;
		}

		/* A 1600px capture is unreadable at 360px, so keep it legible and let it pan. */
		.shot {
			overflow-x: auto;
			overscroll-behavior-x: contain;
		}

		.shot img {
			width: 1100px;
			max-width: none;
		}

		.flow ol {
			grid-template-columns: 1fr;
		}

		.flow li,
		.flow li + li {
			grid-template-columns: 2.5ch 1fr auto;
			align-items: baseline;
			padding: 7px 0;
			border-left: 0;
			border-top: 1px solid var(--rule);
		}

		.flow li:first-child {
			border-top: 0;
		}

		.flow-no {
			grid-row: auto;
			padding-top: 0;
		}

		.facts,
		.facts:not(.stacked) {
			grid-template-columns: 1fr;
		}


		.commands div {
			display: block;
		}
	}

	@media (prefers-reduced-motion: no-preference) {
		:global(html) {
			scroll-behavior: smooth;
		}
	}
</style>
