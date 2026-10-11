<script lang="ts">
	import ContextMenu from '$lib/components/ContextMenu.svelte';
	import RopeDrag from '$lib/components/RopeDrag.svelte';
	import DepTypePicker from '$lib/components/DepTypePicker.svelte';
	import CwdConflictDialog from '$lib/components/CwdConflictDialog.svelte';
	import KeyboardHelp from '$lib/components/KeyboardHelp.svelte';
	import SettingsPane from '$lib/components/SettingsPane.svelte';
	import SetupWizard from '$lib/components/SetupWizard.svelte';
	import ThemeTransition from '$lib/components/ThemeTransition.svelte';
	import ProjectSwitcher from '$lib/components/ProjectSwitcher.svelte';
	import { settings } from '$lib/stores/settings.svelte';
	import type { PageOps } from '$lib/stores/page-ops.svelte';
	import type { ViewState } from '$lib/stores/view-state.svelte';
	import type { ProjectSession } from '$lib/stores/project-session.svelte';

	interface Props {
		ops: PageOps;
		viewState: ViewState;
		session: ProjectSession;
		showProjectSwitcher: boolean;
		showKeyboardHelp: boolean;
		showWizard: boolean;
		showSettings: boolean;
		showPrompts: boolean;
	}

	let {
		ops,
		viewState,
		session,
		showProjectSwitcher = $bindable(),
		showKeyboardHelp = $bindable(),
		showWizard = $bindable(),
		showSettings = $bindable(),
		showPrompts = $bindable()
	}: Props = $props();
</script>

{#if ops.contextMenu}
	{@const menu = ops.contextMenu}
	<ContextMenu
		x={menu.x}
		y={menu.y}
		issue={menu.issue}
		onSetPriority={(p) => ops.setIssuePriority(menu.issue.id, p)}
		onStartRopeDrag={(e) => ops.startRopeDrag(e, menu.issue.id)}
		onCopyId={() => { ops.copyToClipboard(menu.issue.id, menu.issue.id); ops.closeContextMenu() }}
		onClose={ops.closeContextMenu}
	/>
{/if}

<RopeDrag ropeDrag={ops.ropeDrag} />

<DepTypePicker pendingDep={ops.pendingDep} onconfirm={ops.confirmDependency} oncancel={ops.cancelDependency} />

<CwdConflictDialog conflict={ops.cwdConflict} onresolve={ops.resolveConflict} ondismiss={ops.dismissConflict} />

<ThemeTransition
	active={viewState.themeTransitionActive}
	toLight={viewState.themeTransitionToLight}
	onswitch={viewState.switchTheme}
	ondone={viewState.completeThemeTransition}
/>

<ProjectSwitcher
	bind:show={showProjectSwitcher}
	projects={session.projects}
	currentPath={session.currentProjectPath}
	onselect={session.switchProject}
	onclose={() => showProjectSwitcher = false}
/>

<KeyboardHelp bind:show={showKeyboardHelp} />
<SetupWizard bind:show={showWizard} isDarkMode={viewState.isDarkMode} projectName={session.projectName} ontoggleTheme={viewState.toggleTheme} oncomplete={() => {}} />
<SettingsPane
	bind:show={showSettings}
	bind:showPrompts
	bind:agentEnabled={settings.agentEnabled}
	bind:agentHost={settings.agentHost}
	bind:agentPort={settings.agentPort}
	bind:agentFirstMessage={settings.agentFirstMessage}
	bind:agentSystemPrompt={settings.agentSystemPrompt}
	bind:agentWorkflow={settings.agentWorkflow}
	bind:agentTicketDelivery={settings.agentTicketDelivery}
	bind:agentTicketNotification={settings.agentTicketNotification}
	bind:agentToolsExpanded={settings.agentToolsExpanded}
	bind:showAgentBar={settings.showAgentBar}
	bind:conflictStrategy={settings.conflictStrategy}
	bind:maxConcurrentAgents={settings.maxConcurrentAgents}
	bind:managerEnabled={settings.managerEnabled}
	bind:managerModel={settings.managerModel}
	isDarkMode={viewState.isDarkMode}
	colorScheme={viewState.colorScheme}
	ontoggleTheme={viewState.toggleTheme}
	onsetColorScheme={(scheme) => viewState.colorScheme = scheme}
/>
