export function formatCwdForDisplay(cwd: string, maxLength = 30): string {
	const home = process.env.HOME || '~';
	const shortened = cwd.replace(home, '~');

	if (shortened.length <= maxLength) return shortened;

	// Truncate middle: ~/.../<folder>
	const parts = shortened.split('/');
	if (parts.length > 3) {
		return `${parts[0]}/.../${parts[parts.length - 1]}`;
	}

	return shortened.slice(0, maxLength - 3) + '...';
}
