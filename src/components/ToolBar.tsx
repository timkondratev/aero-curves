import type { PlotId } from "../state/reducer";

type Props = {
	activePlotId: PlotId | null;
	onAddPlot: () => void;
	onFlipX: () => void;
	onFlipY: () => void;
	onMirrorLeft: () => void;
	onMirrorRight: () => void;
	onTrim: () => void;
	onDuplicateLeft: () => void;
	onDuplicateRight: () => void;
	canFlip: boolean;
	canMirror: boolean;
};

export function ToolBar({
	activePlotId,
	onAddPlot,
	onFlipX,
	onFlipY,
	onMirrorLeft,
	onMirrorRight,
	onTrim,
	onDuplicateLeft,
	onDuplicateRight,
	canFlip,
	canMirror,
}: Props) {
	return (
		<div className="toolbar">
			<button className="btn" onClick={onAddPlot}>+ Add plot</button>
			<button className="btn" onClick={onFlipY} disabled={!activePlotId || !canFlip}>
				Flip Y
			</button>
			<button className="btn" onClick={onFlipX} disabled={!activePlotId || !canFlip}>
				Flip X
			</button>
			<button className="btn" onClick={onMirrorLeft} disabled={!activePlotId || !canMirror}>
				Mirror L
			</button>
			<button className="btn" onClick={onMirrorRight} disabled={!activePlotId || !canMirror}>
				Mirror R
			</button>
			<button className="btn" onClick={onDuplicateLeft} disabled={!activePlotId || !canFlip}>
				Duplicate L
			</button>
			<button className="btn" onClick={onDuplicateRight} disabled={!activePlotId || !canFlip}>
				Duplicate R
			</button>
			<button className="btn" onClick={onTrim} disabled={!activePlotId || !canMirror}>
				Trim selection
			</button>
		</div>
	);
}
