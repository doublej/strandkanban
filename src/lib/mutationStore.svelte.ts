import type { MutationEntry } from './types';
import { appendProjectParam } from './project';

let mutations = $state<MutationEntry[]>([]);
let loading = $state(false);
let unsupported = $state(false);

export async function fetchMutations(limit = 100): Promise<void> {
	if (loading) return;
	loading = true;
	try {
		const res = await fetch(appendProjectParam(`/api/events?limit=${limit}`));
		if (res.ok) {
			// Responses are envelope-wrapped ({ ok, data }); tolerate a bare body too.
			const body = await res.json();
			mutations = body.data?.events ?? body.events ?? [];
			unsupported = body.data?.unsupported ?? false;
		}
	} finally {
		loading = false;
	}
}

export function getMutations(): MutationEntry[] {
	return mutations;
}

export function clearMutations() {
	mutations = [];
}

export function formatMutation(m: MutationEntry): string {
	const id = `#${m.ticketId.slice(-6)}`;

	switch (m.mutationType) {
		case 'created':
			return `${id} created`;
		case 'closed':
			return `${id} closed`;
		case 'status':
			return `${id} ${m.previousValue} → ${m.newValue}`;
		case 'priority':
			return `${id} priority: ${m.previousValue} → ${m.newValue}`;
		case 'assignee':
			return `${id} assigned to ${m.newValue}`;
		case 'comment':
			return `${id} new comment`;
		case 'dependency': {
			const val = m.newValue || '';
			if (val.startsWith('+')) return `${id} → #${val.slice(-6)}`;
			if (val.startsWith('-')) return `${id} ✕ #${val.slice(-6)}`;
			return `${id} deps changed`;
		}
		case 'label': {
			const val = m.newValue || '';
			if (val.startsWith('+')) return `${id} labeled [${val.slice(1)}]`;
			if (val.startsWith('-')) return `${id} unlabeled [${val.slice(1)}]`;
			return `${id} label changed`;
		}
		case 'title':
			return `${id} renamed: "${m.previousValue}" → "${m.newValue}"`;
		default:
			return `${id} ${m.field}: ${m.previousValue} → ${m.newValue}`;
	}
}

export function useMutations() {
	return {
		get value() { return mutations; },
		get recent() { return mutations.slice(0, 50); },
		get loading() { return loading; },
		get unsupported() { return unsupported; }
	};
}
