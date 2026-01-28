import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Plot } from "./components/Plot";
import { SideBar } from "./components/SideBar";
import { ToolBar } from "./components/ToolBar";
import { makeInitialState, reducer } from "./state/reducer";
import type { PlotState, PlotId, AppState } from "./state/reducer";
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
import "./styles/globals.css";

const HISTORY_LIMIT = 100;
const MIN_SIDEBAR_WIDTH = 260;
const MAX_SIDEBAR_WIDTH = 520;

const cloneState = (state: AppState): AppState => {
	if (typeof structuredClone === "function") {
		return structuredClone(state);
	}
	return JSON.parse(JSON.stringify(state)) as AppState;
};

function App_() {
	const [state, dispatch] = useReducer(reducer, undefined, makeInitialState);
	const [sidebarWidth, setSidebarWidth] = useState(320);
	const lastCopiedRef = useRef<{ x: number; y: number }[] | null>(null);
	const pastRef = useRef<AppState[]>([]);
	const futureRef = useRef<AppState[]>([]);
	const historyBaseRef = useRef<AppState | null>(null);
	const sidebarDragRef = useRef<{ startX: number; startWidth: number } | null>(null);

	const activePlot = useMemo(
		() => state.plots.find(p => p.id === state.activePlotId) ?? null,
		[state.plots, state.activePlotId]
	);

	const replacePlot = (plot: PlotState) => dispatch({ type: "plot/replace", plot });
	const replacePlotNoHistory = (plot: PlotState) => dispatch({ type: "plot/replace", plot });

	const recordChange = (prev: AppState) => {
		const stack = pastRef.current.concat(cloneState(prev));
		const trimmed = stack.length > HISTORY_LIMIT ? stack.slice(stack.length - HISTORY_LIMIT) : stack;
		pastRef.current = trimmed;
		futureRef.current = [];
	};

	const applyChange = (mutate: () => void) => {
		const snapshot = historyBaseRef.current ?? cloneState(state);
		mutate();
		recordChange(snapshot);
		historyBaseRef.current = null;
	};

	const handleSetActive = (id: PlotId | null) => dispatch({ type: "app/set-active", id });
	const handleAddPlot = () => applyChange(() => dispatch({ type: "plot/add" }));
	const handleDuplicatePlot = (id: PlotId) => applyChange(() => dispatch({ type: "plot/duplicate", id }));
	const handleRemovePlot = (id: PlotId) => applyChange(() => dispatch({ type: "plot/remove", id }));
	const handleReplacePlot = (plot: PlotState) => applyChange(() => replacePlot(plot));
	const handleReplacePlotTransient = (plot: PlotState) => {
		if (!historyBaseRef.current) historyBaseRef.current = cloneState(state);
		replacePlotNoHistory(plot);
	};

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
			} catch (err) {
				// Ignore clipboard read failures and fall back to in-memory copy
			}
		}

		if (!incoming || !incoming.length) return;

		updateActivePlot(p => ({
			...p,
			...replaceSelectionWithPoints(p.points, new Set(p.selection), incoming!, p.domainX, p.domainY, () => crypto.randomUUID()),
		}));
	};

	const handleUndo = () => {
		const prev = pastRef.current.pop();
		if (!prev) return;
		futureRef.current = futureRef.current.concat(cloneState(state));
		dispatch({ type: "app/replace-state", state: prev });
		historyBaseRef.current = null;
	};

	const handleRedo = () => {
		const next = futureRef.current.pop();
		if (!next) return;
		pastRef.current = pastRef.current.concat(cloneState(state));
		dispatch({ type: "app/replace-state", state: next });
		historyBaseRef.current = null;
	};

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

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			const isFormField = e.target instanceof HTMLElement &&
				(e.target.tagName === "INPUT" || e.target.tagName === "SELECT" || e.target.tagName === "TEXTAREA" || e.target.isContentEditable);
			if (isFormField) return;

			const key = e.key.toLowerCase();
			const isModifier = e.metaKey || e.ctrlKey;

			if (isModifier && key === "d") {
				if (e.shiftKey) {
					e.preventDefault();
					handleDuplicateLeft();
					return;
				}

				e.preventDefault();
				handleDuplicateRight();
				return;
			}

			if (isModifier && key === "c") {
				e.preventDefault();
				handleCopy();
				return;
			}

			if (isModifier && key === "v") {
				e.preventDefault();
				void handlePaste();
				return;
			}

			if (isModifier && key === "z") {
				e.preventDefault();
				if (e.shiftKey) {
					handleRedo();
				} else {
					handleUndo();
				}
				return;
			}

			if (!isModifier && (key === "delete" || key === "backspace")) {
				e.preventDefault();
				handleDeleteSelection();
				return;
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [handleDuplicateLeft, handleDuplicateRight, handleCopy, handlePaste, handleDeleteSelection, handleUndo, handleRedo]);

	return (
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
						<Plot
							key={plot.id}
							plot={plot}
							active={plot.id === state.activePlotId}
							onActivate={() => handleSetActive(plot.id)}
							onChange={handleReplacePlot}
							onChangeTransient={handleReplacePlotTransient}
						/>
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
				<SideBar
					plot={activePlot}
					onChange={handleReplacePlot}
					onDuplicate={handleDuplicatePlot}
					onRemove={handleRemovePlot}
				/>
			</div>
		</div>
	);
}

export default App_;
