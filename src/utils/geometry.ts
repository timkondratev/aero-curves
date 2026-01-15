import type { PlotState, PointId } from "../state/reducer";
import { snapValue } from "./snapping";

type Point = PlotState["points"][number];

export const sortPoints = (pts: Point[]) => [...pts].sort((a, b) => a.x - b.x);

export const clampValue = (v: number, domain: [number, number]) => Math.min(domain[1], Math.max(domain[0], v));

const removePointsInRange = (points: Point[], minX: number, maxX: number, protectedIds: Set<PointId> = new Set()) => {
	return points.filter(p => protectedIds.has(p.id) || p.x < minX || p.x > maxX);
};

export const flipSelectionY = (
	points: Point[],
	selection: Set<PointId>,
	domainY: [number, number],
	snapEnabled: boolean,
	snapPrecision: number
): Point[] => {
	return sortPoints(
		points.map(p => {
			if (!selection.has(p.id)) return p;
			const y = snapValue(clampValue(-p.y, domainY), snapEnabled, snapPrecision);
			return { ...p, y };
		})
	);
};

export const flipSelectionX = (
	points: Point[],
	selection: Set<PointId>,
	domainX: [number, number],
	snapEnabled: boolean,
	snapPrecision: number
): Point[] => {
	const selected = points.filter(p => selection.has(p.id));
	if (!selected.length) return points;
	const minX = Math.min(...selected.map(p => p.x));
	const maxX = Math.max(...selected.map(p => p.x));
	return sortPoints(
		points.map(p => {
			if (!selection.has(p.id)) return p;
			const mirrored = maxX - (p.x - minX);
			const x = snapValue(clampValue(mirrored, domainX), snapEnabled, snapPrecision);
			return { ...p, x };
		})
	);
};

export const trimToSelection = (points: Point[], selection: Set<PointId>): Point[] => {
	const selected = points.filter(p => selection.has(p.id));
	if (selected.length < 2) return points;
	const minX = Math.min(...selected.map(p => p.x));
	const maxX = Math.max(...selected.map(p => p.x));
	return sortPoints(points.filter(p => p.x >= minX && p.x <= maxX));
};

export const addPoint = (points: Point[], point: Point): Point[] => {
	// Insert and keep x-sorted to preserve curve order
	return sortPoints([...points, point]);
};

export const removePoint = (points: Point[], id: PointId): Point[] => {
	// Guard against removing when id is absent
	const next = points.filter(p => p.id !== id);
	return next.length === points.length ? points : sortPoints(next);
};

export const mirrorSelectionRight = (
	points: Point[],
	selection: Set<PointId>,
	makeId: () => PointId
): { points: Point[]; selection: PointId[] } => {
	const sorted = sortPoints(points);
	const selected = sorted.filter(p => selection.has(p.id));
	if (selected.length < 2) return { points, selection: Array.from(selection) };

	const maxX = Math.max(...selected.map(p => p.x));

	// Mirror all but the anchor, nearest-to-anchor first for ascending order
	const mirrored = selected
		.slice(0, -1)
		.reverse()
		.map(p => ({ id: makeId(), x: maxX + (maxX - p.x), y: p.y }));
	const minNewX = Math.min(...mirrored.map(p => p.x));
	const maxNewX = Math.max(...mirrored.map(p => p.x));
	const retained = removePointsInRange(points, minNewX, maxNewX, selection);
	const nextPoints = sortPoints([...retained, ...mirrored]);
	const newSelection = [selected[selected.length - 1].id, ...mirrored.map(m => m.id)];
	return { points: nextPoints, selection: newSelection };
};

