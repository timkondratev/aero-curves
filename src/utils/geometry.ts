import type { PlotState, PointId } from "../state/reducer";
import { snapValue } from "./snapping";

type Point = PlotState["points"][number];

export const sortPoints = (pts: Point[]) => [...pts].sort((a, b) => a.x - b.x);

export const clampValue = (v: number, domain: [number, number]) => Math.min(domain[1], Math.max(domain[0], v));

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
	const selectedIds = new Set(selected.map(p => p.id));
	const selectedIndices = sorted.reduce<number[]>((acc, p, idx) => {
		if (selectedIds.has(p.id)) acc.push(idx);
		return acc;
	}, []);
	const lastIdx = selectedIndices[selectedIndices.length - 1];
	const mirrorCount = selected.length - 1; // exclude anchor at maxX

	// Mirror all but the anchor, nearest-to-anchor first for ascending order
	const mirrored = selected
		.slice(0, -1)
		.reverse()
		.map(p => ({ id: makeId(), x: maxX + (maxX - p.x), y: p.y }));

	const rightRemoveStart = lastIdx + 1;
	const rightRemoveEnd = Math.min(sorted.length, rightRemoveStart + mirrorCount);
	const leftKeep = sorted.slice(0, rightRemoveStart);
	const rightKeep = sorted.slice(rightRemoveEnd);
	const nextPoints = sortPoints([...leftKeep, ...mirrored, ...rightKeep]);
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
	const selectedIds = new Set(selected.map(p => p.id));
	const selectedIndices = sorted.reduce<number[]>((acc, p, idx) => {
		if (selectedIds.has(p.id)) acc.push(idx);
		return acc;
	}, []);
	const firstIdx = selectedIndices[0];
	const mirrorCount = selected.length - 1; // exclude anchor at minX

	// Mirror all but the anchor, farthest-from-anchor first then reverse to keep ascending order
	const mirrored = selected
		.slice(1)
		.map(p => ({ id: makeId(), x: minX - (p.x - minX), y: p.y }))
		.reverse();

	const leftRemoveEnd = Math.max(0, firstIdx - mirrorCount);
	const leftKeep = sorted.slice(0, leftRemoveEnd);
	const rightKeep = sorted.slice(firstIdx);
	const nextPoints = sortPoints([...leftKeep, ...mirrored, ...rightKeep]);
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

	const selectedIds = new Set(selected.map(p => p.id));
	const selectedIndices = sorted.reduce<number[]>((acc, p, idx) => {
		if (selectedIds.has(p.id)) acc.push(idx);
		return acc;
	}, []);
	const firstIdx = selectedIndices[0];
	const lastIdx = selectedIndices[selectedIndices.length - 1];
	const spanCount = lastIdx - firstIdx;

	const minX = Math.min(...selected.map(p => p.x));
	const maxX = Math.max(...selected.map(p => p.x));

	const duplicated = selected.map(p => ({ id: makeId(), x: maxX + (p.x - minX), y: p.y }));

	const rightRemoveStart = lastIdx + 1;
	const rightRemoveEnd = Math.min(sorted.length, lastIdx + 1 + spanCount);
	const leftKeep = sorted.slice(0, rightRemoveStart);
	const rightKeep = sorted.slice(rightRemoveEnd);

	const nextPoints = sortPoints([...leftKeep, ...duplicated, ...rightKeep]);
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

	const selectedIds = new Set(selected.map(p => p.id));
	const selectedIndices = sorted.reduce<number[]>((acc, p, idx) => {
		if (selectedIds.has(p.id)) acc.push(idx);
		return acc;
	}, []);
	const firstIdx = selectedIndices[0];
	const lastIdx = selectedIndices[selectedIndices.length - 1];
	const spanCount = lastIdx - firstIdx;

	const minX = Math.min(...selected.map(p => p.x));
	const maxX = Math.max(...selected.map(p => p.x));

	const duplicated = selected.map(p => ({ id: makeId(), x: minX - (maxX - p.x), y: p.y }));

	const leftRemoveEnd = Math.max(0, firstIdx - spanCount);
	const leftKeep = sorted.slice(0, leftRemoveEnd);
	const rightKeep = sorted.slice(firstIdx);

	const nextPoints = sortPoints([...leftKeep, ...duplicated, ...rightKeep]);
	const newSelection = duplicated.map(p => p.id);
	return { points: nextPoints, selection: newSelection };
};
