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
		{ name: 'Backlog', status: 'open', tone: 'open' },
		{ name: 'In Progress', status: 'in_progress', tone: 'progress' },
		{ name: 'Hooked', status: 'hooked', tone: 'hooked' },
		{ name: 'Blocked', status: 'blocked', tone: 'blocked' },
		{ name: 'Complete', status: 'closed', tone: 'closed' }
	];

	const views = [
		{
			name: 'Board',
			tone: 'open',
			file: 'detail-panel-light.png',
			alt: 'Board view with a ticket pane open next to the Backlog column',
			desc: 'Drag a card to another column to change its status. Reorder cards inside a column to set priority. Edit titles, descriptions and comments in place.'
		},
		{
			name: 'Table',
			tone: 'progress',
			file: 'table-view-light.png',
			alt: 'Table view with a filter sidebar and sortable columns',
			desc: 'Sortable, configurable columns with inline field editing. Select several rows for bulk actions.'
		},
		{
			name: 'Tree',
			tone: 'hooked',
			file: 'tree-expanded-light.png',
			alt: 'Tree view with child issues nested under their parents',
			desc: 'Issues nested under their parents. Expand or collapse a branch.'
		},
		{
			name: 'Graph',
			tone: 'blocked',
			file: 'graph-view-light.png',
			alt: 'Dependency graph view listing which issue blocks which',
			desc: 'See what blocks what. The flow view draws dependencies as an interactive graph, with grouped and timeline layouts.'
		},
		{
			name: 'Stats',
			tone: 'closed',
			file: 'stats-view-light.png',
			alt: 'Stats view with bar charts per status, priority and type',
			desc: 'Issue counts by status, priority and type, next to created versus closed.'
		}
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
</script>

<svelte:head>
	<title>strandkanban: a Kanban board for Beads issues</title>
</svelte:head>

<a class="skip" href="#main">Skip to content</a>

<div class="page">
	<header class="top">
		<a class="brand" href="{base}/">
			<span class="bead" style="--c: var(--open)" aria-hidden="true"></span>strandkanban
		</a>
		<nav aria-label="Page sections">
			<a href="#views">Views</a>
			<a href="#agents">Agents</a>
			<a href="#install">Install</a>
			<a href={repo}>GitHub</a>
		</nav>
	</header>

	<main id="main">
		<section class="hero" aria-labelledby="hero-title">
			<p class="label rise" style="--d: 0ms">Kanban board for the Beads issue tracker</p>
			<h1 id="hero-title" class="rise" style="--d: 80ms">
				Beads issues, on a live board<span class="full-stop" aria-hidden="true"></span>
			</h1>

			<div class="hero-cols">
				<p class="lead rise" style="--d: 180ms">
					strandkanban puts the issues from your repo's <code>.beads/</code> database on a
					drag-and-drop board. Every edit goes through the <a href={beads}>Beads</a>
					<code>bd</code> CLI, so the CLI, your agents and the board always work from the same data.
					Your issues never leave your repo.
				</p>

				<div class="install-card rise" style="--d: 260ms">
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

			<div class="rod-wrap">
				<p class="label" id="rod-label">Five columns, five Beads statuses</p>
				<ol class="rod" aria-labelledby="rod-label">
					{#each statuses as s, i}
						<li style="--c: var(--{s.tone}); --i: {i}">
							<span class="bead" aria-hidden="true"></span>
							<span class="rod-name">{s.name}</span>
							<code>{s.status}</code>
						</li>
					{/each}
				</ol>
				<p class="aside">The name is literal. A strand is a string of beads.</p>
			</div>

			<figure class="plate wide">
				<a href="{base}/screenshots/agent-kanban-light.png">
					<img
						src="{base}/screenshots/agent-kanban-light.png"
						alt="The board with five columns of issue cards and an agent pane open in the corner"
						width="1600"
						height="900"
						fetchpriority="high"
					/>
				</a>
				<figcaption>The board, with an agent pane open bottom right.</figcaption>
			</figure>
		</section>

		<section id="views" class="strung" style="--c: var(--progress)" aria-labelledby="views-title">
			<header class="reveal">
				<span class="bead mark" aria-hidden="true"></span>
				<p class="label">01 / Views</p>
				<h2 id="views-title">Five views of the same issues</h2>
			</header>

			<div class="viewer">
				<fieldset class="tabs">
					<legend class="sr-only">Choose a view</legend>
					{#each views as view, i}
						<label style="--c: var(--{view.tone})">
							<input type="radio" name="view" value={view.name} checked={i === 0} />
							<span class="bead" aria-hidden="true"></span>
							<span class="tab-name">{view.name}</span>
						</label>
					{/each}
				</fieldset>

				{#each views as view}
					<article class="panel" style="--c: var(--{view.tone})">
						<div class="panel-text">
							<h3>{view.name}</h3>
							<p>{view.desc}</p>
						</div>
						<figure class="plate wide">
							<a href="{base}/screenshots/{view.file}">
								<img
									src="{base}/screenshots/{view.file}"
									alt={view.alt}
									width="1600"
									height="900"
									loading="lazy"
								/>
							</a>
						</figure>
					</article>
				{/each}
			</div>

			<div class="zen reveal">
				<h3>Zen focus review</h3>
				<p>
					A full-screen review of a list of issues, one at a time. Press <kbd>z</kbd> on a selected
					card, or run <code>strand zen proj-123,proj-456</code>. Cycle with <kbd>←</kbd>
					<kbd>→</kbd> or <kbd>h</kbd> <kbd>j</kbd> <kbd>k</kbd> <kbd>l</kbd>, open the detail pane
					with <kbd>Enter</kbd>, leave with <kbd>Esc</kbd>.
				</p>
			</div>
		</section>

		<section id="board" class="strung" style="--c: var(--hooked)" aria-labelledby="board-title">
			<header class="reveal">
				<span class="bead mark" aria-hidden="true"></span>
				<p class="label">02 / Board</p>
				<h2 id="board-title">Working the board</h2>
			</header>

			<dl class="facts cols-3 reveal">
				<div>
					<dt>Keyboard</dt>
					<dd>Drive the whole board with arrow keys or vim-style <kbd>h</kbd> <kbd>j</kbd> <kbd>k</kbd> <kbd>l</kbd>.</dd>
				</div>
				<div>
					<dt>Live updates</dt>
					<dd>The board updates when the CLI or an agent changes an issue. No refresh.</dd>
				</div>
				<div>
					<dt>Dependencies</dt>
					<dd>Link issues as parent, child or blocker, and see what blocks what.</dd>
				</div>
				<div>
					<dt>Search and filters</dt>
					<dd>Filter by text, priority, type, label, time and whether an issue is actionable.</dd>
				</div>
				<div>
					<dt>Notifications</dt>
					<dd>Browser push and desktop notifications when issues change.</dd>
				</div>
				<div>
					<dt>Deep links</dt>
					<dd><code>strand://issue-id</code> jumps straight to an issue on a running board.</dd>
				</div>
			</dl>
		</section>

		<section id="agents" class="strung" style="--c: var(--blocked)" aria-labelledby="agents-title">
			<header class="reveal">
				<span class="bead mark" aria-hidden="true"></span>
				<p class="label">03 / Agents</p>
				<h2 id="agents-title">Agents next to the board</h2>
			</header>

			<div class="agents-cols">
				<div class="reveal">
					<p class="lead">
						Run agent sessions in panes beside the board and hand them tickets. Pick the provider
						in Settings.
					</p>
					<ul class="providers" aria-label="Agent providers">
						<li><span class="bead" style="--c: var(--progress)" aria-hidden="true"></span>Claude</li>
						<li><span class="bead" style="--c: var(--closed)" aria-hidden="true"></span>Codex</li>
						<li><span class="bead" style="--c: var(--open)" aria-hidden="true"></span>OpenCode</li>
					</ul>
					<dl class="facts">
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
				</div>

				<figure class="queue reveal">
					<div class="queue-head">
						<span>manager queue</span>
						<span>cap 3</span>
					</div>
					<ul>
						{#each queue as row}
							<li class={row.state}>
								<span class="bead" aria-hidden="true"></span>
								<code>{row.id}</code>
								<strong>{row.state}</strong>
								<span>{row.note}</span>
							</li>
						{/each}
					</ul>
					<figcaption>Illustration: five queued tickets with a cap of 3.</figcaption>
				</figure>
			</div>
		</section>

		<section id="install" class="strung" style="--c: var(--closed)" aria-labelledby="install-title">
			<header class="reveal">
				<span class="bead mark" aria-hidden="true"></span>
				<p class="label">04 / Install</p>
				<h2 id="install-title">Three commands to a board</h2>
			</header>

			<ol class="steps reveal">
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

			<p class="aside reveal">
				To try it once without installing: <code>npx github:doublej/strandkanban /path/to/project</code>.
				Agent panes need an <code>ANTHROPIC_API_KEY</code>; the rest of the board works without one.
			</p>

			<div class="usage reveal">
				<h3>Daily use</h3>
				<dl>
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
		<span class="bead knot" aria-hidden="true"></span>
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
		scroll-behavior: smooth;
		-webkit-text-size-adjust: 100%;
	}

	:global(body) {
		--ground: #15110d;
		--ground-2: #1e1812;
		--ground-3: #2a2219;
		--line: #40362a;
		--thread: #cdbb9a;
		--text: #f3ead9;
		--muted: #b9ac95;
		--open: #5b8cff;
		--progress: #f2a33a;
		--hooked: #a97bff;
		--blocked: #f0584a;
		--closed: #3ec48b;
		--serif: 'Fraunces', Georgia, 'Times New Roman', serif;
		--mono: 'Martian Mono', ui-monospace, Menlo, Consolas, monospace;

		margin: 0;
		color: var(--text);
		background:
			radial-gradient(90rem 50rem at 100% -10%, rgb(242 163 58 / 0.09), transparent 60%),
			radial-gradient(70rem 50rem at -20% 45%, rgb(91 140 255 / 0.06), transparent 60%),
			url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 .95 0 0 0 0 .85 0 0 0 .05 0'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E"),
			var(--ground);
		font-family: var(--serif);
		font-size: 1.125rem;
		line-height: 1.6;
		font-variation-settings: 'SOFT' 50;
		-webkit-font-smoothing: antialiased;
		overflow-x: hidden;
	}

	:global(:focus-visible) {
		outline: 2px solid var(--progress);
		outline-offset: 3px;
		border-radius: 3px;
	}

	.page {
		--pad: clamp(16px, 4vw, 48px);
		--gutter: clamp(30px, 6vw, 92px);
		--thread-x: calc(9px - var(--gutter));
		position: relative;
		max-width: 1320px;
		margin-inline: auto;
		padding-inline: calc(var(--pad) + var(--gutter)) var(--pad);
	}

	/* The strand: one thread down the page, every section a bead on it. */
	.page::before,
	.page::after {
		content: '';
		position: absolute;
		top: 0;
		bottom: 0;
		left: calc(var(--pad) + 9px);
		width: 1.5px;
		margin-left: -0.75px;
		background: var(--thread);
	}

	.page::before {
		opacity: 0.22;
	}

	.page::after {
		transform-origin: top;
	}

	.bead {
		display: inline-block;
		flex: none;
		width: var(--size, 18px);
		aspect-ratio: 1;
		border-radius: 50%;
		background:
			radial-gradient(circle at 34% 30%, rgb(255 255 255 / 0.85) 0 7%, rgb(255 255 255 / 0) 27%),
			radial-gradient(
				circle at 40% 35%,
				color-mix(in oklab, var(--c, var(--thread)) 78%, white),
				var(--c, var(--thread)) 48%,
				color-mix(in oklab, var(--c, var(--thread)) 55%, black) 100%
			);
		box-shadow:
			0 0 0 4px var(--ground),
			0 0 26px color-mix(in oklab, var(--c, var(--thread)) 50%, transparent);
	}

	.skip {
		position: absolute;
		left: 12px;
		top: -100px;
		z-index: 10;
		padding: 10px 14px;
		background: var(--text);
		color: var(--ground);
		font: 500 0.8rem var(--mono);
	}

	.skip:focus {
		top: 12px;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}

	a {
		color: inherit;
		text-decoration: underline;
		text-decoration-color: var(--thread);
		text-decoration-thickness: 1px;
		text-underline-offset: 0.22em;
	}

	a:hover {
		text-decoration-color: var(--progress);
		text-decoration-thickness: 2px;
	}

	code,
	kbd,
	pre {
		font-family: var(--mono);
		font-stretch: 82%;
		font-size: 0.78em;
	}

	:not(pre) > code {
		padding: 0.15em 0.4em;
		border-radius: 4px;
		background: var(--ground-3);
		color: var(--text);
		overflow-wrap: anywhere;
	}

	kbd {
		display: inline-block;
		min-width: 1.9em;
		padding: 0.1em 0.45em;
		border: 1px solid var(--line);
		border-bottom-width: 3px;
		border-radius: 6px;
		background: var(--ground-2);
		text-align: center;
		line-height: 1.5;
	}

	pre {
		margin: 0;
		padding: 16px 18px;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
		border: 1px solid var(--line);
		border-radius: 10px;
		background: #0e0b08;
		color: var(--text);
		font-size: 0.8rem;
		line-height: 1.9;
	}

	.prompt {
		color: var(--thread);
		opacity: 0.6;
		user-select: none;
	}

	.label {
		margin: 0 0 18px;
		color: var(--muted);
		font: 500 0.72rem / 1.4 var(--mono);
		font-stretch: 88%;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.aside {
		max-width: 44rem;
		color: var(--muted);
		font-size: 1rem;
	}

	h1,
	h2,
	h3 {
		margin: 0;
		font-weight: 700;
		font-variation-settings: 'SOFT' 100;
		text-wrap: balance;
	}

	h1 {
		max-width: 10em;
		font-size: clamp(2.9rem, 9vw, 7.75rem);
		font-weight: 800;
		line-height: 0.94;
		letter-spacing: -0.035em;
	}

	.full-stop {
		display: inline-block;
		width: 0.2em;
		aspect-ratio: 1;
		margin-left: 0.06em;
		border-radius: 50%;
		background:
			radial-gradient(circle at 34% 30%, rgb(255 255 255 / 0.8) 0 8%, rgb(255 255 255 / 0) 28%),
			var(--closed);
		box-shadow: 0 0 40px rgb(62 196 139 / 0.6);
	}

	h2 {
		max-width: 14em;
		font-size: clamp(2.1rem, 5vw, 4rem);
		line-height: 1;
		letter-spacing: -0.025em;
	}

	h3 {
		font-size: 1.4rem;
		line-height: 1.15;
		letter-spacing: -0.01em;
	}

	/* Top bar */
	.top {
		position: relative;
		z-index: 2;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 10px 24px;
		padding-block: 26px;
		font: 500 0.78rem var(--mono);
		font-stretch: 88%;
	}

	.brand {
		position: relative;
		font-weight: 700;
		font-size: 0.9rem;
		letter-spacing: -0.01em;
		text-decoration: none;
	}

	.brand .bead {
		position: absolute;
		left: var(--thread-x);
		top: 50%;
		translate: -50% -50%;
	}

	.top nav,
	footer nav {
		display: flex;
		flex-wrap: wrap;
		gap: 6px 22px;
	}

	.top nav a,
	footer nav a {
		padding-block: 6px;
		color: var(--muted);
		text-decoration-color: transparent;
	}

	.top nav a:hover,
	footer nav a:hover {
		color: var(--text);
		text-decoration-color: var(--progress);
	}

	/* Hero */
	.hero {
		padding-block: clamp(40px, 8vw, 104px) 0;
	}

	.hero-cols {
		display: grid;
		grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
		gap: clamp(24px, 5vw, 72px);
		align-items: end;
		margin-top: clamp(28px, 4vw, 52px);
	}

	.lead {
		max-width: 36rem;
		margin: 0;
		font-size: clamp(1.15rem, 1.6vw, 1.4rem);
		line-height: 1.5;
	}

	.install-card {
		position: relative;
		z-index: 1;
	}

	.install-card pre {
		border-radius: 10px 10px 0 0;
		border-bottom: 0;
	}

	.install-meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 10px 16px;
		padding: 10px 10px 10px 18px;
		border: 1px solid var(--line);
		border-radius: 0 0 10px 10px;
		background: var(--ground-2);
		color: var(--muted);
		font-size: 0.92rem;
	}

	button {
		padding: 9px 14px;
		border: 1px solid var(--thread);
		border-radius: 999px;
		background: transparent;
		color: var(--text);
		font: 500 0.72rem var(--mono);
		font-stretch: 88%;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		cursor: pointer;
		transition:
			background 0.15s,
			color 0.15s;
	}

	button:hover {
		background: var(--thread);
		color: var(--ground);
	}

	/* Status rod: a horizontal branch off the strand */
	.rod-wrap {
		margin-top: clamp(56px, 9vw, 120px);
	}

	.rod {
		--size: 30px;
		position: relative;
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		gap: 12px;
		margin: 0 0 28px;
		padding: 0;
		list-style: none;
	}

	.rod::before {
		content: '';
		position: absolute;
		left: var(--thread-x);
		right: calc(-1 * var(--pad));
		top: 15px;
		height: 1.5px;
		margin-top: -0.75px;
		background: linear-gradient(90deg, var(--thread), rgb(205 187 154 / 0.15));
	}

	.rod li {
		position: relative;
		display: grid;
		justify-items: start;
		gap: 6px;
	}

	.rod .bead {
		margin-bottom: 12px;
	}

	.rod-name {
		font-size: clamp(1.05rem, 1.8vw, 1.5rem);
		font-weight: 600;
		font-variation-settings: 'SOFT' 100;
		line-height: 1.1;
	}

	.rod code {
		padding: 0;
		background: none;
		color: var(--c);
		font-size: 0.72rem;
	}

	/* Screenshot plates. Wide ones cover the thread, as if it passes behind. */
	.plate {
		position: relative;
		z-index: 1;
		margin: 0;
	}

	.plate.wide {
		margin-left: calc(-1 * var(--gutter));
	}

	.plate a {
		display: block;
		border-radius: 12px;
	}

	.plate img {
		display: block;
		width: 100%;
		height: auto;
		border-radius: 12px;
		box-shadow:
			0 0 0 1px rgb(255 255 255 / 0.14),
			0 0 0 7px var(--ground-2),
			0 0 0 8px var(--line),
			0 50px 90px -30px #000;
	}

	figcaption {
		margin-top: 22px;
		padding-left: var(--gutter);
		color: var(--muted);
		font: 400 0.72rem var(--mono);
		font-stretch: 88%;
	}

	.hero .plate {
		margin-top: clamp(40px, 6vw, 72px);
	}

	/* Sections strung on the thread */
	.strung {
		position: relative;
		padding-top: clamp(88px, 13vw, 184px);
		scroll-margin-top: -40px;
	}

	.strung > header {
		margin-bottom: clamp(32px, 5vw, 60px);
	}

	.mark {
		--size: 22px;
		position: absolute;
		left: var(--thread-x);
		translate: -50% -3px;
	}

	/* View switcher: radio inputs, no script */
	.tabs {
		--size: 20px;
		position: relative;
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		max-width: 46rem;
		margin: 0 0 36px;
		padding: 0;
		border: 0;
	}

	.tabs::before {
		content: '';
		position: absolute;
		left: var(--thread-x);
		right: 0;
		top: 18px;
		height: 1.5px;
		margin-top: -0.75px;
		background: var(--thread);
		opacity: 0.5;
	}

	.tabs label {
		position: relative;
		display: grid;
		justify-items: start;
		gap: 12px;
		padding: 8px 8px 8px 0;
		border-radius: 6px;
		color: var(--muted);
		font: 500 0.78rem var(--mono);
		font-stretch: 88%;
		cursor: pointer;
	}

	.tabs input {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}

	.tabs .bead {
		background: var(--ground);
		box-shadow:
			inset 0 0 0 2px var(--c, var(--thread)),
			0 0 0 4px var(--ground);
		transition: scale 0.2s cubic-bezier(0.3, 1.6, 0.5, 1);
	}

	.tabs label:hover {
		color: var(--text);
	}

	.tabs label:hover .bead {
		scale: 1.15;
	}

	.tabs label:has(input:checked) {
		color: var(--text);
	}

	.tabs input:checked + .bead {
		scale: 1.3;
		background:
			radial-gradient(circle at 34% 30%, rgb(255 255 255 / 0.85) 0 7%, rgb(255 255 255 / 0) 27%),
			radial-gradient(
				circle at 40% 35%,
				color-mix(in oklab, var(--c, var(--thread)) 78%, white),
				var(--c, var(--thread)) 48%,
				color-mix(in oklab, var(--c, var(--thread)) 55%, black) 100%
			);
		box-shadow:
			0 0 0 4px var(--ground),
			0 0 26px color-mix(in oklab, var(--c, var(--thread)) 60%, transparent);
	}

	.tabs label:has(input:focus-visible) {
		outline: 2px solid var(--progress);
		outline-offset: 3px;
	}

	.panel + .panel {
		margin-top: 72px;
	}

	.panel-text {
		display: grid;
		grid-template-columns: 9rem minmax(0, 38rem);
		gap: 8px 24px;
		align-items: baseline;
		margin-bottom: 32px;
	}

	.panel-text h3 {
		color: var(--c);
	}

	.panel-text p {
		margin: 0;
	}

	/* Without :has() every panel stays visible, stacked. */
	@supports selector(:has(*)) {
		.panel {
			display: none;
			margin-top: 0;
		}

		.viewer:has(label:nth-of-type(1) input:checked) .panel:nth-of-type(1),
		.viewer:has(label:nth-of-type(2) input:checked) .panel:nth-of-type(2),
		.viewer:has(label:nth-of-type(3) input:checked) .panel:nth-of-type(3),
		.viewer:has(label:nth-of-type(4) input:checked) .panel:nth-of-type(4),
		.viewer:has(label:nth-of-type(5) input:checked) .panel:nth-of-type(5) {
			display: block;
		}
	}

	.zen {
		display: grid;
		grid-template-columns: 14rem minmax(0, 40rem);
		gap: 10px 32px;
		align-items: baseline;
		margin-top: clamp(48px, 7vw, 88px);
		padding-top: 28px;
		border-top: 1px solid var(--line);
	}

	.zen p {
		margin: 0;
	}

	/* Fact lists */
	.facts {
		display: grid;
		gap: 0;
		margin: 0;
	}

	.facts > div {
		padding: 22px 0;
		border-top: 1px solid var(--line);
	}

	.facts dt {
		margin-bottom: 6px;
		font-size: 1.3rem;
		font-weight: 650;
		font-variation-settings: 'SOFT' 100;
		line-height: 1.2;
	}

	.facts dd {
		margin: 0;
		color: var(--muted);
	}

	.facts.cols-3 {
		grid-template-columns: repeat(3, minmax(0, 1fr));
		column-gap: clamp(24px, 4vw, 56px);
	}

	/* Agents */
	.agents-cols {
		display: grid;
		grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
		gap: clamp(32px, 6vw, 88px);
		align-items: start;
	}

	.providers {
		--size: 14px;
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		margin: 28px 0 36px;
		padding: 0;
		list-style: none;
	}

	.providers li {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 8px 16px 8px 14px;
		border: 1px solid var(--line);
		border-radius: 999px;
		background: var(--ground-2);
		font: 500 0.8rem var(--mono);
		font-stretch: 88%;
	}

	.providers .bead {
		box-shadow: 0 0 14px color-mix(in oklab, var(--c, var(--thread)) 50%, transparent);
	}

	.queue {
		--size: 12px;
		margin: 0;
		border: 1px solid var(--line);
		border-radius: 12px;
		background: #0e0b08;
		font: 400 0.74rem var(--mono);
		font-stretch: 82%;
		box-shadow: 0 40px 80px -40px #000;
	}

	.queue-head {
		display: flex;
		justify-content: space-between;
		padding: 14px 18px;
		border-bottom: 1px solid var(--line);
		color: var(--muted);
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.queue ul {
		margin: 0;
		padding: 6px 0;
		list-style: none;
	}

	.queue li {
		display: grid;
		grid-template-columns: 12px 5.2em 5em minmax(0, 1fr);
		gap: 14px;
		align-items: center;
		padding: 11px 18px;
		color: var(--muted);
	}

	.queue code {
		padding: 0;
		background: none;
		font-size: inherit;
	}

	.queue strong {
		font-weight: 600;
	}

	.queue .bead {
		box-shadow: none;
	}

	.queue .claimed {
		--c: var(--progress);
	}

	.queue .claimed strong {
		color: var(--progress);
	}

	.queue .skipped strong {
		color: var(--blocked);
	}

	.queue .skipped .bead,
	.queue .waiting .bead {
		background: none;
		box-shadow: inset 0 0 0 1.5px currentColor;
	}

	.queue .skipped .bead {
		color: var(--blocked);
	}

	.queue figcaption {
		margin: 0;
		padding: 14px 18px;
		border-top: 1px solid var(--line);
	}

	/* Install */
	.steps {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: clamp(20px, 3vw, 40px);
		margin: 0 0 36px;
		padding: 0;
		list-style: none;
		counter-reset: step;
	}

	.steps li {
		display: grid;
		align-content: start;
		gap: 14px;
		counter-increment: step;
	}

	.steps h3::before {
		content: counter(step);
		display: inline-grid;
		place-items: center;
		width: 1.9em;
		aspect-ratio: 1;
		margin-right: 12px;
		border-radius: 50%;
		background: var(--closed);
		color: var(--ground);
		font: 700 0.8rem var(--mono);
		vertical-align: 0.2em;
	}

	.steps p {
		margin: 0;
		color: var(--muted);
		font-size: 1rem;
	}

	.usage {
		margin-top: clamp(48px, 7vw, 80px);
	}

	.usage dl {
		margin: 20px 0 0;
	}

	.usage dl > div {
		display: grid;
		grid-template-columns: minmax(0, 24rem) minmax(0, 1fr);
		gap: 4px 32px;
		align-items: baseline;
		padding: 14px 0;
		border-top: 1px solid var(--line);
	}

	.usage dt code {
		padding: 0;
		background: none;
		font-size: 0.8rem;
	}

	.usage dd {
		margin: 0;
		color: var(--muted);
		font-size: 1rem;
	}

	footer {
		position: relative;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 12px 32px;
		margin-top: clamp(88px, 13vw, 184px);
		padding-block: 36px 96px;
		border-top: 1px solid var(--line);
		font: 400 0.78rem var(--mono);
		font-stretch: 88%;
	}

	footer p {
		margin: 0;
		color: var(--muted);
	}

	/* The strand ends at the knot: hide the thread below it. */
	footer::after {
		content: '';
		position: absolute;
		left: calc(var(--thread-x) - 4px);
		top: 0;
		bottom: 0;
		z-index: 1;
		width: 8px;
		background: var(--ground);
	}

	.knot {
		--size: 12px;
		position: absolute;
		z-index: 2;
		left: var(--thread-x);
		top: 0;
		translate: -50% -50%;
	}

	@media (max-width: 860px) {
		.hero-cols,
		.agents-cols,
		.steps,
		.facts.cols-3 {
			grid-template-columns: minmax(0, 1fr);
		}

		.hero-cols {
			align-items: start;
		}

		.panel-text,
		.zen,
		.usage dl > div {
			grid-template-columns: minmax(0, 1fr);
		}

		/* On small screens the status beads sit on the strand itself. */
		.rod {
			--size: 22px;
			grid-template-columns: minmax(0, 1fr);
			gap: 18px;
		}

		.rod::before {
			display: none;
		}

		.rod li {
			grid-template-columns: auto auto;
			justify-content: start;
			align-items: baseline;
			gap: 12px;
		}

		.rod .bead {
			position: absolute;
			left: var(--thread-x);
			top: 50%;
			margin: 0;
			translate: -50% -50%;
		}

		.rod-name {
			font-size: 1.25rem;
		}

		.tabs label {
			font-size: 0.68rem;
		}

		pre {
			padding: 14px;
			font-size: 0.69rem;
			font-stretch: 75%;
		}

		.queue li {
			grid-template-columns: 12px 5.2em minmax(0, 1fr);
		}

		.queue li span:last-child {
			grid-column: 2 / -1;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		:global(html) {
			scroll-behavior: auto;
		}

		.tabs .bead,
		button {
			transition: none;
		}
	}

	@media (prefers-reduced-motion: no-preference) {
		.rise {
			animation: rise 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) var(--d, 0ms) backwards;
		}

		/* Beads slide along the rod into place, the far one first. */
		.rod li {
			animation: slide 0.9s cubic-bezier(0.2, 0.9, 0.25, 1) calc(500ms + (4 - var(--i)) * 90ms) backwards;
		}

		@supports (animation-timeline: view()) {
			.page::after {
				animation: draw linear both;
				animation-timeline: scroll(root);
			}

			.reveal {
				animation: rise linear both;
				animation-timeline: view();
				animation-range: entry 0% cover 22%;
			}
		}
	}

	@keyframes rise {
		from {
			opacity: 0;
			translate: 0 26px;
		}
	}

	@keyframes slide {
		from {
			opacity: 0;
			translate: calc(-60px - var(--i) * 70px) 0;
		}
	}

	@keyframes draw {
		from {
			scale: 1 0.04;
		}
	}
</style>
