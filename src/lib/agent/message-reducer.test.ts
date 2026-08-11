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

test('duplicate user echoes are not appended twice', () => {
	const s = empty([{ role: 'user', content: 'hi' }]);
	expect(reduceStream(s, { type: 'user', message: { content: 'hi' } })).toBeNull();
	expect(reduceStream(s, { type: 'user', message: { content: 'yo' } })!.messages).toHaveLength(2);
});
