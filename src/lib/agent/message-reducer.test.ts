import { test, expect } from 'bun:test';
import { reduceServerMessage, reduceStream, type SessionSnapshot } from './message-reducer';
import type { ChatMessage } from '../stores/ws-types';

const empty = (messages: ChatMessage[] = []): SessionSnapshot => ({
	messages,
	currentDelta: '',
	currentThinking: '',
});

test('text deltas accumulate onto currentDelta', () => {
	const s = empty();
	const first = reduceStream(s, {
		type: 'stream_event',
		event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hel' } },
	});
	expect(first).toEqual({ currentDelta: 'Hel' });

	const next = reduceStream({ ...s, currentDelta: 'Hel' }, {
		type: 'stream_event',
		event: { type: 'content_block_delta', delta: { type: 'thinking_delta', thinking: 'hm' } },
	});
	expect(next).toEqual({ currentThinking: 'hm' });
});

test('done flushes pending delta and thinking into messages', () => {
	const s: SessionSnapshot = { messages: [], currentDelta: 'answer', currentThinking: 'reasoning' };
	const patch = reduceServerMessage(s, {
		type: 'done',
		result: { subtype: 'success', total_cost_usd: 0.12, num_turns: 3 },
	})!;
	expect(patch.messages!.map((m) => [m.role, m.content, m.thinking ?? false])).toEqual([
		['assistant', 'reasoning', true],
		['assistant', 'answer', false],
	]);
	expect(patch.streaming).toBe(false);
	expect(patch.currentDelta).toBe('');
	expect(patch.lastRun).toMatchObject({ subtype: 'success', costUsd: 0.12, numTurns: 3, denials: 0 });
});

test('a dead server session clears serverId, a normal error keeps it', () => {
	const s = { ...empty(), serverId: 'abc' };
	expect(reduceServerMessage(s, { type: 'error', error: 'Session not found' })!.serverId).toBeUndefined();
	expect(reduceServerMessage(s, { type: 'error', error: 'rate limited' })!.serverId).toBe('abc');
});

test('messages without session state reduce to null', () => {
	expect(reduceServerMessage(empty(), { type: 'active_sessions', cwd: null, sessions: [] })).toBeNull();
	expect(reduceServerMessage(empty(), { type: 'queue_state', items: [] })).toBeNull();
});

test('a multi-block assistant message keeps every block', () => {
	const patch = reduceStream(empty(), {
		type: 'assistant',
		message: {
			content: [
				{ type: 'thinking', thinking: 'why' },
				{ type: 'text', text: 'because' },
				{ type: 'tool_use', name: 'Read', id: 'tu_1', input: { file: 'a.ts' } },
			],
		},
	})!;
	expect(patch.messages!.map((m) => m.content)).toEqual(['why', 'because', 'Using Read']);
	expect(patch.messages![2].toolUseId).toBe('tu_1');
});

test('tool results back-patch by tool id, not by arrival order', () => {
	const withCalls = reduceStream(empty(), {
		type: 'assistant',
		message: {
			content: [
				{ type: 'tool_use', name: 'Read', id: 'tu_1' },
				{ type: 'tool_use', name: 'Grep', id: 'tu_2' },
			],
		},
	})!;
	const s = empty(withCalls.messages);

	// tu_1 answers first. Matching "the last tool without a result" would put it on Grep.
	const patched = reduceServerMessage(s, { type: 'tool_result', tool_use_id: 'tu_1', result: 'file body' })!;
	expect(patched.messages!.map((m) => m.toolResult)).toEqual(['file body', undefined]);
});

test('duplicate user echoes are not appended twice', () => {
	const s = empty([{ role: 'user', content: 'hi' }]);
	expect(reduceStream(s, { type: 'user', message: { content: 'hi' } })).toBeNull();
	expect(reduceStream(s, { type: 'user', message: { content: 'yo' } })!.messages).toHaveLength(2);
});
