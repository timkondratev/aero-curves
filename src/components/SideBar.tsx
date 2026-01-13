import type { ChangeEvent } from "react";
import type { PlotState, PointId } from "../state/reducer";
import { clampValue, sortPoints } from "../utils/geometry";
import { snapValue } from "../utils/snapping";

type Props = {
	plot: PlotState | null;
	onChange: (plot: PlotState) => void;
};

export function SideBar({ plot, onChange }: Props) {
	if (!plot) {
		return <div className="plot-meta">Select a plot to edit.</div>;
	}

	const selection = new Set<PointId>(plot.selection);
	const selectedPoints = plot.points.filter(p => selection.has(p.id));
	const center = (() => {
		if (!selectedPoints.length) return null;
		if (selectedPoints.length === 1) return { x: selectedPoints[0].x, y: selectedPoints[0].y };
		const xs = selectedPoints.map(p => p.x);
		const ys = selectedPoints.map(p => p.y);
		return {
			x: (Math.min(...xs) + Math.max(...xs)) / 2,
			y: (Math.min(...ys) + Math.max(...ys)) / 2,
		};
	})();

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

	const handleCoordChange = (axis: "x" | "y") => (e: ChangeEvent<HTMLInputElement>) => {
		const val = parseFloat(e.target.value);
		if (!selectedPoints.length || Number.isNaN(val)) return;
		const snapEnabled = axis === "x" ? plot.snapX : plot.snapY;
		const precision = axis === "x" ? plot.snapPrecisionX : plot.snapPrecisionY;
		const domain = axis === "x" ? plot.domainX : plot.domainY;

		if (selectedPoints.length === 1) {
			const id = selectedPoints[0].id;
			const nextPoints = sortPoints(
				plot.points.map(p => {
					if (p.id !== id) return p;
					const snapped = snapValue(val, snapEnabled, precision);
					return axis === "x"
						? { ...p, x: clampValue(snapped, domain) }
						: { ...p, y: clampValue(snapped, domain) };
				})
			);
			onChange({ ...plot, points: nextPoints });
			return;
		}

		// For multiple points, shift selection so its center moves to the target value
		const currentCenter = center;
		if (!currentCenter) return;
		const delta = val - (axis === "x" ? currentCenter.x : currentCenter.y);
		const nextPoints = sortPoints(
			plot.points.map(p => {
				if (!selection.has(p.id)) return p;
				const shifted = axis === "x" ? p.x + delta : p.y + delta;
				const snapped = snapValue(shifted, snapEnabled, precision);
				if (axis === "x") return { ...p, x: clampValue(snapped, domain) };
				return { ...p, y: clampValue(snapped, domain) };
			})
		);
		onChange({ ...plot, points: nextPoints });
	};

	return (
		<div className="sidebar-form">
			<label className="field">
				Name
				<input value={plot.name} onChange={handleNameChange} />
			</label>

			<label className="field">
				X
				<input
					type="number"
					value={center ? center.x : ""}
					onChange={handleCoordChange("x")}
					disabled={!center}
				/>
			</label>
			<label className="field">
				Y
				<input
					type="number"
					value={center ? center.y : ""}
					onChange={handleCoordChange("y")}
					disabled={!center}
				/>
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
