import { useMemo, useState } from "react";
import type { PlotState } from "../../state/reducer";

const toJson = (points: PlotState["points"]) => JSON.stringify(points.map(p => ({ x: p.x, y: p.y })), null, 2);

type Props = {
	plot: PlotState;
};

export function DataPanel({ plot }: Props) {
	const [copied, setCopied] = useState(false);
	const pointsJson = useMemo(() => toJson(plot.points), [plot.points]);

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(pointsJson);
			setCopied(true);
			setTimeout(() => setCopied(false), 800);
		} catch {
			setCopied(false);
		}
	};

	return (
		<div className="panel-section">
			<div className="section-title">DATA</div>
			<div className="form-row">
				<button className="btn" type="button" onClick={handleCopy}>
					{copied ? "Copied" : "Copy JSON"}
				</button>
			</div>
			<div className="form-row">
				<textarea className="row-control" value={pointsJson} readOnly rows={12} style={{ fontFamily: "monospace" }} />
			</div>
		</div>
	);
}
