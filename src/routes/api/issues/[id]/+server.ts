import type { RequestHandler } from './$types';
import { requireProjectCwd } from '$lib/server/cwd';
import { beads } from '$lib/server/beads/client';
import { notificationStore } from '$lib/notifications/notification-store.svelte';
import { hookExecutor } from '$lib/server/agent/hook-executor';
import { ok, wrap } from '$lib/server/response';
import { parseBody, UpdateIssueSchema } from '$lib/server/schemas';

export const PATCH: RequestHandler = wrap(async ({ params, request, url }) => {
	const body = await parseBody(request, UpdateIssueSchema);
	const {
		status, title, description, priority, issue_type, design,
		acceptance_criteria, notes, assignee, addLabels, removeLabels,
		agent_model, agent_effort,
		due_at, defer_until, external_ref, spec_id, estimated_minutes,
	} = body;

	const cwd = requireProjectCwd(url);
	const bd = beads(cwd);
	// ponytail: `beforeIssue` may be served from the 30s-stale export cache, so a hook diff
	// can fire StatusChanged/PriorityChanged on a phantom delta (or miss a real one) when
	// another writer moved the issue meanwhile. Serializing writes per cwd would close it.
	const beforeIssue = await bd.issue(params.id);

	const setMetadata: Record<string, string> = {};
	const unsetMetadata: string[] = [];
	if (agent_model !== undefined) {
		if (agent_model) setMetadata.agent_model = String(agent_model);
		else unsetMetadata.push('agent_model');
	}
	if (agent_effort !== undefined) {
		if (agent_effort) setMetadata.agent_effort = String(agent_effort);
		else unsetMetadata.push('agent_effort');
	}

	// One `bd update` for the whole change set. This used to be a sequential chain of an
	// update plus one spawn per label and per metadata key, which widened the lost-update
	// window to N spawns — bd re-imports the full JSONL on every write.
	await bd.update(params.id, {
		status, title, description, priority, design, acceptance_criteria, notes,
		assignee: assignee ?? undefined,
		due: due_at, defer: defer_until, external_ref, spec_id, estimate: estimated_minutes,
		addLabels, removeLabels, setMetadata, unsetMetadata,
	});
	// ponytail: the SDK's UpdateIssueOptions has no type field, so a type change is a second
	// `bd update`. Fold it into the call above once beads-sdk grows `issue_type`.
	if (issue_type !== undefined) await bd.write(['update', params.id, '--type', issue_type]);

	const afterIssue = await bd.issue(params.id);
	if (beforeIssue && afterIssue) {
		const baseCtx = {
			id: afterIssue.id,
			title: afterIssue.title,
			status: afterIssue.status,
			priority: afterIssue.priority,
			assignee: afterIssue.assignee,
			cwd,
		};

		const meta = { cwd };
		if (beforeIssue.status !== afterIssue.status) {
			notificationStore.emit('status_changed', afterIssue, meta);
			await hookExecutor.executeHooks('StatusChanged', {
				...baseCtx,
				oldStatus: beforeIssue.status,
				newStatus: afterIssue.status,
			});
			if (afterIssue.status === 'closed') {
				await hookExecutor.executeHooks('TicketClosed', baseCtx);
			}
			if (afterIssue.status === 'blocked') {
				notificationStore.emit('blocked', afterIssue, meta);
				await hookExecutor.executeHooks('TicketBlocked', baseCtx);
			}
			if (beforeIssue.status === 'blocked' && afterIssue.status !== 'blocked') {
				notificationStore.emit('unblocked', afterIssue, meta);
				await hookExecutor.executeHooks('TicketUnblocked', baseCtx);
			}
		}
		if (beforeIssue.priority !== afterIssue.priority) {
			notificationStore.emit('priority_changed', afterIssue, meta);
			await hookExecutor.executeHooks('PriorityChanged', baseCtx);
		}
		if (beforeIssue.assignee !== afterIssue.assignee) {
			notificationStore.emit('assignee_changed', afterIssue, meta);
			await hookExecutor.executeHooks('AssigneeChanged', baseCtx);
		}
		if (addLabels?.length || removeLabels?.length) {
			notificationStore.emit('label_modified', afterIssue, meta);
			await hookExecutor.executeHooks('LabelModified', baseCtx);
		}
	}

	return ok({ updated: true });
});

export const DELETE: RequestHandler = wrap(async ({ params, url }) => {
	const cwd = requireProjectCwd(url);
	const bd = beads(cwd);
	const issue = await bd.issue(params.id);

	await bd.delete(params.id);

	if (issue) {
		notificationStore.emit('issue_deleted', issue, { cwd });
		const ctx = {
			id: issue.id,
			title: issue.title,
			status: issue.status,
			priority: issue.priority,
			assignee: issue.assignee,
			cwd,
		};
		await hookExecutor.executeHooks('TicketDeleted', ctx);
		// ponytail: `bd delete` is permanent, not a close. TicketClosed still fires purely so
		// existing hook consumers keep working; drop it once they listen for TicketDeleted.
		await hookExecutor.executeHooks('TicketClosed', ctx);
	}
	return ok({ deleted: true });
});
