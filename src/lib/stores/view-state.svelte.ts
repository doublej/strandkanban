import { browser } from '$app/environment';
import { untrack } from 'svelte';
import { coerceViewMode, type Issue, type SortBy, type TableColumnConfig, type TableSortState, type ViewMode, type ViewRecipe } from '$lib/types';
import { columns } from '$lib/utils';
import {
	issueMatchesFilters as matchesFilters,
	hasActiveFilters as checkActiveFilters,
	countActiveFilters,
	emptyFilterState,
	normalizeFilterState,
	type FilterState
} from '$lib/filters';
import { reconcileTableColumns } from '$lib/table-columns';
import { settings } from '$lib/stores/settings.svelte';

const PROJECT_VIEW_PREFIX = 'bdk:view:';

export interface ViewSnapshot {
	filters: FilterState;
	columnSort: Record<string, SortBy>;
	collapsedColumns: string[];
	viewMode: ViewMode;
	table: TableColumnConfig[];
	tableSort: TableSortState | null;
}

export interface ViewStateContext {
	getCurrentProjectPath: () => string;
}

/**
 * localStorage-backed view preferences: filters, view mode, per-column sort,
 * table config, named recipes and theme. Owns the settings load so the
 * default-view/default-sort effects see loaded values on their first run.
 */
