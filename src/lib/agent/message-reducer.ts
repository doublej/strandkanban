// Pure reduction of agent-server messages into session-state patches.
// No runes, no I/O, no callbacks — everything here is testable in isolation.
// Side effects (history fetch, sdk-session persistence, session-gone restart)
// stay in the caller; see stores/agent-sessions.svelte.ts.
import type {
	AgentSession,
	AssistantMessage,
	ChatMessage,
	FileDiff,
	RunModelUsage,
	ServerMessage,
	StreamEvent,
	SystemMessageSubtype,
	ToolCallEvent,
	ToolResult,
	ToolResultEvent,
} from '../stores/ws-types';

/** The slice of session state a reduction may read. */
export type SessionSnapshot = Pick<
	AgentSession,
	'messages' | 'currentDelta' | 'currentThinking' | 'capabilities' | 'permissionMode' | 'serverId'
>;

export type StreamPayload =
	| StreamEvent
	| AssistantMessage
	| ToolResult
	| ToolCallEvent
	| ToolResultEvent
	| { type: string };

export type SessionPatch = Partial<AgentSession>;

export function makeMsg(
	role: ChatMessage['role'],
	content: string,
	extra: Partial<ChatMessage> = {}
): ChatMessage {
	return { role, content, timestamp: new Date().toISOString(), ...extra };
}

/** A dead server session needs a reconnect, not just an error message. */
export function isSessionGoneError(error: string | undefined): boolean {
	return !!error && (error.includes('Session not found') || error.includes('No active session'));
}

/**
 * Reduces one ServerMessage to a state patch, or null when the message carries
 * no session state (`active_sessions`, `queue_state`) or changes nothing.
 */
