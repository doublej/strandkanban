// Manager agent UI state - scoped per project
import { browser } from '$app/environment';

const MANAGER_PREFIX = '__manager__';

let currentManagerProject = $state<string | null>(null);
let isManagerVisible = $state(
	browser ? localStorage.getItem('managerVisible') === 'true' : false
);

/** Generate session name for a project's manager */
export function getManagerSessionName(projectPath: string): string {
	// Create a short hash of the path for readability while ensuring uniqueness
	const hash = projectPath.replace(/\//g, '-').replace(/^-/, '').slice(-40);
	return `${MANAGER_PREFIX}${hash}`;
}

/** Check if a session name is a manager session */
export function isManagerSession(sessionName: string): boolean {
	return sessionName.startsWith(MANAGER_PREFIX);
}

export function getManagerVisible(): boolean {
	return isManagerVisible;
}

export function setManagerVisible(v: boolean) {
	isManagerVisible = v;
	if (browser) localStorage.setItem('managerVisible', String(v));
}

export function toggleManagerVisibility() {
	setManagerVisible(!isManagerVisible);
}

export function getCurrentManagerProject(): string | null {
	return currentManagerProject;
}

export function setCurrentManagerProject(projectPath: string | null) {
	currentManagerProject = projectPath;
}
