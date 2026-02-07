/** Frontend project context for building API URLs with the active project path. */
let currentProject = '';

export function setCurrentProject(path: string) {
	currentProject = path;
}

export function getCurrentProject(): string {
	return currentProject;
}

/** Append ?project=<path> to a URL if a project is active. */
export function appendProjectParam(url: string): string {
	if (!currentProject) return url;
	const separator = url.includes('?') ? '&' : '?';
	return `${url}${separator}project=${encodeURIComponent(currentProject)}`;
}