export function createViewState(ctx: ViewStateContext) {
	let filters = $state<FilterState>(emptyFilterState());
	let viewMode = $state<ViewMode>('kanban');
	let columnSortBy = $state<Record<string, SortBy>>({});
	let isDarkMode = $state(true);
	let colorScheme = $state('default');
	let themeTransitionActive = $state(false);
	let themeTransitionToLight = $state(false);
	let currentRecipeId = $state<string | null>(null);
	let lastAppliedRecipeSnapshot = $state<string | null>(null);
	let hydratedProject = $state<string | null>(null);
	let lastAppliedDefaultView = $state<ViewMode | null>(null);
	let lastAppliedDefaultSort = $state<SortBy | null>(null);

	function captureCurrentViewState(): ViewSnapshot {
		return {
			filters: normalizeFilterState(filters),
			columnSort: { ...columnSortBy },
			collapsedColumns: [...settings.collapsedColumns],
			viewMode,
			table: settings.tableColumns.map((c) => ({ ...c })),
			tableSort: settings.tableSort ? { ...settings.tableSort } : null
		};
	}

	function applyViewState(state: {
		filters: FilterState;
		columnSort: Record<string, SortBy>;
		collapsedColumns: string[];
		viewMode: ViewMode;
		table?: TableColumnConfig[];
		tableSort?: TableSortState | null;
	}) {
		filters = normalizeFilterState(state.filters);
		columnSortBy = { ...state.columnSort };
		viewMode = coerceViewMode(state.viewMode);
		if (state.table) settings.tableColumns = reconcileTableColumns(state.table);
		if (state.tableSort !== undefined) settings.tableSort = state.tableSort;

		const savedCollapsed = new Set(state.collapsedColumns);
		for (const col of [...settings.collapsedColumns]) {
			if (!savedCollapsed.has(col)) settings.toggleColumnCollapse(col);
		}
		for (const col of state.collapsedColumns) {
			if (!settings.collapsedColumns.has(col)) settings.toggleColumnCollapse(col);
		}
	}

	function saveRecipe(name: string) {
		const state = captureCurrentViewState();
		const recipe: ViewRecipe = {
			id: crypto.randomUUID(),
			name,
			filters: state.filters,
			columnSort: state.columnSort,
			collapsedColumns: state.collapsedColumns,
			viewMode: state.viewMode,
			table: state.table,
			tableSort: state.tableSort,
			createdAt: new Date().toISOString()
		};
		settings.saveRecipe(recipe);
		currentRecipeId = recipe.id;
		lastAppliedRecipeSnapshot = JSON.stringify(captureCurrentViewState());
	}

	function applyRecipe(recipe: ViewRecipe) {
		applyViewState(recipe);
		currentRecipeId = recipe.id;
		lastAppliedRecipeSnapshot = JSON.stringify(captureCurrentViewState());
	}

	function deleteRecipe(id: string) {
		settings.deleteRecipe(id);
		if (currentRecipeId === id) {
			currentRecipeId = null;
			lastAppliedRecipeSnapshot = null;
		}
	}

	function renameRecipe(id: string, newName: string) {
		settings.renameRecipe(id, newName);
	}

	function setColumnSort(columnKey: string, sortBy: SortBy) {
		columnSortBy = { ...columnSortBy, [columnKey]: sortBy };
	}

	function clearFilters() {
		filters = emptyFilterState();
	}

	// --- Theme ---
	function toggleTheme() {
		if (themeTransitionActive) return;
		themeTransitionToLight = isDarkMode;
		themeTransitionActive = true;
	}

	function switchTheme() {
		isDarkMode = !isDarkMode;
		settings.isDarkMode = isDarkMode;
	}

	function completeThemeTransition() {
		themeTransitionActive = false;
	}

	// --- Settings sync (load once, bind directly to settings store) ---
	// settings.load() both reads and writes settings $state (e.g.
	// `viewRecipes = loadObject('viewRecipes', viewRecipes)`), so it must run
	// untracked — otherwise this effect self-triggers once localStorage holds a
	// value that parses to a fresh reference each run (infinite loop / freeze).
	$effect(() => {
		untrack(() => {
			settings.load();
			isDarkMode = settings.isDarkMode;
			colorScheme = settings.colorScheme;
		});
	});

	$effect(() => {
		const defaultView = settings.defaultViewMode;
		if (lastAppliedDefaultView === null || defaultView !== lastAppliedDefaultView) {
			viewMode = defaultView;
			lastAppliedDefaultView = defaultView;
		}
	});

	$effect(() => {
		const defaultSort = settings.defaultColumnSort;
		if (lastAppliedDefaultSort === null) {
			if (Object.keys(columnSortBy).length === 0) {
				columnSortBy = Object.fromEntries(columns.map((col) => [col.key, defaultSort])) as Record<string, SortBy>;
			}
			lastAppliedDefaultSort = defaultSort;
			return;
		}
		if (defaultSort !== lastAppliedDefaultSort) {
			columnSortBy = Object.fromEntries(columns.map((col) => [col.key, defaultSort])) as Record<string, SortBy>;
			lastAppliedDefaultSort = defaultSort;
		}
	});

	// --- Per-project view state: hydrate on project change, persist on edit ---
	$effect(() => {
		if (!browser) return;
		const path = ctx.getCurrentProjectPath();
		if (!path) return;
		untrack(() => {
			try {
				const raw = localStorage.getItem(PROJECT_VIEW_PREFIX + path);
				if (raw) applyViewState(JSON.parse(raw));
			} catch {
				/* ignore corrupt/unavailable persisted view state */
			}
			// A remembered project view is not a named recipe.
			currentRecipeId = null;
			lastAppliedRecipeSnapshot = null;
			hydratedProject = path;
		});
	});

	$effect(() => {
		if (!browser) return;
		const state = captureCurrentViewState();
		const path = ctx.getCurrentProjectPath();
		// Only persist once the active project's state has been hydrated,
		// so we never overwrite it with defaults during a project switch.
		if (!path || path !== hydratedProject) return;
		untrack(() => {
			try {
				localStorage.setItem(PROJECT_VIEW_PREFIX + path, JSON.stringify(state));
			} catch {
				/* ignore quota / unavailable storage */
			}
		});
	});

	// --- Apply theme to body element ---
	$effect(() => {
		if (!browser) return;
		document.body.classList.toggle('light', !isDarkMode);
		// Remove all scheme classes first
		document.body.className = document.body.className.replace(/scheme-\w+/g, '').trim();
		// Add current scheme if not default
		if (colorScheme !== 'default') {
			document.body.classList.add(`scheme-${colorScheme}`);
		}
	});

	const hasActiveFilters = $derived(checkActiveFilters(filters));
	const activeFilterCount = $derived(countActiveFilters(filters));
	const hasUnsavedRecipeChanges = $derived.by(() => {
		if (!currentRecipeId) return false;
		return JSON.stringify(captureCurrentViewState()) !== lastAppliedRecipeSnapshot;
	});

	return {
		get filters() { return filters; },
		get viewMode() { return viewMode; },
		set viewMode(v: ViewMode) { viewMode = v; },
		get columnSortBy() { return columnSortBy; },
		get isDarkMode() { return isDarkMode; },
		get colorScheme() { return colorScheme; },
		set colorScheme(v: string) { colorScheme = v; settings.colorScheme = v; },
		get themeTransitionActive() { return themeTransitionActive; },
		get themeTransitionToLight() { return themeTransitionToLight; },
		get currentRecipeId() { return currentRecipeId; },
		set currentRecipeId(v: string | null) { currentRecipeId = v; },
		get hasActiveFilters() { return hasActiveFilters; },
		get activeFilterCount() { return activeFilterCount; },
		get hasUnsavedRecipeChanges() { return hasUnsavedRecipeChanges; },

		matchesFilters: (issue: Issue) => matchesFilters(issue, filters),
		clearFilters,
		setColumnSort,
		captureCurrentViewState,
		applyViewState,
		saveRecipe,
		applyRecipe,
		deleteRecipe,
		renameRecipe,
		toggleTheme,
		switchTheme,
		completeThemeTransition
	};
}

export type ViewState = ReturnType<typeof createViewState>;
