import { useEffect, useMemo, useReducer } from "react";
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
} from "./utils/geometry";
import "./styles/globals.css";

function App_() {
	const [state, dispatch] = useReducer(reducer, undefined, makeInitialState);

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

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			const isModifier = e.metaKey || e.ctrlKey;
			const isFormField = e.target instanceof HTMLElement &&
				(e.target.tagName === "INPUT" || e.target.tagName === "SELECT" || e.target.tagName === "TEXTAREA" || e.target.isContentEditable);
			if (!isModifier || isFormField) return;

			const key = e.key.toLowerCase();
			if (key !== "d") return;

			if (e.shiftKey) {
				e.preventDefault();
				handleDuplicateLeft();
				return;
			}

			e.preventDefault();
			handleDuplicateRight();
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [handleDuplicateLeft, handleDuplicateRight]);

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