export function reduceServerMessage(s: SessionSnapshot, msg: ServerMessage): SessionPatch | null {
	switch (msg.type) {
		// --- Flat provider events ---
		case 'session':
			return { sdkSessionId: msg.sdkSessionId, slashCommands: msg.slashCommands };

		case 'capabilities':
			return {
				capabilities: {
					models: msg.models ?? [],
					mcpServers: msg.mcpServers ?? [],
					currentModel: msg.currentModel,
					permissionMode: msg.permissionMode,
					tools: msg.tools,
					plugins: msg.plugins,
				},
				permissionMode: msg.permissionMode ?? s.permissionMode,
			};

		case 'text_delta':
			return { currentDelta: s.currentDelta + msg.text };

		case 'thinking_delta':
			return { currentThinking: (s.currentThinking ?? '') + msg.thinking };

		case 'text':
			return { messages: [...s.messages, makeMsg('assistant', msg.text)], currentDelta: '' };

		case 'thinking':
			return {
				messages: [...s.messages, makeMsg('assistant', msg.thinking, { thinking: true })],
				currentThinking: '',
			};

		case 'user_text':
			return reduceUserText(s, msg.text);

		case 'tool_call':
			return {
				messages: [
					...s.messages,
					makeMsg('tool', `Using ${msg.tool_name}`, {
						toolName: msg.tool_name,
						toolInput: msg.input,
						toolUseId: msg.id,
					}),
				],
				currentDelta: '',
			};

		case 'tool_result': {
			const messages = backPatchToolResult(s.messages, msg.tool_use_id, msg.result);
			return messages === s.messages ? null : { messages };
		}

		case 'notice':
			return {
				messages: [...s.messages, makeMsg('system', msg.content, { systemSubtype: msg.subtype })],
				// compact_boundary used to arrive as its own `compacted` message.
				...(msg.subtype === 'compact_done' && { compacted: true }),
			};

		case 'turn_done':
			return finishTurn(s, msg, msg.diffs);

		// --- Session lifecycle (agent server, not the provider) ---
		case 'session_started':
		case 'session_resumed':
			return { serverId: msg.sessionId, streaming: true };

		case 'sdk_session':
			return { sdkSessionId: msg.sdkSessionId, slashCommands: msg.slashCommands };

		case 'agent_capabilities':
			return {
				capabilities: {
					models: msg.models ?? [],
					mcpServers: msg.mcpServers ?? [],
					currentModel: msg.currentModel,
					permissionMode: msg.permissionMode,
					tools: msg.tools,
					plugins: msg.plugins,
				},
				permissionMode: msg.permissionMode ?? s.permissionMode,
			};

		case 'model_changed':
			return {
				capabilities: s.capabilities ? { ...s.capabilities, currentModel: msg.model } : undefined,
			};

		case 'permission_mode_changed':
			return {
				permissionMode: msg.mode,
				capabilities: s.capabilities ? { ...s.capabilities, permissionMode: msg.mode } : undefined,
			};

		case 'compacted':
			return { compacted: true };

		case 'system_message':
			return { messages: [...s.messages, makeMsg('system', msg.content, { systemSubtype: msg.subtype })] };

		case 'usage':
			return {
				usage: {
					inputTokens: msg.inputTokens,
					outputTokens: msg.outputTokens,
					cacheRead: msg.cacheRead,
					cacheCreation: msg.cacheCreation,
				},
			};

		case 'session_ended':
			return { streaming: false, serverId: undefined };

		case 'session_cleared':
			return {
				messages: [],
				currentDelta: '',
				currentThinking: '',
				sdkSessionId: undefined,
				compacted: false,
			};

		// --- Legacy wire (pre-provider-events) ---
		// DELETABLE once every long-lived agent daemon on :9347 has restarted onto
		// a build that emits flat AgentEvents. Kept so a new bundle still renders
		// against an old daemon, which sends no version and would otherwise go
		// silent mid-run.
		case 'stream':
			return reduceStream(s, msg.data);

		case 'done':
			return finishTurn(s, msg.result, msg.diffs);

		case 'error':
			return {
				streaming: false,
				serverId: isSessionGoneError(msg.error) ? undefined : s.serverId,
				messages: [...s.messages, makeMsg('assistant', `Error: ${msg.error}`)],
			};

		case 'interrupted':
			return { streaming: false, messages: [...s.messages, makeMsg('assistant', '[Interrupted]')] };
	}
	return null;
}

type TurnResult = {
	subtype: string;
	total_cost_usd?: number;
	num_turns?: number;
	modelUsage?: Record<string, RunModelUsage>;
	permission_denials?: unknown[];
	errors?: string[];
};

/** Flushes the streaming preview into real messages and records the run summary. */
function finishTurn(s: SessionSnapshot, r: TurnResult, diffs?: FileDiff[]): SessionPatch {
	let messages = s.messages;
	if (s.currentThinking) messages = [...messages, makeMsg('assistant', s.currentThinking, { thinking: true })];
	if (s.currentDelta) messages = [...messages, makeMsg('assistant', s.currentDelta)];
	return {
		streaming: false,
		messages,
		currentDelta: '',
		currentThinking: '',
		cost: r.total_cost_usd,
		diffs,
		lastRun: {
			subtype: r.subtype,
			numTurns: r.num_turns,
			costUsd: r.total_cost_usd,
			modelUsage: r.modelUsage,
			denials: Array.isArray(r.permission_denials) ? r.permission_denials.length : 0,
			errors: r.errors,
		},
	};
}

/**
 * Reduces a `stream`-wrapped payload from a pre-provider-events daemon.
 * DELETABLE alongside the `stream` case above.
 */
