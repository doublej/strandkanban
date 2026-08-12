// Socket lifecycle: health checks, per-session sockets, reconnect, follower broadcast.
import { tabCoordinator } from '../tabCoordinator';
import {
	getSessions,
	getSessionSockets,
	getIsTabLeader,
	setServerAvailable,
	setBroadcastCallback,
	updateSession,
	setSessionError,
	createMessageHandler,
} from './agent-sessions.svelte';
import { sendSetProject, setProjectPayload } from './queue.svelte';

let currentServerProject: string | null = null;

export function setServerProject(cwd: string) {
	currentServerProject = cwd;
	// Send via queue sender (picks first open socket); re-sent on any new socket via onopen.
	sendSetProject(cwd);
	// Also directly broadcast on all open sockets so every tab-local socket filters correctly.
	for (const [, ws] of getSessionSockets()) {
		if (ws.readyState === WebSocket.OPEN) {
			ws.send(JSON.stringify(setProjectPayload(cwd)));
		}
	}
}

export function getServerProject(): string | null {
	return currentServerProject;
}

function getWsUrl(): string {
	const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
	return `ws://${host}:9347`;
}

export async function checkServerHealth() {
	try {
		const res = await fetch('/api/agent/health');
		const payload = await res.json();
		return payload?.ok === true && payload.data?.healthy === true;
	} catch {
		return false;
	}
}

export async function getOrCreateSocket(sessionName: string): Promise<WebSocket | null> {
	if (!getIsTabLeader()) {
		console.log(`[agent:${sessionName}] not leader, skipping socket creation`);
		return null;
	}

	const sockets = getSessionSockets();
	let ws = sockets.get(sessionName);
	if (ws?.readyState === WebSocket.OPEN) return ws;

	if (ws) {
		ws.close();
		sockets.delete(sessionName);
	}

	// Check health before attempting WebSocket to avoid uncatchable console errors
	const healthy = await checkServerHealth();
	if (!healthy) {
		setSessionError(sessionName, 'Agent server not available. Start it with `bun run dev:agent`.');
		setServerAvailable(false);
		return null;
	}

	const socket = new WebSocket(getWsUrl());
	ws = socket;
	sockets.set(sessionName, socket);

	socket.onopen = () => {
		console.log(`[agent:${sessionName}] connected`);
		setServerAvailable(true);
		if (currentServerProject) {
			try {
				socket.send(JSON.stringify(setProjectPayload(currentServerProject)));
			} catch {}
		}
	};

	socket.onclose = () => {
		console.log(`[agent:${sessionName}] disconnected`);
		sockets.delete(sessionName);
		updateSession(sessionName, { streaming: false });
	};

	socket.onerror = () => {
		socket.close();
	};

	socket.onmessage = createMessageHandler(sessionName);

	return socket;
}

export function sendToSocket(sessionName: string, payload: Record<string, unknown>) {
	const ws = getSessionSockets().get(sessionName);
	if (ws?.readyState === WebSocket.OPEN) {
		console.log(`[agent:${sessionName}] send`, payload.type);
		ws.send(JSON.stringify(payload));
	}
}

/** Sends `payload` now if the socket is open, otherwise on its next open event. */
export function sendWhenOpen(name: string, ws: WebSocket, payload: Record<string, unknown>) {
	const send = () => sendToSocket(name, payload);
	if (ws.readyState === WebSocket.OPEN) send();
	else ws.addEventListener('open', send, { once: true });
}

// Resume a session that has a serverId
export async function resumeSession(name: string) {
	const session = getSessions().get(name);
	if (!session?.serverId) return;

	console.log(`[agent:${name}] resuming session`, session.serverId);

	const ws = await getOrCreateSocket(name);
	if (!ws) return;

	sendWhenOpen(name, ws, { type: 'resume', sessionId: session.serverId });
}

export function closeSocket(name: string) {
	const sockets = getSessionSockets();
	const ws = sockets.get(name);
	if (ws) {
		ws.close();
		sockets.delete(name);
	}
}

// --- Broadcast sessions to followers (debounced) ---
let broadcastTimeout: ReturnType<typeof setTimeout> | null = null;
function broadcastSessionsToFollowers() {
	if (broadcastTimeout) clearTimeout(broadcastTimeout);
	broadcastTimeout = setTimeout(() => {
		const arr = Array.from(getSessions().entries());
		tabCoordinator.broadcastState(arr);
	}, 50);
}

// Wired at module scope on purpose: updateSession calls the broadcast callback
// unconditionally, and a leader tab can mutate sessions before connect() resolves.
setBroadcastCallback(broadcastSessionsToFollowers);
