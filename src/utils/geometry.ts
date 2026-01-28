import type { PlotState, PointId } from "../state/reducer";
import { snapValue } from "./snapping";

type Point = PlotState["points"][number];

export const clampValue = (v: number, domain: [number, number]) => Math.min(domain[1], Math.max(domain[0], v));

const filterRightOutsideSpan = (points: Point[], spanEnd: number) => points.filter(p => p.x > spanEnd);
const filterLeftOutsideSpan = (points: Point[], spanStart: number) => points.filter(p => p.x < spanStart);

const findSelectionBounds = (points: Point[], selection: Set<PointId>) => {
	let first = -1;
	let last = -1;
	for (let i = 0; i < points.length; i++) {
		if (!selection.has(points[i].id)) continue;
		if (first === -1) first = i;
		last = i;
	}
	return { first, last };
};

const insertPointByX = (points: Point[], point: Point): Point[] => {
	const idx = points.findIndex(p => p.x > point.x);
	if (idx === -1) return [...points, point];
	return [...points.slice(0, idx), point, ...points.slice(idx)];
};

export const flipSelectionY = (
	points: Point[],
	selection: Set<PointId>,
	domainY: [number, number],
	snapEnabled: boolean,
	snapPrecision: number
): Point[] => {
	return points.map(p => {
		if (!selection.has(p.id)) return p;
		const y = snapValue(clampValue(-p.y, domainY), snapEnabled, snapPrecision);
		return { ...p, y };
	});
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
	return points.map(p => {
		if (!selection.has(p.id)) return p;
		const mirrored = maxX - (p.x - minX);
		const x = snapValue(clampValue(mirrored, domainX), snapEnabled, snapPrecision);
		return { ...p, x };
	});
};

export const trimToSelection = (points: Point[], selection: Set<PointId>): Point[] => {
	const selected = points.filter(p => selection.has(p.id));
	if (selected.length < 2) return points;
	const minX = Math.min(...selected.map(p => p.x));
	const maxX = Math.max(...selected.map(p => p.x));
	return points.filter(p => p.x >= minX && p.x <= maxX);
};

export const addPoint = (points: Point[], point: Point): Point[] => {
	return insertPointByX(points, point);
};

export const removePoint = (points: Point[], id: PointId): Point[] => {
	// Guard against removing when id is absent
	const next = points.filter(p => p.id !== id);
	return next.length === points.length ? points : next;
};

type MirrorDirection = "left" | "right";

export const mirrorSelection = (
	points: Point[],
	selection: Set<PointId>,
	makeId: () => PointId,
	direction: MirrorDirection
): { points: Point[]; selection: PointId[] } => {
	const { first, last } = findSelectionBounds(points, selection);
	if (first === -1 || last - first + 1 < 2) return { points, selection: Array.from(selection) };

	const anchorIdx = direction === "right" ? last : first;
	const anchor = points[anchorIdx];
	const width = points[last].x - points[first].x;

	const mirrored: Point[] = [];
	const start = direction === "right" ? last - 1 : last;
	const shouldContinue = direction === "right" ? (i: number) => i >= first : (i: number) => i > first;
	for (let i = start; shouldContinue(i); i--) {
		const src = points[i];
		mirrored.push({ id: makeId(), x: anchor.x + (anchor.x - src.x), y: src.y });
	}

	if (direction === "right") {
		const insertAt = last + 1;
		const spanEnd = anchor.x + width;
		const rightTail = filterRightOutsideSpan(points.slice(insertAt), spanEnd);
		const nextPoints = [...points.slice(0, insertAt), ...mirrored, ...rightTail];
		return { points: nextPoints, selection: [anchor.id, ...mirrored.map(m => m.id)] };
	}

	const spanStart = anchor.x - width;
	const leftHead = filterLeftOutsideSpan(points.slice(0, first), spanStart);
	const nextPoints = [...leftHead, ...mirrored, ...points.slice(first)];
	return { points: nextPoints, selection: [anchor.id, ...mirrored.map(m => m.id)] };
};

