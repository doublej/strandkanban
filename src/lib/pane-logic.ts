import type { Issue } from './types';
import { calendarDay } from './utils';

/** Long-text fields that are edited with an explicit Save/Cancel (everything else saves on change). */
export type DraftField = 'description' | 'design' | 'acceptance_criteria' | 'notes';

export interface TextDraft {
	base: string;
	value: string;
}

export type Drafts = Partial<Record<DraftField, TextDraft>>;

export type LabelUpdate = Partial<Issue> & { addLabels: string[]; removeLabels: string[] };

/** True when any open text draft differs from the value it started from. */
export function hasDirtyDrafts(drafts: Drafts): boolean {
	return Object.values(drafts).some((d) => d !== undefined && d.value !== d.base);
}

/**
 * The open issue as the pane shows it: board-list fields (live, optimistic) win; detail-only
 * fields the slim list omits (design, notes, metadata, refs) come from the panel's full read.
 */
export function mergeLiveIssue(detail: Issue, list: Issue[]): Issue {
	const live = list.find((i) => i.id === detail.id);
	return live ? { ...detail, ...live } : detail;
}

export function normalizeLabel(raw: string): string {
	return raw.trim().toLowerCase();
}

/** PATCH payload for a label change; `labels` is the optimistic value, add/remove is what bd applies. */
export function labelUpdate(before: string[], after: string[]): LabelUpdate {
	return {
		labels: after,
		addLabels: after.filter((l) => !before.includes(l)),
		removeLabels: before.filter((l) => !after.includes(l))
	};
}

/** `<input type="date">` value (YYYY-MM-DD) for a stored date-only value; see calendarDay. */
export function toDateInput(iso?: string): string {
	if (!iso) return '';
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return '';
	const day = calendarDay(d);
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
}

/** Minutes from the estimate field: empty clears (0), negatives clamp to 0, fractions round. */
export function parseEstimate(raw: string): number {
	const n = Number(raw);
	if (raw.trim() === '' || !Number.isFinite(n)) return 0;
	return Math.max(0, Math.round(n));
}

/** Allowed characters for both halves of an operational state (`bd set-state`). */
export const STATE_PART = /^[A-Za-z0-9_-]+$/;

/** Display label for an issue type ("bug" → "Bug"); bd stores types lower-case. */
export function typeLabel(type: string): string {
	return type.charAt(0).toUpperCase() + type.slice(1);
}

/** Open `blocks` links only: parent/child and discovered-from links don't stop work. */
export function openBlockerCount(issue: Issue): number {
	return (issue.dependencies ?? []).filter((d) => d.dependency_type === 'blocks' && d.status !== 'closed').length;
}

/** Header chip text for a getDueInfo label: "Due today", "Due in 2d", "Due Oct 20", "3d late". */
export function dueChipLabel(label: string): string {
	if (label.endsWith('late')) return label;
	return /^\d+d$/.test(label) ? `Due in ${label}` : `Due ${label}`;
}
