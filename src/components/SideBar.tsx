import type { ChangeEvent } from "react";
import type { PlotState } from "../state/reducer";

type Props = {
	plot: PlotState | null;
	onChange: (plot: PlotState) => void;
};

export function SideBar({ plot, onChange }: Props) {
	if (!plot) {
		return <div className="plot-meta">Select a plot to edit.</div>;
	}

	const handleNameChange = (e: ChangeEvent<HTMLInputElement>) => {
		onChange({ ...plot, name: e.target.value });
	};

	const handleDomainChange = (axis: "x" | "y", index: 0 | 1) => (e: ChangeEvent<HTMLInputElement>) => {
		const value = parseFloat(e.target.value);
		if (Number.isNaN(value)) return;
		if (axis === "x") {
			const next: PlotState = { ...plot, domainX: index === 0 ? [value, plot.domainX[1]] : [plot.domainX[0], value] };
			onChange(next);
		} else {
			const next: PlotState = { ...plot, domainY: index === 0 ? [value, plot.domainY[1]] : [plot.domainY[0], value] };
			onChange(next);
		}
	};

	const handleSnapToggle = (axis: "x" | "y") => (e: ChangeEvent<HTMLInputElement>) => {
		const enabled = e.target.checked;
		const next: PlotState =
			axis === "x" ? { ...plot, snapX: enabled } : { ...plot, snapY: enabled };
		onChange(next);
	};

	const handleSnapPrecision = (axis: "x" | "y") => (e: ChangeEvent<HTMLSelectElement>) => {
		const value = parseFloat(e.target.value);
		const next: PlotState =
			axis === "x" ? { ...plot, snapPrecisionX: value } : { ...plot, snapPrecisionY: value };
		onChange(next);
	};

	return (
		<div className="sidebar-form">
			<label className="field">
				Name
				<input value={plot.name} onChange={handleNameChange} />
			</label>

			<div className="field-grid">
				<label className="field">
					X min
					<input type="number" value={plot.domainX[0]} onChange={handleDomainChange("x", 0)} />
				</label>
				<label className="field">
					X max
					<input type="number" value={plot.domainX[1]} onChange={handleDomainChange("x", 1)} />
				</label>
				<label className="field">
					Y min
					<input type="number" value={plot.domainY[0]} onChange={handleDomainChange("y", 0)} />
				</label>
				<label className="field">
					Y max
					<input type="number" value={plot.domainY[1]} onChange={handleDomainChange("y", 1)} />
				</label>
			</div>

			<label className="checkbox-row">
				<input type="checkbox" checked={plot.snapX} onChange={handleSnapToggle("x")} /> Snap X
			</label>
			<label className="checkbox-row">
				<input type="checkbox" checked={plot.snapY} onChange={handleSnapToggle("y")} /> Snap Y
			</label>

			<label className="field">
				Snap precision X
				<select value={plot.snapPrecisionX} onChange={handleSnapPrecision("x")}>
					<option value={1}>1</option>
					<option value={0.1}>0.1</option>
					<option value={0.01}>0.01</option>
				</select>
			</label>
			<label className="field">
				Snap precision Y
				<select value={plot.snapPrecisionY} onChange={handleSnapPrecision("y")}>
					<option value={1}>1</option>
					<option value={0.1}>0.1</option>
					<option value={0.01}>0.01</option>
				</select>
			</label>
		</div>
	);
}
