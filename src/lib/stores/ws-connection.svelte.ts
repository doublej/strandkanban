// Connection entry point. Socket plumbing lives in ./ws-socket.svelte,
// per-session commands in ./ws-commands; both are re-exported here so the
// public surface of this module (and of $lib/wsStore.svelte) is unchanged.
import {
	getSessions,
	getSessionSockets,
	getServerAvailable,
	setServerAvailable,
	getIsTabLeader,
	setDiscoveredSessionCallback,
	setSessionGoneCallback,
} from './agent-sessions.svelte';
import { tabCoordinator } from '../tabCoordinator';
import { initTabCoordinator } from './tab-coordinator.svelte';
import { isManagerSession, getManagerVisible } from './manager.svelte';
import { fetchInitialQueue, setQueueWsSender } from './queue.svelte';
import { checkServerHealth, getServerProject, resumeSession } from './ws-socket.svelte';
import { startManager } from './ws-commands';

export {
	setServerProject,
	getServerProject,
	resumeSession,
} from './ws-socket.svelte';

export {
	internalActions,
	startSession,
	sendMessage,
	interrupt,
	setModel,
	setPermissionMode,
	killSession,
	endSession,
	clearSession,
	continueSession,
	compactSession,
	injectNotification,
	addPane,
	removePane,
	clearAllSessions,
	sendToPane,
	getRunningSessionsForCwd,
	startManager,
	switchManagerProject,
	forceKillManager,
} from './ws-commands';

let checkTimer: ReturnType<typeof setTimeout> | null = null;

export function connect() {
	if (typeof window === 'undefined') return;

	initTabCoordinator();

	// Wire up queue WS sender — uses the first available socket
	setQueueWsSender((msg) => {
		for (const [, ws] of getSessionSockets()) {
			if (ws.readyState === WebSocket.OPEN) {
				ws.send(JSON.stringify(msg));
				return;
			}
		}
	});

	// Wire up session-gone callback for auto-restart
	setSessionGoneCallback((sessionName) => {
		if (isManagerSession(sessionName) && getManagerVisible()) {
			// Manager session expired — auto-restart it
			console.log('[agent:manager] session expired, auto-restarting');
			const session = getSessions().get(sessionName);
			if (session?.cwd) {
				setTimeout(() => startManager(session.cwd!), 100);
			}
		}
	});

	setDiscoveredSessionCallback((sessionName) => {
		if (!getIsTabLeader()) return;
		setTimeout(() => resumeSession(sessionName), 0);
	});

	checkServerHealth().then((ok) => {
		setServerAvailable(ok);
		if (ok && getIsTabLeader()) {
			const project = getServerProject();
			if (project) {
				fetchInitialQueue(9347, project);
			}
			for (const [name, session] of getSessions()) {
				if (session.serverId && !session.streaming) {
					resumeSession(name);
				}
			}
		}
	});

	if (!checkTimer) {
		checkTimer = setInterval(() => {
			if (!getServerAvailable() && getIsTabLeader()) {
				checkServerHealth().then((ok) => setServerAvailable(ok));
			}
		}, 5000);
	}
}

export function disconnect() {
	if (checkTimer) {
		clearInterval(checkTimer);
		checkTimer = null;
	}
	for (const [, ws] of getSessionSockets()) {
		ws.close();
	}
	getSessionSockets().clear();
	setServerAvailable(false);
	tabCoordinator.destroy();
}

export function isConnected() { return getServerAvailable(); }
export function getConnected() { return getServerAvailable(); }
export function getPanes() { return getSessions(); }
export function isLeaderTab() { return getIsTabLeader(); }
