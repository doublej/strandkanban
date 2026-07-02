<script lang="ts">
	import { columns } from '$lib/utils';

	// A shimmering placeholder of the kanban layout, shown while issues load.
	// Card counts per column are cosmetic — just enough to imply a populated board.
	const cardCounts = [4, 3, 2, 2, 3];
</script>

<div class="skeleton-board" aria-hidden="true">
	{#each columns as col, i}
		<div class="skeleton-column">
			<div class="skeleton-col-header">
				<span class="skeleton-dot" style="--dot: {col.accent}"></span>
				<span class="skeleton-col-title">{col.label}</span>
			</div>
			<div class="skeleton-cards">
				{#each Array(cardCounts[i % cardCounts.length]) as _, c}
					<div class="skeleton-card" style="animation-delay: {(i * 60 + c * 90)}ms">
						<div class="skeleton-line w-80"></div>
						<div class="skeleton-line w-55"></div>
						<div class="skeleton-meta">
							<div class="skeleton-chip"></div>
							<div class="skeleton-chip w-30"></div>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/each}
</div>

<style>
	.skeleton-board {
		display: flex;
		gap: 1rem;
		padding: 1.25rem;
		width: 100%;
		height: 100%;
		overflow: hidden;
	}

	.skeleton-column {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.skeleton-col-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0 0.25rem;
	}

	.skeleton-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--dot, var(--text-tertiary));
		opacity: 0.6;
	}

	.skeleton-col-title {
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--text-tertiary);
	}

	.skeleton-cards {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
	}

	.skeleton-card {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.75rem;
		border-radius: var(--radius-md, 8px);
		background: var(--bg-secondary);
		border: 1px solid var(--border-subtle);
		animation: cardPulse 1.4s ease-in-out infinite;
	}

	.skeleton-line,
	.skeleton-chip {
		height: 0.625rem;
		border-radius: 4px;
		background: linear-gradient(
			90deg,
			var(--bg-tertiary) 25%,
			var(--bg-elevated) 50%,
			var(--bg-tertiary) 75%
		);
		background-size: 200% 100%;
		animation: shimmer 1.6s linear infinite;
	}

	.skeleton-line.w-80 { width: 80%; }
	.skeleton-line.w-55 { width: 55%; }

	.skeleton-meta {
		display: flex;
		gap: 0.375rem;
		margin-top: 0.125rem;
	}

	.skeleton-chip {
		width: 2.5rem;
		height: 0.75rem;
		border-radius: 999px;
	}

	.skeleton-chip.w-30 { width: 1.5rem; }

	@keyframes shimmer {
		from { background-position: 200% 0; }
		to { background-position: -200% 0; }
	}

	@keyframes cardPulse {
		0%, 100% { opacity: 0.55; }
		50% { opacity: 0.85; }
	}
</style>
