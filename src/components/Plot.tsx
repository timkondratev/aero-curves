import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { scaleLinear, line, curveMonotoneX } from "d3";
import type { PointerEvent, MouseEvent as ReactMouseEvent } from "react";
import type { PlotState, PointId } from "../state/reducer";
import {
	addPoint,
	clampValue,
	removePoint,
	sortPoints,
} from "../utils/geometry";
import { snapValue } from "../utils/snapping";

const MARGIN = { top: 20, right: 20, bottom: 32, left: 50 } as const;
const MIN_POINTS = 2;
const DEFAULT_HEIGHT = 360;
const BRUSH_ACTIVATE_PX = 3;

let pointIdCounter = 1;
const nextPointId = () => `pt_${pointIdCounter++}`;

type Props = {
	plot: PlotState;
	active: boolean;
	onActivate: () => void;
	onChange: (plot: PlotState) => void;
	onChangeTransient: (plot: PlotState) => void;
	onRemove?: () => void;
};

export function Plot({ plot, active, onActivate, onChange, onChangeTransient, onRemove }: Props) {
	const plotRef = useRef(plot);
	const frameRef = useRef<HTMLDivElement | null>(null);
	const [frameWidth, setFrameWidth] = useState(720);
	const [height] = useState(DEFAULT_HEIGHT);
	const brushStart = useRef<number | null>(null);
	const brushActive = useRef(false);
	const backgroundPointerActive = useRef(false);
	const dragState = useRef<{
		startX: number;
		startY: number;
		points: Map<PointId, { x: number; y: number }>;
	} | null>(null);

	useLayoutEffect(() => {
		const node = frameRef.current;
		if (!node) return;
		const observer = new ResizeObserver(entries => {
			const entry = entries[0];
			if (entry) setFrameWidth(entry.contentRect.width);
		});
		observer.observe(node);
		return () => observer.disconnect();
	}, []);

	const innerWidth = Math.max(200, frameWidth - MARGIN.left - MARGIN.right);
	const innerHeight = Math.max(120, height - MARGIN.top - MARGIN.bottom);

	const xScale = useMemo(
		() => scaleLinear().domain(plot.domainX).range([0, innerWidth]),
		[plot.domainX, innerWidth]
	);
	const yScale = useMemo(
		() => scaleLinear().domain(plot.domainY).range([innerHeight, 0]),
		[plot.domainY, innerHeight]
	);

	const pointsSorted = useMemo(
		() => [...plot.points].sort((a, b) => a.x - b.x),
		[plot.points]
	);

		const gridXLines = useMemo(() => {
			if (!plot.showGridX) return [] as number[];
			const step = plot.snapPrecisionX || 1;
			if (step <= 0) return [] as number[];
			const [min, max] = plot.domainX;
			const start = Math.ceil(min / step) * step;
			const lines: number[] = [];
			for (let v = start; v <= max; v = parseFloat((v + step).toFixed(8))) {
				lines.push(v);
				if (lines.length > 500) break; // safety guard
			}
			return lines;
		}, [plot.showGridX, plot.snapPrecisionX, plot.domainX]);

		const gridYLines = useMemo(() => {
			if (!plot.showGridY) return [] as number[];
			const step = plot.snapPrecisionY || 1;
			if (step <= 0) return [] as number[];
			const [min, max] = plot.domainY;
			const start = Math.ceil(min / step) * step;
			const lines: number[] = [];
			for (let v = start; v <= max; v = parseFloat((v + step).toFixed(8))) {
				lines.push(v);
				if (lines.length > 500) break; // safety guard
			}
			return lines;
		}, [plot.showGridY, plot.snapPrecisionY, plot.domainY]);

	const pathD = useMemo(() => {
		return (
			line<typeof pointsSorted[number]>()
				.x(d => xScale(d.x))
				.y(d => yScale(d.y))
				.curve(curveMonotoneX)(pointsSorted) ?? ""
		);
	}, [pointsSorted, xScale, yScale]);

	const selection = useMemo(() => new Set(plot.selection), [plot.selection]);

	plotRef.current = plot;

	const updatePlot = (partial: Partial<PlotState>) => {
		const next = { ...plotRef.current, ...partial } as PlotState;
		plotRef.current = next;
		onChange(next);
	};

	const updatePlotTransient = (partial: Partial<PlotState>) => {
		const next = { ...plotRef.current, ...partial } as PlotState;
		plotRef.current = next;
		onChangeTransient(next);
	};

	const setSelection = (ids: PointId[]) => updatePlotTransient({ selection: ids });
	const setBrush = (brush: [number, number] | null) => updatePlotTransient({ brush });
	const setPoints = (pts: PlotState["points"]) => updatePlot({ points: pts });
	const setPointsTransient = (pts: PlotState["points"]) => updatePlotTransient({ points: pts });

	const snapX = (value: number) => snapValue(value, plot.snapX, plot.snapPrecisionX);
	const snapY = (value: number) => snapValue(value, plot.snapY, plot.snapPrecisionY);

	const handleBackgroundPointerDown = (e: PointerEvent<SVGSVGElement>) => {
		const { x } = getLocalCoords(e);
		brushStart.current = x;
		brushActive.current = false;
		backgroundPointerActive.current = true;
	};

	const handleBackgroundPointerMove = (e: PointerEvent<SVGSVGElement>) => {
		if (brushStart.current === null) return;
		const { x } = getLocalCoords(e);
		const dx = Math.abs(x - brushStart.current);
		if (!brushActive.current && dx < BRUSH_ACTIVATE_PX) return;
		if (!brushActive.current) {
			brushActive.current = true;
			e.currentTarget.setPointerCapture(e.pointerId);
		}
		setBrush([brushStart.current, x]);
		const [a, b] = [brushStart.current, x].sort((m, n) => m - n);
		const ids = pointsSorted
			.filter(p => {
				const sx = xScale(p.x);
				return sx >= a && sx <= b;
			})
			.map(p => p.id);
		setSelection(ids);
	};

	const handleBackgroundPointerUp = (e: PointerEvent<SVGSVGElement>) => {
		if (brushActive.current) {
			e.currentTarget.releasePointerCapture(e.pointerId);
		}
		if (backgroundPointerActive.current && !brushActive.current && selection.size) {
			setSelection([]);
		}
		brushStart.current = null;
		brushActive.current = false;
		backgroundPointerActive.current = false;
		setBrush(null);
	};

	const startDrag = (id: PointId, e: PointerEvent<SVGCircleElement>) => {
		e.stopPropagation();
		const withModifier = e.metaKey || e.ctrlKey || e.shiftKey;
		if (!selection.has(id) && !withModifier) {
			setSelection([id]);
		} else if (withModifier) {
			const next = new Set(selection);
			next.has(id) ? next.delete(id) : next.add(id);
			setSelection([...next]);
		}

		const start = getLocalCoords(e);
		const map = new Map<PointId, { x: number; y: number }>();
		plot.points.forEach(p => {
			if (selection.has(p.id) || p.id === id) map.set(p.id, { x: p.x, y: p.y });
		});
		dragState.current = { startX: start.x, startY: start.y, points: map };
		e.currentTarget.setPointerCapture(e.pointerId);
	};

	const handlePointMove = (e: PointerEvent<SVGCircleElement>) => {
		if (!dragState.current) return;
		const { x, y } = getLocalCoords(e);
		const dx = xScale.invert(x) - xScale.invert(dragState.current.startX);
		const dy = yScale.invert(y) - yScale.invert(dragState.current.startY);
		const idsToMove = new Set(selection.size ? selection : Array.from(dragState.current.points.keys()));
		const sorted = sortPoints(plotRef.current.points);
		const indexById = new Map(sorted.map((p, idx) => [p.id, idx] as const));

		const nextPoints = plotRef.current.points.map(p => {
			if (!idsToMove.has(p.id)) return p;
			const origin = dragState.current!.points.get(p.id) ?? { x: p.x, y: p.y };
			const idx = indexById.get(p.id) ?? 0;
			let left = plotRef.current.domainX[0];
			for (let i = idx - 1; i >= 0; i--) {
				const neighbor = sorted[i];
				if (!idsToMove.has(neighbor.id)) {
					left = Math.max(left, neighbor.x);
					break;
				}
			}
			let right = plotRef.current.domainX[1];
			for (let i = idx + 1; i < sorted.length; i++) {
				const neighbor = sorted[i];
				if (!idsToMove.has(neighbor.id)) {
					right = Math.min(right, neighbor.x);
					break;
				}
			}
			const rawX = origin.x + dx;
			const clampedX = clampValue(clampValue(rawX, [left, right]), plotRef.current.domainX);
			const clampedY = clampValue(origin.y + dy, plotRef.current.domainY);
			const nx = snapX(clampedX);
			const ny = snapY(clampedY);
			return { ...p, x: nx, y: ny };
		});
		setPointsTransient(sortPoints(nextPoints));
	};

	const endDrag = (e: PointerEvent<SVGCircleElement>) => {
		e.currentTarget.releasePointerCapture(e.pointerId);
		if (dragState.current) {
			// Commit the dragged points to history once per drag
			onChange(plotRef.current);
		}
		dragState.current = null;
	};

	const handleDoubleClickBackground = (e: ReactMouseEvent<SVGSVGElement>) => {
		const { x, y } = getLocalCoords(e);
		const domainX = xScale.invert(x);
		const domainY = yScale.invert(y);
		const pt = { id: nextPointId(), x: domainX, y: domainY };
		setPoints(addPoint(plotRef.current.points, pt));
		setSelection([]);
	};

	const handleDoubleClickPoint = (id: PointId, e: ReactMouseEvent<SVGCircleElement>) => {
		e.stopPropagation();
		if (plotRef.current.points.length <= MIN_POINTS) return;
		setPoints(removePoint(plotRef.current.points, id));
		setSelection([]);
	};

	const getLocalCoords = (
		e: PointerEvent<SVGSVGElement | SVGCircleElement> | ReactMouseEvent<SVGSVGElement | SVGCircleElement>
	) => {
		const svg = (e.currentTarget.ownerSVGElement ?? e.currentTarget) as SVGSVGElement;
		const rect = svg.getBoundingClientRect();
		return { x: e.clientX - rect.left - MARGIN.left, y: e.clientY - rect.top - MARGIN.top };
	};

	const renderBrush = () => {
		if (!plot.brush) return null;
		const [a, b] = plot.brush;
		const x = Math.min(a, b);
		const w = Math.abs(a - b);
		return (
			<rect
				x={x}
				y={0}
				width={w}
				height={innerHeight}
				className="plot-brush"
				pointerEvents="none"
			/>
		);
	};

	const renderSelectionBounds = () => {
		if (!selection.size) return null;
		const selected = pointsSorted.filter(p => selection.has(p.id));
		if (!selected.length) return null;
		const xs = selected.map(p => p.x);
		const ys = selected.map(p => p.y);
		const minX = Math.min(...xs);
		const maxX = Math.max(...xs);
		const minY = Math.min(...ys);
		const maxY = Math.max(...ys);
		return (
			<g className="selection-bounds" pointerEvents="none">
				<line className="selection-x-line" x1={xScale(minX)} x2={xScale(minX)} y1={0} y2={innerHeight} />
				<line className="selection-x-line" x1={xScale(maxX)} x2={xScale(maxX)} y1={0} y2={innerHeight} />
				<line className="selection-y-line" x1={0} x2={innerWidth} y1={yScale(minY)} y2={yScale(minY)} />
				<line className="selection-y-line" x1={0} x2={innerWidth} y1={yScale(maxY)} y2={yScale(maxY)} />
			</g>
		);
	};

	return (
		<div className={`plot-card${active ? " is-active" : ""}`} onPointerDownCapture={onActivate}>
			<div className="plot-header">
				<strong>{plot.name}</strong>
				<span className="plot-meta">points: {plot.points.length}</span>
				{onRemove && (
					<button className="btn" onClick={onRemove} style={{ marginLeft: "auto" }}>
						Remove
					</button>
				)}
			</div>

			<div ref={frameRef} className="plot-frame">
				<svg
					className="plot-svg"
					width={frameWidth}
					height={height}
					onPointerDown={handleBackgroundPointerDown}
					onPointerMove={handleBackgroundPointerMove}
					onPointerUp={handleBackgroundPointerUp}
					onDoubleClick={handleDoubleClickBackground}
				>
					<g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
						{/* Grid */}
						<g className="plot-grid" pointerEvents="none">
							{gridXLines.map(v => (
								<line key={`gx-${v}`} x1={xScale(v)} x2={xScale(v)} y1={0} y2={innerHeight} />
							))}
							{gridYLines.map(v => (
								<line key={`gy-${v}`} x1={0} x2={innerWidth} y1={yScale(v)} y2={yScale(v)} />
							))}
						</g>

						{/* Axes */}
						<line x1={0} x2={innerWidth} y1={innerHeight} y2={innerHeight} stroke="black" />
						{scaleLinear().domain(plot.domainX).ticks(10).map(tick => (
							<g key={tick} transform={`translate(${xScale(tick)}, ${innerHeight})`}>
								<line y2={6} stroke="black" />
								<text y={20} textAnchor="middle" fontSize={12}>
									{tick}
								</text>
							</g>
						))}
						<line x1={0} x2={0} y1={0} y2={innerHeight} stroke="black" />
						{scaleLinear().domain(plot.domainY).ticks(10).map(tick => (
							<g key={tick} transform={`translate(0, ${yScale(tick)})`}>
								<line x2={-6} stroke="black" />
								<text x={-10} dy="0.32em" textAnchor="end" fontSize={12}>
									{tick}
								</text>
							</g>
						))}

						{/* Zero axes */}
						{plot.domainX[0] <= 0 && plot.domainX[1] >= 0 && (
							<line x1={xScale(0)} x2={xScale(0)} y1={0} y2={innerHeight} stroke="#888" strokeWidth={1} />
						)}
						{plot.domainY[0] <= 0 && plot.domainY[1] >= 0 && (
							<line x1={0} x2={innerWidth} y1={yScale(0)} y2={yScale(0)} stroke="#888" strokeWidth={1} />
						)}

						{/* Curve */}
						<path d={pathD} fill="none" stroke="black" strokeWidth={1.5} />

						{/* Selection bounds */}
						{renderSelectionBounds()}

						{/* Brush */}
						{renderBrush()}

						{/* Points */}
						{pointsSorted.map(p => (
							<circle
								key={p.id}
								cx={xScale(p.x)}
								cy={yScale(p.y)}
								r={5}
								fill={selection.has(p.id) ? "black" : "white"}
								stroke="black"
								style={{ cursor: "pointer" }}
								onPointerDown={e => startDrag(p.id, e)}
								onPointerMove={handlePointMove}
								onPointerUp={endDrag}
								onDoubleClick={e => handleDoubleClickPoint(p.id, e)}
							/>
						))}
					</g>
				</svg>
			</div>
		</div>
	);
}
