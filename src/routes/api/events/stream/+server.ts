import type { RequestHandler } from './$types';
import { requireProjectCwd } from '$lib/server/cwd';
import { notificationEmitter } from '$lib/notifications/event-emitter';
import type { NotificationEventType } from '$lib/notifications/types';

const HEARTBEAT_MS = 25_000;

const NAME_MAP: Record<NotificationEventType, string> = {
	issue_created: 'issue.created',
	issue_closed: 'issue.closed',
	status_changed: 'issue.updated',
	priority_changed: 'issue.updated',
	assignee_changed: 'issue.updated',
	label_modified: 'issue.updated',
	dependency_added: 'issue.updated',
	blocked: 'issue.updated',
	unblocked: 'issue.updated',
	attachment_added: 'issue.updated',
	comment_added: 'issue.comment_added',
};

export const GET: RequestHandler = async ({ url }) => {
	const cwd = requireProjectCwd(url);

	let closed = false;
	let unsubscribe: (() => void) | null = null;
	let heartbeat: ReturnType<typeof setInterval> | null = null;

	const stream = new ReadableStream({
		start(controller) {
			const encoder = new TextEncoder();
			const send = (data: object) => {
				if (closed) return;
				try {
					controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
				} catch {
					closed = true;
				}
			};

			send({ type: 'ready', cwd, timestamp: Date.now() });

			unsubscribe = notificationEmitter.on('*', (event) => {
				const eventCwd = (event.metadata as { cwd?: string } | undefined)?.cwd;
				if (eventCwd && eventCwd !== cwd) return;
				send({
					type: 'event',
					name: NAME_MAP[event.type] ?? 'issue.updated',
					originalType: event.type,
					issueId: event.issue.id,
					issue: event.issue,
					timestamp: event.timestamp,
				});
			});

			heartbeat = setInterval(() => send({ type: 'heartbeat', timestamp: Date.now() }), HEARTBEAT_MS);
		},
		cancel() {
			closed = true;
			unsubscribe?.();
			if (heartbeat) clearInterval(heartbeat);
		},
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive',
		},
	});
};
