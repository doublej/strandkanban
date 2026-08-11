import { settings } from '$lib/stores/settings.svelte';
import { notifyAgentOfTicketUpdate, notifyManagerOfTicketUpdate } from '$lib/wsStore.svelte';

export type TicketNotificationType =
	| 'comment' | 'dependency' | 'attachment' | 'status' | 'priority' | 'assignee' | 'label';

export type NotifyTicket = (
	ticketId: string,
	content: string,
	notificationType: TicketNotificationType,
	context?: { ticketTitle?: string; sender?: string }
) => void;

/**
 * Ticket updates go to the worker agent holding the ticket; the manager only hears
 * about it when there is no worker, or when the ticket just closed.
 */
export function createTicketNotifier(getCurrentProjectPath: () => string): NotifyTicket {
	return (ticketId, content, notificationType, context) => {
		const deliveredToWorker = notifyAgentOfTicketUpdate(ticketId, content, notificationType, context, settings.agentTicketNotification);
		const isClose = notificationType === 'status' && content.includes('closed');
		if (!deliveredToWorker || isClose) {
			notifyManagerOfTicketUpdate(getCurrentProjectPath(), ticketId, content, notificationType, context, settings.agentTicketNotification);
		}
	};
}
