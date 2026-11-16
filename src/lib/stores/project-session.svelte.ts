import { browser } from '$app/environment';
import { untrack } from 'svelte';
import { pushState as svelteKitPushState } from '$app/navigation';
import { setCurrentProject, appendProjectParam } from '$lib/project';
import type { Issue, Project } from '$lib/types';
import { switchManagerProject, setServerProject } from '$lib/stores/ws-connection.svelte';
import { fetchInitialQueue } from '$lib/stores/queue.svelte';
import { toastQueue } from '$lib/notifications/toast-queue.svelte';

const WIPE_DURATION = 350;

export interface ProjectSessionContext {
	initialCwd: string;
	connectSse: () => void;
	closeSse: () => void;
	setIssues: (issues: Issue[]) => void;
	getWsConnected: () => boolean;
	/** Clear per-project UI (selection, open panel) mid-switch. */
	onSwitched: () => void;
}

/** Per-project repair pass (JSONL auto-export on, bd doctor); the server runs it once per project per run. */
async function repairProject(cwd: string) {
	const res = await fetch(`/api/health?project=${encodeURIComponent(cwd)}`, { method: 'POST' });
	const findings: { message?: string }[] = (await res.json())?.data?.doctor?.findings ?? [];
	if (findings.length) toastQueue.show({ type: 'warning', title: 'bd doctor', message: findings.map((f) => f.message).join(' · '), duration: 8000 });
}

/** Which project the board is pointed at, plus the SSE stream that feeds it. */
export function createProjectSession(ctx: ProjectSessionContext) {
	let projects = $state<Project[]>([]);
	let currentProjectPath = $state(ctx.initialCwd);
	let projectName = $state('');
	let projectColor = $state('#6366f1');
	let projectTransition = $state<'idle' | 'wipe-out' | 'wipe-in'>('idle');
	let switchStatus = $state<string | null>(null);

	async function initProject(urlProject: string | null) {
		let cwd: string;
		let name: string;

		if (urlProject) {
			// URL specifies the project — switch server default to match
			const res = await fetch('/api/cwd', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ path: urlProject })
			});
			const payload = await res.json();
			const data = payload?.ok ? payload.data : {};
			cwd = data.cwd || urlProject;
			name = data.name || cwd.split('/').pop() || 'project';
		} else {
			// No URL param — get current from server
			const res = await fetch('/api/cwd');
			const payload = await res.json();
			const data = payload?.ok ? payload.data : {};
			cwd = data.cwd;
			name = data.name || cwd.split('/').pop() || 'project';
			setCurrentProject(cwd);
		}

		projectName = name;
		currentProjectPath = cwd;

		const projRes = await fetch('/api/projects', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ path: cwd, name })
		});
		const projPayload = await projRes.json();
		const projData = projPayload?.ok ? projPayload.data : {};
		void repairProject(cwd);
		if (projData.projects) {
			projects = projData.projects;
			const current = projects.find((p: Project) => p.path === cwd);
			if (current) {
				projectColor = current.color;
				projectName = current.meta?.title || current.name || name;
			}
		}
	}

	async function switchProject(project: Project) {
		if (project.path === currentProjectPath) return;
		const targetName = project.meta?.title || project.name;
		switchStatus = `Switching to ${targetName}…`;
		projectTransition = 'wipe-out';
		// closeSse() also cancels any pending SSE reconnect, so a queued retry from
		// the old project can't resurrect its stream after the switch.
		ctx.closeSse();

		// Update frontend project context BEFORE API calls so appendProjectParam works
		setCurrentProject(project.path);
		currentProjectPath = project.path;

		// Switch manager to new project (if visible, it will auto-resume or start new session)
		switchManagerProject(project.path);

		// Flip backend fence to new project immediately so broadcasts filter correctly.
		setServerProject(project.path);
		fetchInitialQueue(9347, project.path);

		const [cwdRes] = await Promise.all([
			fetch('/api/cwd', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: project.path }) }),
			new Promise(r => setTimeout(r, WIPE_DURATION))
		]);
		if (!cwdRes.ok) { projectTransition = 'idle'; switchStatus = null; return; }
		void repairProject(project.path);
		switchStatus = 'Loading issues…';
		const issuesRes = await fetch(appendProjectParam('/api/issues'));
		const issuesPayload = await issuesRes.json();
		const issuesData = issuesPayload?.ok ? issuesPayload.data : { issues: [] };
		ctx.setIssues(issuesData.issues || []);
		projectName = project.meta?.title || project.name;
		projectColor = project.color;
		ctx.onSwitched();
		projectTransition = 'wipe-in';
		switchStatus = null;
		ctx.connectSse();

		// Update URL to include project param
		const url = new URL(window.location.href);
		url.searchParams.set('project', project.path);
		url.searchParams.delete('issue');
		svelteKitPushState(url.pathname + url.search, { project: project.path });

		await new Promise(r => setTimeout(r, WIPE_DURATION));
		projectTransition = 'idle';
	}

	/** True when the popped URL named a different project and a switch was started. */
	function handleProjectPopState(): boolean {
		const urlProject = new URL(window.location.href).searchParams.get('project');
		if (urlProject && urlProject !== currentProjectPath) {
			const project = projects.find(p => p.path === urlProject);
			if (project) switchProject(project);
			return true;
		}
		return false;
	}

	// --- Lifecycle effects ---
	$effect(() => {
		untrack(() => ctx.connectSse());
		return () => ctx.closeSse();
	});

	// Keep backend fenced to the current project: re-send set_project whenever
	// connection comes up or the current project changes. Also seed the queue.
	$effect(() => {
		if (!browser) return;
		if (!ctx.getWsConnected()) return;
		if (!currentProjectPath) return;
		setServerProject(currentProjectPath);
		fetchInitialQueue(9347, currentProjectPath);
	});

	$effect(() => {
		if (!browser) return;
		const urlProject = new URL(window.location.href).searchParams.get('project');
		initProject(urlProject);
	});

	return {
		get projects() { return projects; },
		get currentProjectPath() { return currentProjectPath; },
		get projectName() { return projectName; },
		get projectColor() { return projectColor; },
		get projectTransition() { return projectTransition; },
		get switchStatus() { return switchStatus; },
		switchProject,
		handleProjectPopState
	};
}

export type ProjectSession = ReturnType<typeof createProjectSession>;
