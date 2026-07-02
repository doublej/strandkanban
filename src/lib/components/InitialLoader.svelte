<script lang="ts">
	import type { LoadingStatus } from '$lib/types';
	import SkeletonBoard from './SkeletonBoard.svelte';

	let {
		status,
		visible,
		projectName = ''
	}: { status: LoadingStatus; visible: boolean; projectName?: string } = $props();

	const phaseMessages: Record<string, string> = {
		disconnected: 'Starting up…',
		connecting: 'Connecting to project…',
		loading: 'Loading issues…',
		ready: 'Ready',
		error: 'Connection failed'
	};
</script>

{#if visible}
<div class="loader" class:ready={status.phase === 'ready'} class:entering={status.phase === 'disconnected'}>
	<div class="skeleton-bg">
		<SkeletonBoard />
	</div>

	<div class="content">
		<div class="spinner" class:error={status.phase === 'error'}></div>

		<div class="info">
			{#if projectName}
				<p class="project">{projectName}</p>
			{/if}
			<p class="message">{phaseMessages[status.phase] ?? 'Loading…'}</p>

			{#if status.issueCount > 0}
				<p class="detail">{status.issueCount} issues loaded</p>
			{/if}

			{#if status.phase === 'error' && status.errorMessage}
				<p class="error-detail">{status.errorMessage}</p>
			{/if}
		</div>
	</div>
</div>
{/if}

<style>
	.loader {
		position: fixed;
		inset: 0;
		z-index: 9999;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--bg-tertiary, #18181b);
		transition: opacity 0.3s ease;
		/* Prevent content shift during 3D transforms */
		transform: translateZ(0);
		backface-visibility: hidden;
	}

	.loader.entering {
		animation: loaderFadeIn 200ms ease-out forwards;
	}

	@keyframes loaderFadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	.loader.ready {
		opacity: 0;
		pointer-events: none;
	}

	.skeleton-bg {
		position: absolute;
		inset: 0;
		opacity: 0.4;
		pointer-events: none;
		mask-image: radial-gradient(ellipse 70% 60% at 50% 45%, transparent 30%, #000 85%);
		-webkit-mask-image: radial-gradient(ellipse 70% 60% at 50% 45%, transparent 30%, #000 85%);
	}

	.content {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 20px;
		padding: 28px 40px;
		border-radius: 16px;
		background: color-mix(in srgb, var(--bg-secondary, #1c1c1f) 70%, transparent);
		border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
		box-shadow: var(--shadow-lg, 0 20px 60px rgba(0, 0, 0, 0.4));
		backdrop-filter: blur(12px);
	}

	.project {
		font-family: 'Inter', -apple-system, sans-serif;
		font-size: 15px;
		font-weight: 600;
		color: var(--text-primary, #fff);
		margin-bottom: 2px;
	}

	.spinner {
		width: 32px;
		height: 32px;
		border: 2px solid var(--border-subtle, rgba(255,255,255,0.08));
		border-top-color: var(--accent-primary, #0a84ff);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	.spinner.error {
		border-top-color: #ef4444;
		animation: none;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.info {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
	}

	.message {
		font-family: 'Inter', -apple-system, sans-serif;
		font-size: 14px;
		font-weight: 500;
		color: var(--text-primary, #fff);
	}

	.detail {
		font-family: 'Inter', -apple-system, sans-serif;
		font-size: 12px;
		color: var(--text-tertiary, #636366);
	}

	.error-detail {
		font-family: 'Inter', -apple-system, sans-serif;
		font-size: 12px;
		color: #ef4444;
		max-width: 300px;
		text-align: center;
	}
</style>
