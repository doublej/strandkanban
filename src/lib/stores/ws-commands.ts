// Per-session commands: leader-tab implementations plus the public wrappers
// that forward to the leader when this tab is a follower.
import { tabCoordinator } from '../tabCoordinator';
import type { AgentSession, NotificationType } from './ws-types';
import { getSessions, setSessions, getIsTabLeader, updateSession } from './agent-sessions.svelte';
import { fetchSessionHistory } from '../session-persistence';
import {
	getOrCreateSocket,
	sendToSocket,
	sendWhenOpen,
	resumeSession,
	closeSocket,
} from './ws-socket.svelte';
import {
	getManagerSessionName,
	isManagerSession,
	setManagerVisible,
	getManagerVisible,
	getCurrentManagerProject,
	setCurrentManagerProject,
} from './manager.svelte';
import { settings } from './settings.svelte';

// --- Internal functions (called by leader tab) ---

async function startSessionInternal(name: string, cwd: string, briefing: string, systemPromptAppend?: string, resumeSessionId?: string, ticketId?: string, model?: string, isManager?: boolean) {
	console.log('[agent] startSession:', name, 'cwd:', cwd, resumeSessionId ? `resuming: ${resumeSessionId}` : '', ticketId ? `ticket: ${ticketId}` : '', isManager ? 'MANAGER' : '');

	const sessions = getSessions();
	const existing = sessions.get(name);
	const session: AgentSession = {
		id: crypto.randomUUID(),
		name,
		cwd,
		streaming: true,
		messages: existing?.messages ?? [],
		currentDelta: '',
		pane_type: 'agent',
		backend: 'claude',
		sdkSessionId: resumeSessionId,
		ticketId: ticketId ?? existing?.ticketId,
		isManager,
	};
	sessions.set(name, session);
	setSessions(new Map(sessions));

	// Populate history from SDK session JSONL when resuming with no existing messages
	if (resumeSessionId && session.messages.length === 0) {
		fetchSessionHistory(cwd, resumeSessionId).then((messages) => {
			if (messages.length === 0) return;
			const current = getSessions().get(name);
			if (!current || current.messages.length > 0) return; // Don't overwrite if streaming already added messages
			updateSession(name, { messages });
		});
	}

	const ws = await getOrCreateSocket(name);
	if (!ws) return;

	sendWhenOpen(name, ws, { type: 'start', cwd, agentName: name, briefing, systemPromptAppend, resumeSessionId, model, isManager });
}

function sendMessageInternal(name: string, text: string) {
	const session = getSessions().get(name);
	if (!session) return;

	updateSession(name, {
		messages: [...session.messages, {
			role: 'user',
			content: text,
			timestamp: new Date().toISOString()
		}]
	});

	sendToSocket(name, { type: 'message', text });
}

function interruptInternal(name: string) {
	sendToSocket(name, { type: 'interrupt' });
}

function killSessionInternal(name: string) {
	// Manager session: minimize instead of killing
	if (isManagerSession(name)) {
		setManagerVisible(false);
		return;
	}
	dropSession(name);
}

/** Interrupts if streaming, closes the socket, and forgets the session locally. */
function dropSession(name: string) {
	const sessions = getSessions();
	if (sessions.get(name)?.streaming) {
		sendToSocket(name, { type: 'interrupt' });
	}
	closeSocket(name);
	sessions.delete(name);
	setSessions(new Map(sessions));
}

export function startManager(cwd: string) {
	const sessionName = getManagerSessionName(cwd);

	// Check if there's already a manager for THIS project
	const existing = getSessions().get(sessionName);
	if (existing?.serverId) {
		// Already running with valid server session for this project — just show
		setCurrentManagerProject(cwd);
		setManagerVisible(true);
		return;
	}

	const model = settings.managerModel || undefined;
	setCurrentManagerProject(cwd);
	startSessionInternal(
		sessionName,
		cwd,
		'You are the Manager Agent. Await instructions from the user.',
		undefined,
		undefined,
		undefined,
		model,
		true
	);
	setManagerVisible(true);
}

/** Switch manager to a different project. Hides current manager and shows/starts the one for the new project. */
export function switchManagerProject(newCwd: string) {
	const currentProject = getCurrentManagerProject();
	if (currentProject === newCwd) return; // Same project, nothing to do

	// The old manager session stays alive (backgrounded), we just switch context
	setCurrentManagerProject(newCwd);

	// If manager is visible, switch to the new project's manager
	if (getManagerVisible()) {
		const newSessionName = getManagerSessionName(newCwd);
		const existingForNew = getSessions().get(newSessionName);

		if (existingForNew?.serverId) {
			// Resume existing session for new project
			resumeSession(newSessionName);
		} else {
			// Start fresh manager for new project
			startManager(newCwd);
		}
	}
}

export function forceKillManager() {
	const currentProject = getCurrentManagerProject();
	if (currentProject) {
		dropSession(getManagerSessionName(currentProject));
		setCurrentManagerProject(null);
	}
	setManagerVisible(false);
}

