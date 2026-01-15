import { useEffect, useState, type ChangeEvent, type KeyboardEvent } from "react";
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

	const [nameDraft, setNameDraft] = useState(plot.name);
	const [coordDraft, setCoordDraft] = useState<{ x: string; y: string }>({ x: center ? String(center.x) : "", y: center ? String(center.y) : "" });
	const [domainDraft, setDomainDraft] = useState<{ x0: string; x1: string; y0: string; y1: string }>({
		x0: String(plot.domainX[0]),
		x1: String(plot.domainX[1]),
		y0: String(plot.domainY[0]),
		y1: String(plot.domainY[1]),
	});
	const [stepDraft, setStepDraft] = useState<{ x: string; y: string }>({
		x: String(plot.snapPrecisionX),
		y: String(plot.snapPrecisionY),
	});

	useEffect(() => {
		setNameDraft(plot.name);
		setDomainDraft({
			x0: String(plot.domainX[0]),
			x1: String(plot.domainX[1]),
			y0: String(plot.domainY[0]),
			y1: String(plot.domainY[1]),
		});
		setStepDraft({ x: String(plot.snapPrecisionX), y: String(plot.snapPrecisionY) });
	}, [plot]);

	useEffect(() => {
		if (!selectedPoints.length || !center) {
			setCoordDraft({ x: "", y: "" });
			return;
		}
		setCoordDraft({ x: String(center.x), y: String(center.y) });
	}, [center, selectedPoints.length]);

	const commitName = () => {
		if (nameDraft === plot.name) return;
		onChange({ ...plot, name: nameDraft });
	};

	const commitDomain = (axis: "x" | "y", index: 0 | 1) => {
		const draftVal = axis === "x" ? (index === 0 ? domainDraft.x0 : domainDraft.x1) : index === 0 ? domainDraft.y0 : domainDraft.y1;
		const value = parseFloat(draftVal);
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

	const commitSnapPrecision = (axis: "x" | "y") => {
		const draftVal = axis === "x" ? stepDraft.x : stepDraft.y;
		const value = parseFloat(draftVal);
		if (Number.isNaN(value) || value <= 0) return;
		const next: PlotState = axis === "x" ? { ...plot, snapPrecisionX: value } : { ...plot, snapPrecisionY: value };
		onChange(next);
	};

	const commitCoord = (axis: "x" | "y") => {
		const draftVal = axis === "x" ? coordDraft.x : coordDraft.y;
		const val = parseFloat(draftVal);
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

	const onEnter = (e: KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter") {
			e.currentTarget.blur();
		}
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
						value={coordDraft.x}
						onChange={e => setCoordDraft(d => ({ ...d, x: e.target.value }))}
						onBlur={() => commitCoord("x")}
						onKeyDown={onEnter}
						disabled={!center}
					/>
					<label className="mini-label">Y</label>
					<input
						className="row-control"
						type="number"
						value={coordDraft.y}
						onChange={e => setCoordDraft(d => ({ ...d, y: e.target.value }))}
						onBlur={() => commitCoord("y")}
						onKeyDown={onEnter}
						disabled={!center}
					/>
				</div>
				<div className="form-row inline-pair">
					<div className="row-label">Step</div>
					<label className="mini-label">X</label>
					<input
						className="row-control"
						type="number"
						step="any"
						min={0.000001}
						value={stepDraft.x}
						onChange={e => setStepDraft(d => ({ ...d, x: e.target.value }))}
						onBlur={() => commitSnapPrecision("x")}
						onKeyDown={onEnter}
					/>
					<label className="mini-label">Y</label>
					<input
						className="row-control"
						type="number"
						step="any"
						min={0.000001}
						value={stepDraft.y}
						onChange={e => setStepDraft(d => ({ ...d, y: e.target.value }))}
						onBlur={() => commitSnapPrecision("y")}
						onKeyDown={onEnter}
					/>
				</div>
				<div className="form-row inline-pair">
					<div className="row-label">Snap</div>
					<label className="mini-label" htmlFor="snap-x">X</label>
					<input id="snap-x" type="checkbox" checked={plot.snapX} onChange={handleSnapToggle("x")} />
					<label className="mini-label" htmlFor="snap-y">Y</label>
					<input id="snap-y" type="checkbox" checked={plot.snapY} onChange={handleSnapToggle("y")} />
				</div>
				<div className="form-row inline-pair">
					<div className="row-label">Show grid</div>
					<label className="mini-label" htmlFor="grid-x">X</label>
					<input id="grid-x" type="checkbox" checked={plot.showGridX} onChange={handleShowGridToggle("x")} />
					<label className="mini-label" htmlFor="grid-y">Y</label>
					<input id="grid-y" type="checkbox" checked={plot.showGridY} onChange={handleShowGridToggle("y")} />
				</div>
			</div>

			<div className="panel-section">
				<div className="section-title">PLOT</div>
				<div className="form-row">
					<div className="row-label">Name</div>
					<input
						className="row-control"
						value={nameDraft}
						onChange={e => setNameDraft(e.target.value)}
						onBlur={commitName}
						onKeyDown={onEnter}
					/>
				</div>
				<div className="form-row inline-pair">
					<div className="row-label">Domain X</div>
					<input
						className="row-control"
						type="number"
						value={domainDraft.x0}
						onChange={e => setDomainDraft(d => ({ ...d, x0: e.target.value }))}
						onBlur={() => commitDomain("x", 0)}
						onKeyDown={onEnter}
					/>
					<input
						className="row-control"
						type="number"
						value={domainDraft.x1}
						onChange={e => setDomainDraft(d => ({ ...d, x1: e.target.value }))}
						onBlur={() => commitDomain("x", 1)}
						onKeyDown={onEnter}
					/>
				</div>
				<div className="form-row inline-pair">
					<div className="row-label">Domain Y</div>
					<input
						className="row-control"
						type="number"
						value={domainDraft.y0}
						onChange={e => setDomainDraft(d => ({ ...d, y0: e.target.value }))}
						onBlur={() => commitDomain("y", 0)}
						onKeyDown={onEnter}
					/>
					<input
						className="row-control"
						type="number"
						value={domainDraft.y1}
						onChange={e => setDomainDraft(d => ({ ...d, y1: e.target.value }))}
						onBlur={() => commitDomain("y", 1)}
						onKeyDown={onEnter}
					/>
				</div>
			</div>
		</div>
	);
}
