import type { Dispatch, SetStateAction, ChangeEventHandler } from "react";
import type { PlotState } from "../../state/reducer";
import { onEnterBlur, startNumberDrag } from "./numberDrag";

type StepDraft = { x: string; y: string };

type Props = {
	plot: PlotState;
	stepDraft: StepDraft;
	setStepDraft: Dispatch<SetStateAction<StepDraft>>;
	commitSnapPrecision: (axis: "x" | "y", override?: number) => void;
	handleSnapToggle: (axis: "x" | "y") => ChangeEventHandler<HTMLInputElement>;
	handleShowGridToggle: (axis: "x" | "y") => ChangeEventHandler<HTMLInputElement>;
};

export function GridPanel({ plot, stepDraft, setStepDraft, commitSnapPrecision, handleSnapToggle, handleShowGridToggle }: Props) {
	return (
		<div className="panel-section">
			<div className="section-title">GRID</div>
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
					onKeyDown={onEnterBlur}
					onMouseDown={e =>
						startNumberDrag(
							e,
							() => parseFloat(stepDraft.x) || 0,
							val => {
								const next = Math.max(val, 0.000001);
								setStepDraft(d => ({ ...d, x: String(next) }));
								commitSnapPrecision("x", next);
							},
							0.05
						)
					}
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
					onKeyDown={onEnterBlur}
					onMouseDown={e =>
						startNumberDrag(
							e,
							() => parseFloat(stepDraft.y) || 0,
							val => {
								const next = Math.max(val, 0.000001);
								setStepDraft(d => ({ ...d, y: String(next) }));
								commitSnapPrecision("y", next);
							},
							0.05
						)
					}
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
	);
}