export const duplicateSelectionRight = (
	points: Point[],
	selection: Set<PointId>,
	makeId: () => PointId
): { points: Point[]; selection: PointId[] } => {
	const { first, last } = findSelectionBounds(points, selection);
	if (first === -1) return { points, selection: Array.from(selection) };

	const minX = points[first].x;
	const maxX = points[last].x;
	const anchor = points[last];
	const shift = maxX - minX;
	const duplicated = points.slice(first, last + 1).map(p => ({ id: makeId(), x: p.x + shift, y: p.y }));
	const filtered = duplicated.filter(p => !(p.x === anchor.x && p.y === anchor.y));
	const insertAt = last + 1;
	const spanEnd = maxX + shift;
	const rightTail = filterRightOutsideSpan(points.slice(insertAt), spanEnd);
	const nextPoints = [...points.slice(0, insertAt), ...filtered, ...rightTail];
	const newSelection = filtered.map(p => p.id);
	return { points: nextPoints, selection: newSelection };
};

export const duplicateSelectionLeft = (
	points: Point[],
	selection: Set<PointId>,
	makeId: () => PointId
): { points: Point[]; selection: PointId[] } => {
	const { first, last } = findSelectionBounds(points, selection);
	if (first === -1) return { points, selection: Array.from(selection) };

	const minX = points[first].x;
	const maxX = points[last].x;
	const anchor = points[first];
	const shift = maxX - minX;
	const duplicated = points.slice(first, last + 1).map(p => ({ id: makeId(), x: p.x - shift, y: p.y }));
	const filtered = duplicated.filter(p => !(p.x === anchor.x && p.y === anchor.y));
	const spanStart = minX - shift;
	const leftHead = filterLeftOutsideSpan(points.slice(0, first), spanStart);
	const nextPoints = [...leftHead, ...filtered, ...points.slice(first)];
	const newSelection = filtered.map(p => p.id);
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

	const { first } = findSelectionBounds(points, selection);
	if (first === -1) {
		return { points, selection: Array.from(selection) };
	}

	const anchorX = points[first].x;
	const minIncomingX = Math.min(...incoming.map(p => p.x));
	const maxIncomingX = Math.max(...incoming.map(p => p.x));
	const shiftX = anchorX - minIncomingX;
	const spanStart = anchorX;
	const spanEnd = anchorX + (maxIncomingX - minIncomingX);

	const newPoints: Point[] = incoming.map(p => ({
		id: makeId(),
		x: clampValue(p.x + shiftX, domainX),
		y: clampValue(p.y, domainY),
	}));
	const left = points.filter(p => p.x < spanStart);
	const right = points.filter(p => p.x > spanEnd);
	const nextPoints = [...left, ...newPoints, ...right];
	const newSelection = newPoints.map(p => p.id);
	return { points: nextPoints, selection: newSelection };
};










// const _getBoundsX = (points: Point[]): [number, number] => {
//     const xs = points.map(p => p.x);
//     return [Math.min(...xs), Math.max(...xs)];
//  }

//  const _paste = (points, newPoints, keepLeft, keepRight) => {
//     // - call getBoundsX and split points into points_left, points_overlap, points_right so that:
//     //      if keepLeft is true, points_left <= minX, else points_left < minX
//     //      if keepRight is true, points_right >= maxX, else points_right > maxX
//     // Construct and return a new array from points_left, newPoints, points_right


//  };

// const _flipX = (points) => {
//     // Return new array of the same points in reverse order

// }

// const _flipY = (points) => {
//     // Return new array with mutated points where each Y is -Y
// }

// const _mirror = (direction, points, selection) => {
//     // Create new array of points from selection, _flipX them
//     // and send it to _paste with determined arguments
// }

// const _duplicate = (direction, points, selection) => {
//     // Create new array of points from selection
//     // Shift selection by width (+ or -)
//     // Call _paste with determined arguments
// }
