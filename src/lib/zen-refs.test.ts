import { describe, it, expect } from 'bun:test';
import { markCodeRefs } from './zen-refs';

describe('markCodeRefs', () => {
	it('wraps paths and file:line refs', () => {
		expect(markCodeRefs('see src/lib/db.ts:42 now')).toBe('see `src/lib/db.ts:42` now');
		expect(markCodeRefs('edit foo.svelte')).toBe('edit `foo.svelte`');
	});

	it('leaves prose, urls and existing code alone', () => {
		expect(markCodeRefs('the fix works. done')).toBe('the fix works. done');
		expect(markCodeRefs('fixes (65e3c83b/85c46f83) landed')).toBe('fixes (65e3c83b/85c46f83) landed');
		expect(markCodeRefs('via /api/rig/display?action=add now')).toBe(
			'via /api/rig/display?action=add now'
		);
		expect(markCodeRefs('https://x.com/a/b.html')).toBe('https://x.com/a/b.html');
		expect(markCodeRefs('`src/a.ts` and ```\nsrc/b.ts\n```')).toBe(
			'`src/a.ts` and ```\nsrc/b.ts\n```'
		);
	});
});
