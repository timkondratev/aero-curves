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

	const handleShowGridToggle = (axis: "x" | "y") => (e: ChangeEvent<HTMLInputElement>) => {
		const enabled = e.target.checked;
		const next: PlotState = axis === "x" ? { ...plot, showGridX: enabled } : { ...plot, showGridY: enabled };
		onChange(next);
	};

	const handleSnapToggle = (axis: "x" | "y") => (e: ChangeEvent<HTMLInputElement>) => {
		const enabled = e.target.checked;
		const next: PlotState = axis === "x" ? { ...plot, snapX: enabled } : { ...plot, snapY: enabled };
		onChange(next);
	};

	const handleSnapPrecision = (axis: "x" | "y") => (e: ChangeEvent<HTMLInputElement>) => {
		const value = parseFloat(e.target.value);
		if (Number.isNaN(value) || value <= 0) return;
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
			<div className="panel-section">
				<div className="section-title">SELECTION</div>
				<div className="form-row inline-pair">
					<div className="row-label">Coordinate</div>
					<label className="mini-label">X</label>
					<input
						className="row-control"
						type="number"
						value={center ? center.x : ""}
						onChange={handleCoordChange("x")}
						disabled={!center}
					/>
					<label className="mini-label">Y</label>
					<input
						className="row-control"
						type="number"
						value={center ? center.y : ""}
						onChange={handleCoordChange("y")}
						disabled={!center}
					/>
				</div>
			</div>

			<div className="panel-section">
				<div className="section-title">GRID</div>
				<div className="form-row inline-pair">
					<div className="row-label">Show grid</div>
					<label className="mini-label" htmlFor="grid-show-x">X</label>
					<input id="grid-show-x" type="checkbox" checked={plot.showGridX} onChange={handleShowGridToggle("x")} />
					<label className="mini-label" htmlFor="grid-show-y">Y</label>
					<input id="grid-show-y" type="checkbox" checked={plot.showGridY} onChange={handleShowGridToggle("y")} />
				</div>
				<div className="form-row inline-pair">
					<div className="row-label">Snap to grid</div>
					<label className="mini-label" htmlFor="snap-x">X</label>
					<input id="snap-x" type="checkbox" checked={plot.snapX} onChange={handleSnapToggle("x")} />
					<label className="mini-label" htmlFor="snap-y">Y</label>
					<input id="snap-y" type="checkbox" checked={plot.snapY} onChange={handleSnapToggle("y")} />
				</div>
				<div className="form-row inline-pair">
					<div className="row-label">Step</div>
					<label className="mini-label">X</label>
					<input
						className="row-control"
						type="number"
						step="any"
						min={0.000001}
						value={plot.snapPrecisionX}
						onChange={handleSnapPrecision("x")}
					/>
					<label className="mini-label">Y</label>
					<input
						className="row-control"
						type="number"
						step="any"
						min={0.000001}
						value={plot.snapPrecisionY}
						onChange={handleSnapPrecision("y")}
					/>
				</div>
			</div>

			<div className="panel-section">
				<div className="section-title">PLOT</div>
				<div className="form-row">
					<div className="row-label">Name</div>
					<input className="row-control" value={plot.name} onChange={handleNameChange} />
				</div>
				<div className="form-row inline-pair">
					<div className="row-label">Domain X</div>
					<input
						className="row-control"
						type="number"
						value={plot.domainX[0]}
						onChange={handleDomainChange("x", 0)}
					/>
					<input
						className="row-control"
						type="number"
						value={plot.domainX[1]}
						onChange={handleDomainChange("x", 1)}
					/>
				</div>
				<div className="form-row inline-pair">
					<div className="row-label">Domain Y</div>
					<input
						className="row-control"
						type="number"
						value={plot.domainY[0]}
						onChange={handleDomainChange("y", 0)}
					/>
					<input
						className="row-control"
						type="number"
						value={plot.domainY[1]}
						onChange={handleDomainChange("y", 1)}
					/>
				</div>
			</div>
		</div>
	);
}