function endSessionInternal(name: string) {
	sendToSocket(name, { type: 'end' });
}

function clearSessionInternal(name: string) {
	sendToSocket(name, { type: 'clear' });
}

function continueSessionInternal(name: string, text = 'Continue.') {
	// The server reads `msg.text` as the turn prompt; omitting it restarted the agent
	// with `undefined`. ponytail: generic nudge — the original briefing isn't kept
	// server-side, so pass one explicitly here if a caller ever needs to resume with it.
	sendToSocket(name, { type: 'continue', text });
}

function compactSessionInternal(name: string) {
	sendToSocket(name, { type: 'compact' });
}

function setModelInternal(name: string, model?: string) {
	sendToSocket(name, { type: 'set_model', model });
}

function setPermissionModeInternal(name: string, mode: string) {
	sendToSocket(name, { type: 'set_permission_mode', mode });
}

function injectNotificationInternal(name: string, content: string, notificationType: NotificationType) {
	const session = getSessions().get(name);
	if (!session) return;

	updateSession(name, {
		messages: [...session.messages, {
			role: 'notification',
			content,
			notificationType,
			timestamp: new Date().toISOString()
		}]
	});

	sendToSocket(name, { type: 'inject_context', context: `[${notificationType.toUpperCase()}] ${content}` });
}

// Expose internal functions for tab-coordinator action handling
export const internalActions = {
	startSessionInternal,
	sendMessageInternal,
	interruptInternal,
	killSessionInternal,
	endSessionInternal,
	clearSessionInternal,
	continueSessionInternal,
	compactSessionInternal,
	setModelInternal,
	setPermissionModeInternal,
	injectNotificationInternal,
};

// --- Public functions (forward to leader if not leader) ---

function leaderOrForward<A extends unknown[]>(
	action: string,
	internal: (name: string, ...args: A) => void
): (name: string, ...args: A) => void {
	return (name, ...args) => {
		if (getIsTabLeader()) internal(name, ...args);
		else tabCoordinator.requestAction({ action, sessionName: name, args: args as unknown[] });
	};
}

export function startSession(name: string, cwd: string, briefing: string, systemPromptAppend?: string, resumeSessionId?: string, ticketId?: string, model?: string, isManager?: boolean) {
	if (getIsTabLeader()) {
		startSessionInternal(name, cwd, briefing, systemPromptAppend, resumeSessionId, ticketId, model, isManager);
	} else {
		tabCoordinator.requestAction({ action: 'startSession', sessionName: name, args: [cwd, briefing, systemPromptAppend, resumeSessionId, ticketId, model, isManager] });
	}
}

export const sendMessage = leaderOrForward('sendMessage', sendMessageInternal);
export const interrupt = leaderOrForward('interrupt', interruptInternal);
export const setModel = leaderOrForward('setModel', setModelInternal);
export const setPermissionMode = leaderOrForward('setPermissionMode', setPermissionModeInternal);
export const killSession = leaderOrForward('killSession', killSessionInternal);
export const endSession = leaderOrForward('endSession', endSessionInternal);
export const clearSession = leaderOrForward('clearSession', clearSessionInternal);
export const continueSession = leaderOrForward('continueSession', continueSessionInternal);
export const compactSession = leaderOrForward('compactSession', compactSessionInternal);
export const injectNotification = leaderOrForward('injectNotification', injectNotificationInternal);

export function addPane(name: string, cwd: string, firstMessage?: string, systemPrompt?: string, resumeSessionId?: string, ticketId?: string, model?: string) {
	const briefing = firstMessage ? firstMessage.replace('{name}', name) : `You are an agent named "${name}". Await further instructions.`;
	const prompt = systemPrompt ? systemPrompt.replace('{name}', name) : undefined;
	startSession(name, cwd, briefing, prompt, resumeSessionId, ticketId, model);
}

export function removePane(name: string) {
	killSession(name);
}

export function clearAllSessions() {
	for (const [name] of getSessions()) {
		killSession(name);
	}
}

export async function sendToPane(name: string, message: string, cwd: string) {
	console.log('[agent] sendToPane:', name, 'cwd:', cwd);
	const session = getSessions().get(name);

	if (!session) {
		startSession(name, cwd, message);
	} else if (!session.streaming) {
		updateSession(name, { streaming: true });
		if (getIsTabLeader()) {
			const ws = await getOrCreateSocket(name);
			if (!ws) return;
			sendWhenOpen(name, ws, { type: 'message', text: message });
		} else {
			tabCoordinator.requestAction({ action: 'sendMessage', sessionName: name, args: [message] });
		}
	} else {
		sendMessage(name, message);
	}
}

export function getRunningSessionsForCwd(cwd: string): string[] {
	const results: string[] = [];
	for (const [name, session] of getSessions()) {
		if (session.streaming && session.cwd === cwd && !session.isManager && !isManagerSession(name)) {
			results.push(name);
		}
	}
	return results;
}
