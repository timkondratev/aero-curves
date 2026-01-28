import type { Dispatch, SetStateAction, ChangeEvent } from "react";
import type { PlotState } from "../../state/reducer";
import { clampValue } from "../../utils/geometry";
import { onEnterBlur, startNumberDrag } from "./numberDrag";

type ScaleDraft = { x: string; y: string };

type Props = {
	plot: PlotState;
	scaleDraft: ScaleDraft;
	setScaleDraft: Dispatch<SetStateAction<ScaleDraft>>;
	onChange: (plot: PlotState) => void;
	handleBackgroundFile: (e: ChangeEvent<HTMLInputElement>) => void;
	handleBackgroundOpacity: (e: ChangeEvent<HTMLInputElement>) => void;
	handleBackgroundOffset: (axis: "x" | "y") => (e: ChangeEvent<HTMLInputElement>) => void;
	commitBackgroundScale: (axis: "x" | "y", override?: number) => void;
	clearBackground: () => void;
	offsetStepX: number;
	offsetStepY: number;
	scaleStepX: number;
	scaleStepY: number;
};

export function BackgroundPanel({
	plot,
	scaleDraft,
	setScaleDraft,
	onChange,
	handleBackgroundFile,
	handleBackgroundOpacity,
	handleBackgroundOffset,
	commitBackgroundScale,
	clearBackground,
	offsetStepX,
	offsetStepY,
	scaleStepX,
	scaleStepY,
}: Props) {
	const bg = plot.background;
	return (
		<div className="panel-section">
			<div className="section-title">BACKGROUND IMAGE</div>
			<div className="form-row">
				<div className="row-label">Image</div>
				<input className="row-control" type="file" accept="image/*" onChange={handleBackgroundFile} />
			</div>
			<div className="form-row inline-pair">
				<div className="row-label">Loaded</div>
				<div className="row-static">{bg.name ?? "None"}</div>
				<div className="row-static">{bg.naturalWidth && bg.naturalHeight ? `${bg.naturalWidth}x${bg.naturalHeight}` : ""}</div>
				{bg.src && (
					<button className="btn" type="button" onClick={clearBackground}>
						Clear
					</button>
				)}
			</div>
			<div className="form-row inline-pair">
				<div className="row-label">Opacity</div>
				<input
					className="row-control"
					type="range"
					min={0}
					max={1}
					step={0.05}
					value={bg.opacity}
					onChange={handleBackgroundOpacity}
				/>
				<div className="row-static">{bg.opacity.toFixed(2)}</div>
			</div>
			<div className="form-row inline-pair">
				<div className="row-label">Offset</div>
				<label className="mini-label">X</label>
				<input
					className="row-control"
					type="number"
					step={offsetStepX}
					value={bg.offsetX}
					onChange={handleBackgroundOffset("x")}
					onMouseDown={e =>
						startNumberDrag(
							e,
							() => bg.offsetX,
							val =>
								onChange({
									...plot,
									background: { ...plot.background, offsetX: val },
								}),
							offsetStepX
						)
					}
					disabled={!bg.src}
				/>
				<label className="mini-label">Y</label>
				<input
					className="row-control"
					type="number"
					step={offsetStepY}
					value={bg.offsetY}
					onChange={handleBackgroundOffset("y")}
					onMouseDown={e =>
						startNumberDrag(
							e,
							() => bg.offsetY,
							val =>
								onChange({
									...plot,
									background: { ...plot.background, offsetY: val },
								}),
							offsetStepY
						)
					}
					disabled={!bg.src}
				/>
			</div>
			<div className="form-row inline-pair">
				<div className="row-label">Scale</div>
				<label className="mini-label">X</label>
				<input
					className="row-control"
					type="number"
					step={scaleStepX}
					value={scaleDraft.x}
					onChange={e => setScaleDraft(d => ({ ...d, x: e.target.value }))}
					onBlur={() => commitBackgroundScale("x")}
					onKeyDown={onEnterBlur}
					onMouseDown={e =>
						startNumberDrag(
							e,
							() => parseFloat(scaleDraft.x) || 0,
							val => {
								const clamped = clampValue(val, [0.1, 10]);
								setScaleDraft(d => ({ ...d, x: String(clamped) }));
								commitBackgroundScale("x", clamped);
							},
							scaleStepX
						)
					}
					disabled={!bg.src}
				/>
				<label className="mini-label">Y</label>
				<input
					className="row-control"
					type="number"
					step={scaleStepY}
					value={scaleDraft.y}
					onChange={e => setScaleDraft(d => ({ ...d, y: e.target.value }))}
					onBlur={() => commitBackgroundScale("y")}
					onKeyDown={onEnterBlur}
					onMouseDown={e =>
						startNumberDrag(
							e,
							() => parseFloat(scaleDraft.y) || 0,
							val => {
								const clamped = clampValue(val, [0.1, 10]);
								setScaleDraft(d => ({ ...d, y: String(clamped) }));
								commitBackgroundScale("y", clamped);
							},
							scaleStepY
						)
					}
					disabled={!bg.src}
				/>
			</div>
		</div>
	);
}
