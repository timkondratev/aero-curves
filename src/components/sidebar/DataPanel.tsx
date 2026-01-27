import { useMemo, useState } from "react";
import type { PlotState } from "../../state/reducer";
import { buildMonotoneSpline } from "../../utils/monotone";
import { clampValue } from "../../utils/geometry";

const toJson = (points: PlotState["points"]) => JSON.stringify(points.map(p => ({ x: p.x, y: p.y })), null, 2);

type Props = {
	plot: PlotState;
	onChange: (plot: PlotState) => void;
};

export function DataPanel({ plot, onChange }: Props) {
	const [copied, setCopied] = useState(false);
	const pointsJson = useMemo(() => toJson(plot.points), [plot.points]);

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(pointsJson);
			setCopied(true);
			setTimeout(() => setCopied(false), 800);
		} catch (err) {
			setCopied(false);
		}
	};

	const handleNormalize = () => {
		if (plot.points.length < 2) return;
		const sorted = [...plot.points].sort((a, b) => a.x - b.x);
		const { evaluate } = buildMonotoneSpline(sorted, x => x, y => y);
		const [x0, x1] = plot.domainX;
		const n = sorted.length;
		const xs = Array.from({ length: n }, (_, i) => x0 + ((x1 - x0) * i) / (n - 1));
		const nextPoints = xs.map((x, i) => {
			const y = clampValue(evaluate(x), plot.domainY);
			const id = sorted[i]?.id ?? `pt_norm_${i}`;
			return { id, x, y };
		});
		onChange({ ...plot, points: nextPoints, selection: [], brush: null });
	};

	return (
		<div className="panel-section">
			<div className="section-title">DATA</div>
			<div className="form-row inline-pair">
				<button className="btn" type="button" onClick={handleNormalize} disabled={plot.points.length < 2}>
					Normalize to domain
				</button>
				<button className="btn" type="button" onClick={handleCopy}>
					{copied ? "Copied" : "Copy JSON"}
				</button>
			</div>
			<div className="form-row">
				<textarea className="row-control" value={pointsJson} readOnly rows={8} style={{ fontFamily: "monospace" }} />
			</div>
		</div>
	);
}
