import type { PlotId } from "../state/reducer";

type ToolButtonProps = {
	label: string;
	tooltip: string;
	onClick: () => void;
	disabled?: boolean;
};

function ToolButton({ label, tooltip, onClick, disabled = false }: ToolButtonProps) {
	return (
		<span className="toolbar-tooltip-target" title={tooltip}>
			<button className="btn" onClick={onClick} disabled={disabled} aria-label={tooltip}>
				{label}
			</button>
		</span>
	);
}

type Props = {
	activePlotId: PlotId | null;
	onAddPlot: () => void;
	onNormalize: () => void;
	onFlipX: () => void;
	onFlipY: () => void;
	onMirrorLeft: () => void;
	onMirrorRight: () => void;
	onTrim: () => void;
	onDuplicateLeft: () => void;
	onDuplicateRight: () => void;
	onCopy: () => void;
	onPaste: () => void;
	canNormalize: boolean;
	canFlip: boolean;
	canMirror: boolean;
};

export function ToolBar({
	activePlotId,
	onAddPlot,
	onNormalize,
	onFlipX,
	onFlipY,
	onMirrorLeft,
	onMirrorRight,
	onTrim,
	onDuplicateLeft,
	onDuplicateRight,
	onCopy,
	onPaste,
	canNormalize,
	canFlip,
	canMirror,
}: Props) {
	return (
		<div className="toolbar">
			<ToolButton
				label="+ Add plot"
				tooltip="Create a new curve with the default formula, points, grid, snapping, and background settings."
				onClick={onAddPlot}
			/>
			<ToolButton
				label="Normalize"
				tooltip="Resample the whole curve across the current X domain using the current X snap step, then clear the selection."
				onClick={onNormalize}
				disabled={!activePlotId || !canNormalize}
			/>
			<ToolButton
				label="Flip Y"
				tooltip="Invert the selected points vertically around Y = 0, then clamp and snap them to the current Y domain."
				onClick={onFlipY}
				disabled={!activePlotId || !canFlip}
			/>
			<ToolButton
				label="Flip X"
				tooltip="Reflect the selected points horizontally within their current X span, then clamp and snap them to the current X domain."
				onClick={onFlipX}
				disabled={!activePlotId || !canFlip}
			/>
			<ToolButton
				label="Mirror L"
				tooltip="Copy the selection to the left by mirroring it around the left edge and replace overlapping points in that span."
				onClick={onMirrorLeft}
				disabled={!activePlotId || !canMirror}
			/>
			<ToolButton
				label="Mirror R"
				tooltip="Copy the selection to the right by mirroring it around the right edge and replace overlapping points in that span."
				onClick={onMirrorRight}
				disabled={!activePlotId || !canMirror}
			/>
			<ToolButton
				label="Duplicate L"
				tooltip="Duplicate the selected span to the left with the same shape and replace overlapping points in the duplicated range."
				onClick={onDuplicateLeft}
				disabled={!activePlotId || !canFlip}
			/>
			<ToolButton
				label="Duplicate R"
				tooltip="Duplicate the selected span to the right with the same shape and replace overlapping points in the duplicated range."
				onClick={onDuplicateRight}
				disabled={!activePlotId || !canFlip}
			/>
			<ToolButton
				label="Copy"
				tooltip="Copy the selected points to the clipboard as point data and keep an in-memory copy as a fallback."
				onClick={onCopy}
				disabled={!activePlotId || !canFlip}
			/>
			<ToolButton
				label="Paste"
				tooltip="Replace the selected span with points from the clipboard, aligned to the first selected X position and clamped to the current domains."
				onClick={onPaste}
				disabled={!activePlotId || !canFlip}
			/>
			<ToolButton
				label="Trim selection"
				tooltip="Keep only points whose X positions fall within the selected range."
				onClick={onTrim}
				disabled={!activePlotId || !canMirror}
			/>
		</div>
	);
}
