import type { PlotState, PlotId } from "../state/reducer";

type Props = {
	activePlotId: PlotId | null;
	plots: PlotState[];
	onAddPlot: () => void;
	onRemovePlot: (id: PlotId) => void;
	onSetActive: (id: PlotId) => void;
};

export function ToolBar({ activePlotId, plots, onAddPlot, onRemovePlot, onSetActive }: Props) {
	return (
		<div className="toolbar">
			<button className="btn" onClick={onAddPlot}>
				+ Add plot
			</button>

			{plots.map(plot => (
				<button
					key={plot.id}
					onClick={() => onSetActive(plot.id)}
					className={`btn${plot.id === activePlotId ? " btn-active" : ""}`}
				>
					{plot.name}
				</button>
			))}

			{activePlotId && plots.length > 1 && (
				<button className="btn btn-remove" onClick={() => onRemovePlot(activePlotId)}>
					Remove active
				</button>
			)}
		</div>
	);
}