export const mirrorSelectionLeft = (
	points: Point[],
	selection: Set<PointId>,
	makeId: () => PointId
): { points: Point[]; selection: PointId[] } => {
	const sorted = sortPoints(points);
	const selected = sorted.filter(p => selection.has(p.id));
	if (selected.length < 2) return { points, selection: Array.from(selection) };

	const minX = Math.min(...selected.map(p => p.x));

	// Mirror all but the anchor, farthest-from-anchor first then reverse to keep ascending order
	const mirrored = selected
		.slice(1)
		.map(p => ({ id: makeId(), x: minX - (p.x - minX), y: p.y }))
		.reverse();
	const minNewX = Math.min(...mirrored.map(p => p.x));
	const maxNewX = Math.max(...mirrored.map(p => p.x));
	const retained = removePointsInRange(points, minNewX, maxNewX, selection);
	const nextPoints = sortPoints([...retained, ...mirrored]);
	const newSelection = [selected[0].id, ...mirrored.map(m => m.id)];
	return { points: nextPoints, selection: newSelection };
};

export const duplicateSelectionRight = (
	points: Point[],
	selection: Set<PointId>,
	makeId: () => PointId
): { points: Point[]; selection: PointId[] } => {
	const sorted = sortPoints(points);
	const selected = sorted.filter(p => selection.has(p.id));
	if (!selected.length) return { points, selection: Array.from(selection) };

	const minX = Math.min(...selected.map(p => p.x));
	const maxX = Math.max(...selected.map(p => p.x));

	const duplicated = selected.map(p => ({ id: makeId(), x: maxX + (p.x - minX), y: p.y }));
	const minNewX = Math.min(...duplicated.map(p => p.x));
	const maxNewX = Math.max(...duplicated.map(p => p.x));
	const retained = removePointsInRange(points, minNewX, maxNewX, selection);

	const nextPoints = sortPoints([...retained, ...duplicated]);
	const newSelection = duplicated.map(p => p.id);
	return { points: nextPoints, selection: newSelection };
};

export const duplicateSelectionLeft = (
	points: Point[],
	selection: Set<PointId>,
	makeId: () => PointId
): { points: Point[]; selection: PointId[] } => {
	const sorted = sortPoints(points);
	const selected = sorted.filter(p => selection.has(p.id));
	if (!selected.length) return { points, selection: Array.from(selection) };

	const minX = Math.min(...selected.map(p => p.x));
	const maxX = Math.max(...selected.map(p => p.x));

	const duplicated = selected.map(p => ({ id: makeId(), x: minX - (maxX - p.x), y: p.y }));
	const minNewX = Math.min(...duplicated.map(p => p.x));
	const maxNewX = Math.max(...duplicated.map(p => p.x));
	const retained = removePointsInRange(points, minNewX, maxNewX, selection);

	const nextPoints = sortPoints([...retained, ...duplicated]);
	const newSelection = duplicated.map(p => p.id);
	return { points: nextPoints, selection: newSelection };
};

type PlainPoint = { x: number; y: number };

export const replaceSelectionWithPoints = (
	points: Point[],
	selection: Set<PointId>,
	incoming: PlainPoint[],
	domainX: [number, number],
	domainY: [number, number],
	makeId: () => PointId
): { points: Point[]; selection: PointId[] } => {
	if (!incoming.length || !selection.size) {
		return { points, selection: Array.from(selection) };
	}

	const selectedPoints = points.filter(p => selection.has(p.id));
	if (!selectedPoints.length) {
		return { points, selection: Array.from(selection) };
	}

	const anchorX = Math.min(...selectedPoints.map(p => p.x));
	const minIncomingX = Math.min(...incoming.map(p => p.x));
	const shiftX = anchorX - minIncomingX;

	const newPoints: Point[] = incoming.map(p => ({
		id: makeId(),
		x: clampValue(p.x + shiftX, domainX),
		y: clampValue(p.y, domainY),
	}));

	const minNewX = Math.min(...newPoints.map(p => p.x));
	const maxNewX = Math.max(...newPoints.map(p => p.x));
	const retained = removePointsInRange(points, minNewX, maxNewX);

	const nextPoints = sortPoints([...retained, ...newPoints]);
	const newSelection = newPoints.map(p => p.id);
	return { points: nextPoints, selection: newSelection };
};
