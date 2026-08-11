<script lang="ts">
	import type { Issue } from '$lib/types';
	import type { PageOps } from '$lib/stores/page-ops.svelte';
	import type { CardDrag } from '$lib/drag-drop/card-drag.svelte';
	import { getColumnsWithCustom } from '$lib/utils';
	import { settings } from '$lib/stores/settings.svelte';
	import DetailPanel from './DetailPanel.svelte';

	interface Props {
		ops: PageOps;
		cardDrag: CardDrag;
		issues: Issue[];
		activeAgents: string[];
	}

	let { ops, cardDrag, issues, activeAgents }: Props = $props();

	const statusColumns = $derived(getColumnsWithCustom(issues));
</script>

<DetailPanel
	bind:editingIssue={ops.editingIssue}
	isCreating={ops.isCreating}
	bind:createForm={ops.createForm}
	allIssues={issues}
	{activeAgents}
	agentEnabled={settings.agentEnabled}
	{statusColumns}
	comments={ops.comments}
	bind:newLabelInput={ops.newLabelInput}
	bind:newComment={ops.newComment}
	loadingComments={ops.loadingComments}
	attachments={ops.attachments}
	loadingAttachments={ops.loadingAttachments}
	onuploadattachment={ops.handleUploadAttachment}
	ondeleteattachment={ops.handleDeleteAttachment}
	originalLabels={ops.originalLabels}
	isPanelDragging={cardDrag.isPanelDragging}
	panelDragOffset={cardDrag.panelDragOffset}
	issueClosedExternally={ops.issueClosedExternally}
	onclose={ops.closePanel}
	oncreate={ops.createIssue}
	oncreateandstartagent={ops.createIssueAndStartAgent}
	onstartagent={ops.startAgentForIssue}
	onviewchat={ops.openAgentPane}
	ondelete={(id) => ops.deleteIssue(id)}
	onsave={(id, updates) => ops.updateIssue(id, updates)}
	onaddcomment={ops.addComment}
	oncopyid={(text, id) => ops.copyToClipboard(text, id)}
	onsetcolumn={(key) => ops.setEditingColumn(key)}
	onaddlabel={(label) => ops.addLabelToEditing(label)}
	onremovelabel={(label) => ops.removeLabelFromEditing(label)}
	onsetstate={(dimension, value, reason) => ops.setIssueState(dimension, value, reason)}
	onpromote={(reason) => ops.promoteWisp(reason)}
	onremovedep={(issueId, depId) => ops.removeDependency(issueId, depId)}
	onpaneltouchstart={cardDrag.handlePanelTouchStart}
	onpaneltouchmove={cardDrag.handlePanelTouchMove}
	onpaneltouchend={cardDrag.handlePanelTouchEnd}
	updatecreateform={(key, value) => { (ops.createForm as Record<string, unknown>)[key] = value; }}
	updatenewlabel={(value) => ops.newLabelInput = value}
	ondismissclosedwarning={() => ops.issueClosedExternally = false}
	updatenewcomment={(value) => ops.newComment = value}
/>
