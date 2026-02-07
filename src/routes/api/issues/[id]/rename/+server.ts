import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { renameIssue } from '$lib/bd'
import { resolveProjectCwd } from '$lib/db'

export const POST: RequestHandler = async ({ params, request, url }) => {
	const { newId } = await request.json()

	if (!newId?.trim()) {
		return json({ error: 'newId is required' }, { status: 400 })
	}

	const cwd = resolveProjectCwd(url)
	const result = await renameIssue(params.id, newId.trim(), cwd)

	if (!result.success) {
		return json({ error: result.error }, { status: 500 })
	}

	return json({ success: true, message: result.stdout })
}
