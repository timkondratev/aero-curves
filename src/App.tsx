import { useEffect, useMemo, useReducer, useRef } from "react";
import { Plot } from "./components/Plot";
import { SideBar } from "./components/SideBar";
import { ToolBar } from "./components/ToolBar";
import { makeInitialState, reducer } from "./state/reducer";
import type { PlotState, PlotId } from "./state/reducer";
import {
	flipSelectionX,
	flipSelectionY,
	mirrorSelectionLeft,
	mirrorSelectionRight,
	duplicateSelectionLeft,
	duplicateSelectionRight,
	trimToSelection,
	replaceSelectionWithPoints,
} from "./utils/geometry";
import { parsePointsFromClipboard, serializePointsForClipboard } from "./utils/clipboard";
import "./styles/globals.css";

function App_() {
	const [state, dispatch] = useReducer(reducer, undefined, makeInitialState);
	const lastCopiedRef = useRef<{ x: number; y: number }[] | null>(null);

	const activePlot = useMemo(
		() => state.plots.find(p => p.id === state.activePlotId) ?? null,
		[state.plots, state.activePlotId]
	);

	const replacePlot = (plot: PlotState) => dispatch({ type: "plot/replace", plot });

	const handleSetActive = (id: PlotId | null) => dispatch({ type: "app/set-active", id });
	const handleAddPlot = () => dispatch({ type: "plot/add" });
	const handleRemovePlot = (id: PlotId) => dispatch({ type: "plot/remove", id });
	const handleReplacePlot = (plot: PlotState) => replacePlot(plot);

	const updateActivePlot = (updater: (p: PlotState) => PlotState) => {
		if (!activePlot) return;
		replacePlot(updater(activePlot));
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
			...mirrorSelectionLeft(p.points, new Set(p.selection), () => crypto.randomUUID()),
		}));
	};

	const handleMirrorRight = () => {
		updateActivePlot(p => ({
			...p,
			...mirrorSelectionRight(p.points, new Set(p.selection), () => crypto.randomUUID()),
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

			if (!isModifier && (key === "delete" || key === "backspace")) {
				e.preventDefault();
				handleDeleteSelection();
				return;
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [handleDuplicateLeft, handleDuplicateRight, handleCopy, handlePaste, handleDeleteSelection]);

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
							onRemove={() => handleRemovePlot(plot.id)}
						/>
					))}
				</div>
			</div>

			<div className="sidebar-container">
				<SideBar plot={activePlot} onChange={handleReplacePlot} />
			</div>
		</div>
	);
}

export default App_;
