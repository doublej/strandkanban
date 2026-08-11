// ponytail: timing coupled to Svelte flush + two hardcoded timers; if ghosts appear,
// the measure step is reading layout before the placeholder mounts.
import type { Issue } from '$lib/types';

type Rect = { x: number; y: number; w: number; h: number };

export interface StatusChange {
	id: string;
	newStatus: string;
}

export interface CardMeasurement {
	id: string;
	fromPos: Rect | null;
	toPos: Rect | null;
	newStatus: string;
	height: number;
}

function rectOf(el: HTMLElement | undefined): Rect | null {
	if (!el) return null;
	const rect = el.getBoundingClientRect();
	return { x: rect.left, y: rect.top, w: rect.width, h: rect.height };
}

/** Card teleport animation: measures the board, then flies a card to its new column. */
export function createBoardAnimation() {
	let teleports = $state<{ id: string; from: Rect; to: Rect; startTime: number }[]>([]);
	let placeholders = $state<{ id: string; targetColumn: string; height: number }[]>([]);
	let flyingCards = $state<Map<string, { from: Rect; to: Rect; issue: Issue }>>(new Map());
	let shrinkingSourceIds = $state<Set<string>>(new Set());
	let cardRefs = $state<Map<string, HTMLElement>>(new Map());
	let placeholderRefs = $state<Map<string, HTMLElement>>(new Map());

	function registerCard(node: HTMLElement, id: string) {
		cardRefs.set(id, node);
		return { destroy() { cardRefs.delete(id); } };
	}

	function registerPlaceholder(node: HTMLElement, id: string) {
		placeholderRefs.set(id, node);
		return { destroy() { placeholderRefs.delete(id); } };
	}

	function getCardPosition(id: string) {
		return rectOf(cardRefs.get(id));
	}

	function getPlaceholderPosition(id: string) {
		return rectOf(placeholderRefs.get(id));
	}

	/** Rendered height of a card, or a fallback when it isn't on screen. */
	function measureCardHeight(id: string): number {
		const cardEl = document.querySelector(`[data-card-id="${id}"]`);
		return cardEl?.getBoundingClientRect().height ?? 80;
	}

	function measureTargetPosition(targetColumn: string, height: number): Rect | null {
		// Find the column element
		const columnEl = document.querySelector(`[data-column-key="${targetColumn}"] .cards`);
		if (!columnEl) return null;

		// Create temporary hidden placeholder
		const tempPlaceholder = document.createElement('div');
		tempPlaceholder.style.height = `${height}px`;
		tempPlaceholder.style.visibility = 'hidden';
		tempPlaceholder.style.position = 'relative';

		// Inject, measure, remove
		columnEl.insertBefore(tempPlaceholder, columnEl.firstChild);
		const rect = tempPlaceholder.getBoundingClientRect();
		const pos = { x: rect.left, y: rect.top, w: rect.width, h: rect.height };
		columnEl.removeChild(tempPlaceholder);
		return pos;
	}

	function addPlaceholder(id: string, targetColumn: string, height: number) {
		if (!placeholders.some(p => p.id === id)) {
			placeholders = [...placeholders, { id, targetColumn, height }];
		}
	}

	function addFlyingCard(id: string, from: Rect, to: Rect, issue: Issue) {
		flyingCards.set(id, { from, to, issue });
		flyingCards = new Map(flyingCards);
	}

	function addTeleport(id: string, from: Rect, to: Rect) {
		teleports = [...teleports, { id, from, to, startTime: Date.now() }];
	}

	function addShrinkingSource(id: string) {
		shrinkingSourceIds.add(id);
		shrinkingSourceIds = new Set(shrinkingSourceIds);
	}

	function cleanupAnimation(id: string) {
		teleports = teleports.filter(t => t.id !== id);
		placeholders = placeholders.filter(p => p.id !== id);
		flyingCards.delete(id);
		flyingCards = new Map(flyingCards);
		shrinkingSourceIds.delete(id);
		shrinkingSourceIds = new Set(shrinkingSourceIds);
	}

	/**
	 * Step 1 — runs before the caller swaps in the new issue list: measure both ends
	 * of every move and start the source shrink / target expand.
	 */
	function measureStatusChanges(changes: StatusChange[]): CardMeasurement[] {
		// PRE-FLIGHT: Measure positions before any DOM changes
		const measurements = changes.map(({ id, newStatus }) => {
			const fromPos = getCardPosition(id);
			const height = measureCardHeight(id);
			const toPos = measureTargetPosition(newStatus, height);
			return { id, fromPos, toPos, newStatus, height };
		});

		// START ANIMATIONS: Source shrink + target expand
		for (const { id, newStatus, height } of measurements) {
			addShrinkingSource(id);
			addPlaceholder(id, newStatus, height);
		}

		return measurements;
	}

	/** Step 2 — runs immediately after the caller swapped in the new issue list. */
	function flyStatusChanges(measurements: CardMeasurement[], getIssue: (id: string) => Issue | undefined) {
		// FLYING CARD: Delay 150ms for visual overlap
		setTimeout(() => {
			for (const { id, fromPos, toPos } of measurements) {
				if (toPos && fromPos) {
					const issue = getIssue(id);
					addFlyingCard(id, fromPos, toPos, issue!);
					addTeleport(id, fromPos, toPos);
				}
			}
		}, 150);

		// CLEANUP: Remove all animation artifacts
		setTimeout(() => {
			for (const { id } of measurements) {
				cleanupAnimation(id);
			}
		}, 750);
	}

	return {
		get teleports() { return teleports; },
		get placeholders() { return placeholders; },
		get flyingCards() { return flyingCards; },
		get shrinkingSourceIds() { return shrinkingSourceIds; },
		registerCard,
		registerPlaceholder,
		getCardPosition,
		getPlaceholderPosition,
		measureStatusChanges,
		flyStatusChanges
	};
}

export type BoardAnimation = ReturnType<typeof createBoardAnimation>;
