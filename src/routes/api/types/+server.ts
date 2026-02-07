import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { getTypes } from '$lib/bd'
import { resolveProjectCwd } from '$lib/db'

const DEFAULT_TYPES = ['task', 'bug', 'feature', 'enhancement', 'epic', 'chore']

export const GET: RequestHandler = async ({ url }) => {
	const cwd = resolveProjectCwd(url)
	const result = await getTypes(cwd)

	if (result.success && result.stdout) {
		try {
			const types = JSON.parse(result.stdout)
			return json({ types })
		} catch {
			// Fall through to defaults
		}
	}

	return json({ types: DEFAULT_TYPES })
}
