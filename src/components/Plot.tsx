import type { PlotState } from "../state/reducer";

type Props = {
	plot: PlotState;
	active: boolean;
	onActivate: () => void;
	onChange: (plot: PlotState) => void;
	onRemove?: () => void;
};

export function Plot({ plot, active, onActivate, onRemove }: Props) {
	return (
		<div className={`plot-card${active ? " is-active" : ""}`}>
			<div className="plot-header">
				<strong>{plot.name}</strong>
				<span className="plot-meta">points: {plot.points.length}</span>
				<button className="btn" onClick={onActivate} style={{ marginLeft: "auto" }}>
					{active ? "Active" : "Activate"}
				</button>
				{onRemove && (
					<button className="btn" onClick={onRemove} style={{ marginLeft: 8 }}>
						Remove
					</button>
				)}
			</div>
			<div className="plot-meta">
				Domain X: [{plot.domainX[0]}, {plot.domainX[1]}] — Domain Y: [{plot.domainY[0]}, {plot.domainY[1]}]
			</div>
			<div className="plot-meta">
				Snap: X {plot.snapX ? "on" : "off"} ({plot.snapPrecisionX}), Y {plot.snapY ? "on" : "off"} ({plot.snapPrecisionY})
			</div>
		</div>
	);
}
