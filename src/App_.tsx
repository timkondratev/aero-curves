import { useMemo, useReducer } from "react";
import { Plot } from "./components/Plot";
import { SideBar } from "./components/SideBar";
import { ToolBar } from "./components/ToolBar";
import { makeInitialState, reducer } from "./state/reducer";
import type { PlotState, PlotId } from "./state/reducer";
import "./styles/globals.css";

function App_() {
	const [state, dispatch] = useReducer(reducer, undefined, makeInitialState);

	const activePlot = useMemo(
		() => state.plots.find(p => p.id === state.activePlotId) ?? null,
		[state.plots, state.activePlotId]
	);

	const handleSetActive = (id: PlotId | null) => dispatch({ type: "app/set-active", id });
	const handleAddPlot = () => dispatch({ type: "plot/add" });
	const handleRemovePlot = (id: PlotId) => dispatch({ type: "plot/remove", id });
	const handleReplacePlot = (plot: PlotState) => dispatch({ type: "plot/replace", plot });

	return (
		<div className="app-shell">
			<div className="app-main">
				<ToolBar
					activePlotId={state.activePlotId}
					plots={state.plots}
					onAddPlot={handleAddPlot}
					onRemovePlot={handleRemovePlot}
					onSetActive={handleSetActive}
				/>

				<div className="plots-scroll">
					{state.plots.map(plot => (
						<Plot
							key={plot.id}
							plot={plot}
							active={plot.id === state.activePlotId}
							onActivate={() => handleSetActive(plot.id)}
							onChange={handleReplacePlot}
							onRemove={state.plots.length > 1 ? () => handleRemovePlot(plot.id) : undefined}
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
