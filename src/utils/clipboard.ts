import type { Point } from "../state/reducer";

export type ClipboardPoint = Pick<Point, "x" | "y">;

const PAYLOAD_TYPE = "aero-curves/points";
const PAYLOAD_VERSION = 1;

type Payload = {
	type: string;
	version: number;
	points: ClipboardPoint[];
};

export const serializePointsForClipboard = (points: ClipboardPoint[]): string => {
	const payload: Payload = {
		type: PAYLOAD_TYPE,
		version: PAYLOAD_VERSION,
		points,
	};
	return JSON.stringify(payload);
};

export const parsePointsFromClipboard = (text: string): ClipboardPoint[] | null => {
	try {
		const data: unknown = JSON.parse(text);
		if (!data || typeof data !== "object") return null;
		const payload = data as Partial<Payload>;
		if (payload.type !== PAYLOAD_TYPE || payload.version !== PAYLOAD_VERSION || !Array.isArray(payload.points)) {
			return null;
		}
		const points: ClipboardPoint[] = [];
		for (const p of payload.points) {
			if (!p || typeof p !== "object") continue;
			const x = (p as { x?: unknown }).x;
			const y = (p as { y?: unknown }).y;
			if (typeof x !== "number" || typeof y !== "number" || Number.isNaN(x) || Number.isNaN(y)) continue;
			points.push({ x, y });
		}
		return points.length ? points : null;
	} catch {
		return null;
	}
};
