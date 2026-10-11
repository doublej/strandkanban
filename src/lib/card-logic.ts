import type { Issue, Dependency } from './types';
import { parseStateLabels } from './utils';
import { openBlocks } from './pane-logic';

/**
 * How a card names a linked issue: `#seq` when it is on this board, `project:cap` for
 * `external:project:cap` refs, else the short hash of a foreign id. The full id goes in a tooltip.
 */
export function depRef(id: string, seqById: Map<string, number>): string {
	const seq = seqById.get(id);
	if (seq) return `#${seq}`;
	if (id.startsWith('external:')) return id.slice('external:'.length);
	const dash = id.lastIndexOf('-');
	return dash > 0 ? id.slice(dash + 1) : id;
}

export type RelationIcon = 'alert-circle' | 'dep-blocks' | 'dep-parent';

export interface Relation {
	text: string;
	tone: 'danger' | 'muted';
	icon: RelationIcon;
	title: string;
}

/** One line for the card, most urgent first: open blockers, then what it unblocks, then its parent. */
export function relationSummary(issue: Issue, seqById: Map<string, number>): Relation | null {
	const ref = (d: Dependency) => depRef(d.id, seqById);
	const list = (deps: Dependency[]) => deps.map((d) => `${ref(d)} ${d.title}`).join('\n');
	const phrase = (verb: string, deps: Dependency[]) =>
		deps.length === 1 ? `${verb} ${ref(deps[0])}` : `${verb} ${deps.length}`;

	const blockers = openBlocks(issue.dependencies);
	if (blockers.length) {
		return { text: phrase('Blocked by', blockers), tone: 'danger', icon: 'alert-circle', title: `Blocked by:\n${list(blockers)}` };
	}
	const blocking = openBlocks(issue.dependents);
	if (blocking.length) {
		return { text: phrase('Blocks', blocking), tone: 'muted', icon: 'dep-blocks', title: `Blocks:\n${list(blocking)}` };
	}
	const parent = issue.dependencies?.find((d) => d.dependency_type === 'parent-child');
	if (parent) {
		return { text: `Child of ${ref(parent)}`, tone: 'muted', icon: 'dep-parent', title: `Child of ${list([parent])}` };
	}
	return null;
}

export interface CardLabel {
	text: string;
	key?: string;
}

/** State labels (`key:value`, split like the pane) lead, then plain labels. */
export function cardLabels(labels?: string[]): CardLabel[] {
	const { states, plain } = parseStateLabels(labels);
	return [...states.map((s) => ({ key: s.dimension, text: s.value })), ...plain.map((text) => ({ text }))];
}

/** Items of a one-line wrapping row that fell onto a hidden line, from each item's offsetTop. */
export function wrappedCount(tops: number[]): number {
	return tops.filter((t) => t > tops[0]).length;
}