export function reduceStream(s: SessionSnapshot, data: StreamPayload): SessionPatch | null {
	if (data.type === 'stream_event') {
		const ev = (data as StreamEvent).event;
		if (ev.type !== 'content_block_delta') return null;
		if (ev.delta?.type === 'text_delta' && ev.delta.text) {
			return { currentDelta: s.currentDelta + ev.delta.text };
		}
		if (ev.delta?.type === 'thinking_delta' && ev.delta.thinking) {
			return { currentThinking: (s.currentThinking ?? '') + ev.delta.thinking };
		}
		return null;
	}

	if (data.type === 'tool_call') {
		const call = data as ToolCallEvent;
		return {
			messages: [
				...s.messages,
				makeMsg('tool', `Using ${call.tool_name}`, { toolName: call.tool_name, toolInput: call.input }),
			],
			currentDelta: '',
		};
	}

	if (data.type === 'tool_result') {
		const result = data as ToolResultEvent;
		const idx = findLastIndex(s.messages, (m) => m.role === 'tool' && m.toolName === result.tool_name);
		return idx < 0 ? null : { messages: patchAt(s.messages, idx, { toolResult: result.result }) };
	}

	if (data.type === 'assistant') {
		const content = (data as AssistantMessage).message?.content;
		if (!Array.isArray(content)) return null;
		// Accumulate all blocks into one patch so a multi-block message
		// (thinking + text + tool_use) doesn't clobber itself via stale state.
		const added: ChatMessage[] = [];
		for (const block of content) {
			if (block.type === 'thinking' && block.thinking) {
				added.push(makeMsg('assistant', block.thinking, { thinking: true }));
			} else if (block.type === 'text' && block.text) {
				added.push(makeMsg('assistant', block.text));
			} else if (block.type === 'tool_use' && block.name) {
				added.push(
					makeMsg('tool', `Using ${block.name}`, {
						toolName: block.name,
						toolInput: block.input,
						toolUseId: block.id,
					})
				);
			}
		}
		if (added.length === 0) return null;
		return { messages: [...s.messages, ...added], currentDelta: '', currentThinking: '' };
	}

	if (data.type === 'user') {
		const raw = (data as ToolResult).message?.content;
		if (!raw) return null;

		let messages = s.messages;
		let changed = false;
		if (Array.isArray(raw)) {
			for (const block of raw) {
				if (block.type !== 'tool_result' || !block.tool_use_id) continue;
				messages = backPatchToolResult(messages, block.tool_use_id, block.text || '');
				changed = true;
			}
		}

		const content = Array.isArray(raw)
			? raw.filter((b) => b.type === 'text' && b.text).map((b) => b.text).join('\n')
			: typeof raw === 'string'
				? raw
				: String(raw);
		if (content && !messages.some((m) => m.role === 'user' && m.content === content)) {
			messages = [...messages, makeMsg('user', content)];
			changed = true;
		}
		return changed ? { messages } : null;
	}

	return null;
}

/** Appends a user message unless an identical one is already present. */
export function reduceUserText(s: SessionSnapshot, content: string): SessionPatch | null {
	if (s.messages.some((m) => m.role === 'user' && m.content === content)) return null;
	return { messages: [...s.messages, makeMsg('user', content)] };
}

/**
 * Attaches a tool result to the call it belongs to, matched by tool_use_id.
 * Falls back to the last unanswered tool call for payloads that carry no id.
 */
export function backPatchToolResult(
	messages: ChatMessage[],
	toolUseId: string,
	result: string
): ChatMessage[] {
	let idx = findLastIndex(messages, (m) => m.role === 'tool' && m.toolUseId === toolUseId);
	if (idx < 0) idx = findLastIndex(messages, (m) => m.role === 'tool' && !m.toolResult && !m.toolUseId);
	return idx < 0 ? messages : patchAt(messages, idx, { toolResult: result });
}

function patchAt(messages: ChatMessage[], idx: number, patch: Partial<ChatMessage>): ChatMessage[] {
	const next = [...messages];
	next[idx] = { ...next[idx], ...patch };
	return next;
}

function findLastIndex(messages: ChatMessage[], pred: (m: ChatMessage) => boolean): number {
	for (let i = messages.length - 1; i >= 0; i--) if (pred(messages[i])) return i;
	return -1;
}

export type { SystemMessageSubtype };
