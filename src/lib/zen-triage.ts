import type { Issue } from './types';
import type { IconName } from './components/Icon.svelte';

/**
 * Quick-triage actions for the Zen review overlay (Q). Each selection is
 * recorded as a `triage:<value>` operational-state label (bd set-state);
 * actions that carry a `priority` also reprioritize the issue.
 *
 * `angle` is the sector center in degrees (0 = right, -90 = up, clockwise
 * positive). Five equal 72° sectors cover the full circle so a swipe in any
 * direction maps to exactly one action.
 */
export interface TriageAction {
	value: string;
	label: string;
	hint: string;
	icon: IconName;
	color: string;
	priority?: Issue['priority'];
	angle: number;
}

export const triageActions: TriageAction[] = [
	{ value: 'now', label: 'I need it now', hint: 'P0 · Critical', icon: 'zap', color: '#ef4444', priority: 0, angle: -90 },
	{ value: 'important', label: 'Important', hint: 'P1 · High', icon: 'pin', color: '#f59e0b', priority: 1, angle: -18 },
	{ value: 'nice-to-have', label: 'Nice to have', hint: 'P3 · Low', icon: 'feature', color: '#10b981', priority: 3, angle: 54 },
	{ value: 'stale', label: 'Don’t remember / care', hint: 'P4 · Backlog', icon: 'circle-slash', color: '#6b7280', priority: 4, angle: 126 },
	{ value: 'unclear', label: 'Don’t understand', hint: 'Needs clarification', icon: 'help', color: '#6366f1', angle: 198 }
];

/** Nearest triage sector for a swipe vector (screen coords, +y down). */
export function findTriageSector(x: number, y: number): number {
	const deg = (Math.atan2(y, x) * 180) / Math.PI;
	let best = 0;
	let bestDist = Infinity;
	for (let i = 0; i < triageActions.length; i++) {
		const raw = Math.abs(deg - triageActions[i].angle) % 360;
		const dist = Math.min(raw, 360 - raw);
		if (dist < bestDist) {
			bestDist = dist;
			best = i;
		}
	}
	return best;
}
