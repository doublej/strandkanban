// Session state CRUD and persistence
import { untrack } from 'svelte';
import {
	loadSessions,
	saveSessions,
	persistSdkSessionId,
	clearPersistedSdkSessionId,
} from '../session-persistence';
import type {
	AgentSession,
	ActiveRemoteSession,
	ServerMessage,
	SystemMessageSubtype,
} from './ws-types';
import { makeMsg, isSessionGoneError, reduceServerMessage } from '../agent/message-reducer';
import { setQueueItems } from './queue.svelte';

// --- Shared state ---
let sessions = $state<Map<string, AgentSession>>(loadSessions());
let sessionSockets = new Map<string, WebSocket>();
let serverAvailable = $state(false);
let isTabLeader = $state(false);

// Callback set by ws-connection to broadcast to followers
let broadcastCallback: (() => void) | null = null;
// Callback for when a session is gone (server returned "Session not found")
let sessionGoneCallback: ((sessionName: string) => void) | null = null;
// Callback for when a backend-only session is discovered and should be resumed by the leader tab
let discoveredSessionCallback: ((sessionName: string) => void) | null = null;

export function setBroadcastCallback(cb: () => void) {
	broadcastCallback = cb;
}

export function setSessionGoneCallback(cb: (sessionName: string) => void) {
	sessionGoneCallback = cb;
}

export function setDiscoveredSessionCallback(cb: (sessionName: string) => void) {
	discoveredSessionCallback = cb;
}

// --- Getters / setters for shared state ---
export function getSessions(): Map<string, AgentSession> { return sessions; }
export function setSessions(s: Map<string, AgentSession>) { sessions = s; }

export function getSessionSockets(): Map<string, WebSocket> { return sessionSockets; }

export function getServerAvailable(): boolean { return serverAvailable; }
export function setServerAvailable(v: boolean) { serverAvailable = v; }

export function getIsTabLeader(): boolean { return isTabLeader; }
export function setIsTabLeader(v: boolean) { isTabLeader = v; }

// --- Auto-save effect ---
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
if (typeof window !== 'undefined') {
	$effect.root(() => {
		$effect(() => {
			const _ = sessions.size;
			if (saveTimeout) clearTimeout(saveTimeout);
			saveTimeout = setTimeout(() => untrack(() => saveSessions(sessions)), 100);
		});
	});
}

// --- Session CRUD ---
export function updateSession(name: string, updates: Partial<AgentSession>) {
	const session = sessions.get(name);
	if (!session) return;
	sessions.set(name, { ...session, ...updates });
	sessions = new Map(sessions);
	if (isTabLeader && broadcastCallback) {
		broadcastCallback();
	}
}

/**
 * Adds a system message to an existing session.
 * Used for progress updates and status messages.
 */
export function addSystemMessage(
	sessionName: string,
	content: string,
	subtype: SystemMessageSubtype = 'info'
) {
	const session = sessions.get(sessionName);
	if (!session) return;

	updateSession(sessionName, {
		messages: [...session.messages, makeMsg('system', content, { systemSubtype: subtype })]
	});
}

/**
 * Marks session as errored and adds error message.
 * Disables streaming to prevent further input.
 */
export function setSessionError(sessionName: string, errorMessage: string) {
	const session = sessions.get(sessionName);
	if (!session) return;

	updateSession(sessionName, {
		streaming: false,
		error: true,
		errorMessage,
		messages: [...session.messages, makeMsg('system', `Error: ${errorMessage}`, { systemSubtype: 'error' })]
	});
}

function applySessions(next: Map<string, AgentSession>) {
	sessions = next;
	if (isTabLeader && broadcastCallback) {
		broadcastCallback();
	}
}

function syncActiveSessions(scopeCwd: string | null, activeSessions: ActiveRemoteSession[]) {
	const next = new Map(sessions);
	const activeNames = new Set(activeSessions.map((session) => session.name));
	const discoveredToResume: string[] = [];

	for (const remote of activeSessions) {
		const existing = next.get(remote.name);
		if (existing) {
			next.set(remote.name, {
				...existing,
				cwd: remote.cwd,
				projectCwd: remote.projectCwd ?? existing.projectCwd,
				serverId: remote.sessionId,
				streaming: remote.isRunning || existing.streaming,
				ticketId: remote.ticketId ?? existing.ticketId,
				worktreePath: remote.worktreePath ?? existing.worktreePath,
				isManager: remote.isManager,
			});
			continue;
		}

		if (remote.isManager) continue;

		next.set(remote.name, {
			id: crypto.randomUUID(),
			name: remote.name,
			cwd: remote.cwd,
			projectCwd: remote.projectCwd,
			streaming: false,
			messages: [],
			currentDelta: '',
			pane_type: 'agent',
			backend: 'claude',
			ticketId: remote.ticketId,
			worktreePath: remote.worktreePath,
			serverId: remote.sessionId,
			isManager: remote.isManager,
			discoveredFromServer: true,
		});
		discoveredToResume.push(remote.name);
	}

	// Only prune discovered sessions within the broadcast scope (same cwd).
	// Sessions from other projects are filtered out server-side, so their absence
	// here doesn't mean they stopped streaming.
	for (const [name, session] of next) {
		if (!session.discoveredFromServer) continue;
		if (activeNames.has(name)) continue;
		const sessionProjectCwd = session.projectCwd ?? session.cwd;
		if (scopeCwd && sessionProjectCwd !== scopeCwd) continue;
		next.set(name, { ...session, streaming: false });
	}

	applySessions(next);

	for (const sessionName of discoveredToResume) {
		discoveredSessionCallback?.(sessionName);
	}
}

// --- Message handler factory ---
// State reduction lives in $lib/agent/message-reducer (pure, tested).
// Everything below is the side effects that reduction can't own.
export function createMessageHandler(sessionName: string) {
	return (event: MessageEvent) => {
		const msg = JSON.parse(event.data) as ServerMessage;
		console.log(`[agent:${sessionName}] recv`, msg.type);

		if (msg.type === 'active_sessions') {
			syncActiveSessions(msg.cwd, msg.sessions);
			return;
		}
		if (msg.type === 'queue_state') {
			setQueueItems(msg.items as any[]);
			return;
		}

		const session = sessions.get(sessionName);
		if (!session) return;

		const patch = reduceServerMessage(session, msg);
		if (patch) updateSession(sessionName, patch);

		switch (msg.type) {
			case 'session_resumed':
				// Populate history from SDK session JSONL if messages are empty
				if (msg.sdkSessionId && session.messages.length === 0 && session.cwd) {
					loadHistory(sessionName, session.cwd, msg.sdkSessionId);
				}
				return;
			case 'sdk_session':
				persistSdkSessionId(sessionName, msg.sdkSessionId);
				return;
			case 'session_cleared':
				clearPersistedSdkSessionId(sessionName);
				return;
			case 'error':
				if (isSessionGoneError(msg.error)) sessionGoneCallback?.(sessionName);
				return;
		}
	};
}

function loadHistory(sessionName: string, cwd: string, sdkSessionId: string) {
	import('../session-persistence').then(({ fetchSessionHistory }) => {
		fetchSessionHistory(cwd, sdkSessionId).then((messages) => {
			if (messages.length === 0) return;
			const current = sessions.get(sessionName);
			if (!current || current.messages.length > 0) return;
			updateSession(sessionName, { messages });
		});
	});
}
