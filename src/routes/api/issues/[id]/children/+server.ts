import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { getAllIssues, resolveProjectCwd } from '$lib/db'

export const GET: RequestHandler = async ({ params, url }) => {
	const cwd = resolveProjectCwd(url)
	const issues = getAllIssues(cwd)
	const children = issues.filter(issue =>
		issue.dependencies?.some(d => d.id === params.id && d.dependency_type === 'parent-child')
	)

	return json({ children: children.map(c => ({ id: c.id, title: c.title, status: c.status })) })
}
