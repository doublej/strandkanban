<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import MutationLog from '$lib/components/MutationLog.svelte';
	import { fetchMutations } from '$lib/mutationStore.svelte';
	import { setCurrentProject } from '$lib/project';

	let { data } = $props();

	let isDarkMode = $state(true);

	$effect(() => {
		if (typeof window !== 'undefined') {
			const saved = localStorage.getItem('theme');
			isDarkMode = saved !== 'light';
		}
	});

	// Cold loads of /activity never touch the board, so the project scope must be
	// set here or the events request goes out unscoped.
	onMount(() => {
		setCurrentProject(data.cwd);
		fetchMutations(500);
	});
</script>

<svelte:head>
	<title>Activity - strandkanban</title>
</svelte:head>

<div class="page" class:light={!isDarkMode}>
	<header class="header">
		<a href="/" class="logo">
			<h1>strandkanban</h1>
		</a>
		<nav>
			<a href="/">Board</a>
			<a href="/activity" class="active">Activity</a>
			<a href="/about">About</a>
			<a href="/prompts">Prompts</a>
		</nav>
	</header>

	<main class="content">
		<MutationLog
			variant="page"
			show
			onclose={() => {}}
			onticketclick={(id) => goto(`/?issue=${id}`)}
		/>
	</main>
</div>

<style>
	:global(body) {
		margin: 0;
		font-family: 'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
	}

	.page {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		background: #0a0a0b;
		color: #e0e0e0;
	}

	.page.light {
		background: #f5f5f5;
		color: #1a1a1a;
	}

	.header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem 2rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
	}

	.page.light .header {
		border-bottom-color: rgba(0, 0, 0, 0.1);
	}

	.logo {
		text-decoration: none;
	}

	.logo h1 {
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
		font-size: 1.3rem;
		font-weight: 800;
		letter-spacing: -0.02em;
		color: rgba(255, 255, 255, 0.95);
		text-transform: lowercase;
		margin: 0;
	}

	.page.light .logo h1 {
		color: rgba(0, 0, 0, 0.9);
	}

	nav {
		display: flex;
		gap: 1.5rem;
	}

	nav a {
		color: rgba(255, 255, 255, 0.6);
		text-decoration: none;
		font-size: 0.875rem;
		transition: color 0.15s;
	}

	nav a:hover,
	nav a.active {
		color: rgba(255, 255, 255, 0.95);
	}

	.page.light nav a {
		color: rgba(0, 0, 0, 0.5);
	}

	.page.light nav a:hover,
	.page.light nav a.active {
		color: rgba(0, 0, 0, 0.9);
	}

	.content {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 0;
	}
</style>
