export function extractErrorMessage(err: unknown, fallback: string): string {
	const e = err as { stderr?: string; message?: string };
	return e.stderr || e.message || fallback;
}
