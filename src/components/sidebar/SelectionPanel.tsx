import { useState } from "react";
import { onEnterBlur, startNumberDrag } from "./numberDrag";

type CoordDraft = { x: string; y: string };

type Props = {
	center: { x: number; y: number } | null;
	selectedCount: number;
	commitCoord: (axis: "x" | "y", override?: number) => void;
};

export function SelectionPanel({ center, selectedCount, commitCoord }: Props) {
	const [coordDraft, setCoordDraft] = useState<CoordDraft>(() => ({
		x: center ? String(center.x) : "",
		y: center ? String(center.y) : "",
	}));

	const commitDraft = (axis: "x" | "y") => {
		const raw = axis === "x" ? coordDraft.x : coordDraft.y;
		const val = parseFloat(raw);
		if (Number.isNaN(val)) return;
		commitCoord(axis, val);
	};

	return (
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
					onBlur={() => commitDraft("x")}
					onKeyDown={onEnterBlur}
					onMouseDown={e =>
						startNumberDrag(
							e,
							() => parseFloat(coordDraft.x) || 0,
							val => {
								setCoordDraft(d => ({ ...d, x: String(val) }));
								commitCoord("x", val);
							},
							0.5
						)
					}
					disabled={!center}
				/>
				<label className="mini-label">Y</label>
				<input
					className="row-control"
					type="number"
					value={coordDraft.y}
					onChange={e => setCoordDraft(d => ({ ...d, y: e.target.value }))}
					onBlur={() => commitDraft("y")}
					onKeyDown={onEnterBlur}
					onMouseDown={e =>
						startNumberDrag(
							e,
							() => parseFloat(coordDraft.y) || 0,
							val => {
								setCoordDraft(d => ({ ...d, y: String(val) }));
								commitCoord("y", val);
							},
							0.5
						)
					}
					disabled={!center}
				/>
			</div>
			<div className="form-row">
				<div className="row-label">Selected</div>
				<div className="row-static">{selectedCount}</div>
			</div>
		</div>
	);
}
