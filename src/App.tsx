import { useCallback, useMemo, useRef, useState } from "react";
import { PlotContainer } from "./components/PlotContainer";
import { SideBarContainer } from "./components/SideBarContainer";
import { ToolBar } from "./components/ToolBar";
import { makeInitialState, reducer } from "./state/reducer";
import type { PlotState, PlotId, Action } from "./state/reducer";
import {
	flipSelectionX,
	flipSelectionY,
	mirrorSelection,
	duplicateSelectionLeft,
	duplicateSelectionRight,
	trimToSelection,
	replaceSelectionWithPoints,
} from "./utils/geometry";
import { parsePointsFromClipboard, serializePointsForClipboard } from "./utils/clipboard";
import { AppProvider } from "./state/AppProvider";
import { useHistoryReducer } from "./hooks/useHistoryReducer";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import "./styles/globals.css";

const HISTORY_LIMIT = 100;
const MIN_SIDEBAR_WIDTH = 260;
const MAX_SIDEBAR_WIDTH = 520;

function App_() {
	const { state, dispatch, applyChange, dispatchTransient, undo, redo } = useHistoryReducer(
		reducer,
		undefined,
		makeInitialState,
		{ historyLimit: HISTORY_LIMIT, replaceStateAction: (state): Action => ({ type: "app/replace-state", state }) }
	);
	const [sidebarWidth, setSidebarWidth] = useState(320);
	const lastCopiedRef = useRef<{ x: number; y: number }[] | null>(null);
	const sidebarDragRef = useRef<{ startX: number; startWidth: number } | null>(null);

	const activePlot = useMemo(
		() => state.plots.find(p => p.id === state.activePlotId) ?? null,
		[state.plots, state.activePlotId]
	);

	const replacePlot = useCallback(
		(plot: PlotState) => dispatch({ type: "plot/replace", plot }),
		[dispatch]
	);

	const handleSetActive = useCallback((id: PlotId | null) => dispatch({ type: "app/set-active", id }), [dispatch]);
	const handleAddPlot = useCallback(() => applyChange(() => dispatch({ type: "plot/add" })), [applyChange, dispatch]);
	const handleDuplicatePlot = useCallback(
		(id: PlotId) => applyChange(() => dispatch({ type: "plot/duplicate", id })),
		[applyChange, dispatch]
	);
	const handleRemovePlot = useCallback(
		(id: PlotId) => applyChange(() => dispatch({ type: "plot/remove", id })),
		[applyChange, dispatch]
	);
	const handleReplacePlot = useCallback((plot: PlotState) => applyChange(() => replacePlot(plot)), [applyChange, replacePlot]);
	const handleReplacePlotTransient = useCallback(
		(plot: PlotState) => {
			dispatchTransient({ type: "plot/replace", plot });
		},
		[dispatchTransient]
	);

	const updateActivePlot = (updater: (p: PlotState) => PlotState) => {
		if (!activePlot) return;
		applyChange(() => replacePlot(updater(activePlot)));
	};

	const selectionSize = activePlot?.selection.length ?? 0;
	const canFlip = selectionSize > 0;
	const canMirror = selectionSize > 1;

	const handleFlipY = () => {
		updateActivePlot(p => ({
			...p,
			points: flipSelectionY(p.points, new Set(p.selection), p.domainY, p.snapY, p.snapPrecisionY),
		}));
	};

	const handleFlipX = () => {
		updateActivePlot(p => ({
			...p,
			points: flipSelectionX(p.points, new Set(p.selection), p.domainX, p.snapX, p.snapPrecisionX),
		}));
	};

	const handleMirrorLeft = () => {
		updateActivePlot(p => ({
			...p,
			...mirrorSelection(p.points, new Set(p.selection), () => crypto.randomUUID(), "left"),
		}));
	};

	const handleMirrorRight = () => {
		updateActivePlot(p => ({
			...p,
			...mirrorSelection(p.points, new Set(p.selection), () => crypto.randomUUID(), "right"),
		}));
	};

	const handleDuplicateLeft = () => {
		updateActivePlot(p => ({
			...p,
			...duplicateSelectionLeft(p.points, new Set(p.selection), () => crypto.randomUUID()),
		}));
	};

	const handleDuplicateRight = () => {
		updateActivePlot(p => ({
			...p,
			...duplicateSelectionRight(p.points, new Set(p.selection), () => crypto.randomUUID()),
		}));
	};

	const handleTrim = () => {
		updateActivePlot(p => ({
			...p,
			points: trimToSelection(p.points, new Set(p.selection)),
		}));
	};

	const handleDeleteSelection = () => {
		updateActivePlot(p => {
			if (!p.selection.length) return p;
			const selectionSet = new Set(p.selection);
			const nextPoints = p.points.filter(pt => !selectionSet.has(pt.id));
			return { ...p, points: nextPoints, selection: [] };
		});
	};

	const handleCopy = () => {
		if (!activePlot || !activePlot.selection.length) return;
		const selectedSet = new Set(activePlot.selection);
		const selectedPoints = activePlot.points
			.filter(p => selectedSet.has(p.id))
			.map(p => ({ x: p.x, y: p.y }));
		if (!selectedPoints.length) return;

		const payload = serializePointsForClipboard(selectedPoints);
		lastCopiedRef.current = selectedPoints;
		if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
			navigator.clipboard.writeText(payload).catch(() => {
				// Ignore clipboard write failures
			});
		}
	};

	const handlePaste = async () => {
		if (!activePlot || !activePlot.selection.length) return;
		let incoming = lastCopiedRef.current;
		if (typeof navigator !== "undefined" && navigator.clipboard?.readText) {
			try {
				const text = await navigator.clipboard.readText();
				const parsed = parsePointsFromClipboard(text);
				if (parsed && parsed.length) {
					incoming = parsed;
				}
			} catch {
				// Ignore clipboard read failures and fall back to in-memory copy
			}
		}

		if (!incoming || !incoming.length) return;

		updateActivePlot(p => ({
			...p,
			...replaceSelectionWithPoints(p.points, new Set(p.selection), incoming!, p.domainX, p.domainY, () => crypto.randomUUID()),
		}));
	};

	const handleUndo = () => undo();
	const handleRedo = () => redo();

	const handleSidebarResizeStart = (e: React.MouseEvent<HTMLDivElement>) => {
		e.preventDefault();
		sidebarDragRef.current = { startX: e.clientX, startWidth: sidebarWidth };
		const onMove = (ev: MouseEvent) => {
			if (!sidebarDragRef.current) return;
			const delta = ev.clientX - sidebarDragRef.current.startX;
			const nextWidth = Math.min(
				MAX_SIDEBAR_WIDTH,
				Math.max(MIN_SIDEBAR_WIDTH, sidebarDragRef.current.startWidth - delta)
			);
			setSidebarWidth(nextWidth);
		};

		const onUp = () => {
			sidebarDragRef.current = null;
			window.removeEventListener("mousemove", onMove);
			window.removeEventListener("mouseup", onUp);
		};

		window.addEventListener("mousemove", onMove);
		window.addEventListener("mouseup", onUp);
	};

	useKeyboardShortcuts({
		onDuplicateLeft: handleDuplicateLeft,
		onDuplicateRight: handleDuplicateRight,
		onCopy: handleCopy,
		onPaste: handlePaste,
		onUndo: handleUndo,
		onRedo: handleRedo,
		onDeleteSelection: handleDeleteSelection,
	});

	const appContextValue = useMemo(
		() => ({
			state,
			activePlot,
			actions: {
				setActive: handleSetActive,
				replacePlot: handleReplacePlot,
				replacePlotTransient: handleReplacePlotTransient,
				duplicatePlot: handleDuplicatePlot,
				removePlot: handleRemovePlot,
			},
		}),
		[activePlot, handleDuplicatePlot, handleRemovePlot, handleReplacePlot, handleReplacePlotTransient, handleSetActive, state]
	);

	return (
		<AppProvider value={appContextValue}>
			<div className="app-shell">
				<div className="app-main">
					<ToolBar
						activePlotId={state.activePlotId}
						onAddPlot={handleAddPlot}
						onFlipX={handleFlipX}
						onFlipY={handleFlipY}
						onMirrorLeft={handleMirrorLeft}
						onMirrorRight={handleMirrorRight}
						onTrim={handleTrim}
						onDuplicateLeft={handleDuplicateLeft}
						onDuplicateRight={handleDuplicateRight}
						onCopy={handleCopy}
						onPaste={handlePaste}
						canFlip={canFlip}
						canMirror={canMirror}
					/>

					<div className="plots-scroll">
						{state.plots.map(plot => (
							<PlotContainer key={plot.id} plot={plot} />
						))}
					</div>
				</div>

				<div className="sidebar-container" style={{ width: sidebarWidth }}>
					<div
						className="sidebar-drag-handle"
						onMouseDown={handleSidebarResizeStart}
						role="separator"
						aria-orientation="vertical"
						aria-label="Resize sidebar"
					/>
					<SideBarContainer />
				</div>
			</div>
		</AppProvider>
	);
}

export default App_;
