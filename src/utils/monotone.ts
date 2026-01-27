export type SplinePoint = { x: number; y: number };

class PathStringContext {
	private parts: string[] = [];

	moveTo(x: number, y: number) {
		this.parts.push(`M${x},${y}`);
	}

	lineTo(x: number, y: number) {
		this.parts.push(`L${x},${y}`);
	}

	bezierCurveTo(x1: number, y1: number, x2: number, y2: number, x: number, y: number) {
		this.parts.push(`C${x1},${y1} ${x2},${y2} ${x},${y}`);
	}

	closePath() {
		this.parts.push("Z");
	}

	toString() {
		return this.parts.join("");
	}
}

const computeTangents = (pts: SplinePoint[]) => {
	const n = pts.length;
	const m: number[] = new Array(n - 1);
	for (let i = 0; i < n - 1; i++) {
		const dx = pts[i + 1].x - pts[i].x;
		const dy = pts[i + 1].y - pts[i].y;
		m[i] = dx !== 0 ? dy / dx : 0;
	}
	const t: number[] = new Array(n);
	// Endpoints use adjacent segment slope
	t[0] = m[0] ?? 0;
	t[n - 1] = m[n - 2] ?? 0;
	for (let i = 1; i < n - 1; i++) {
		const s0 = m[i - 1];
		const s1 = m[i];
		if (s0 === 0 || s1 === 0 || Math.sign(s0) !== Math.sign(s1)) {
			t[i] = 0;
			continue;
		}
		const h0 = pts[i].x - pts[i - 1].x;
		const h1 = pts[i + 1].x - pts[i].x;
		const p = (s0 * h1 + s1 * h0) / (h0 + h1);
		const minMag = Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(p));
		t[i] = (Math.sign(s0) + Math.sign(s1)) * minMag;
	}
	return t;
};

const hermite = (t: number, h: number, y0: number, y1: number, m0: number, m1: number) => {
	const t2 = t * t;
	const t3 = t2 * t;
	const h00 = 2 * t3 - 3 * t2 + 1;
	const h10 = t3 - 2 * t2 + t;
	const h01 = -2 * t3 + 3 * t2;
	const h11 = t3 - t2;
	return h00 * y0 + h10 * h * m0 + h01 * y1 + h11 * h * m1;
};

const buildPathFromTangents = (
	pts: SplinePoint[],
	tangents: number[],
	xScale: (x: number) => number,
	yScale: (y: number) => number
) => {
	const ctx = new PathStringContext();
	const kx = xScale(1) - xScale(0);
	const ky = yScale(1) - yScale(0);
	const slopeToScreen = (t: number) => t * (ky / kx);

	const p0 = pts[0];
	ctx.moveTo(xScale(p0.x), yScale(p0.y));
	for (let i = 0; i < pts.length - 1; i++) {
		const pa = pts[i];
		const pb = pts[i + 1];
		const m0 = slopeToScreen(tangents[i]);
		const m1 = slopeToScreen(tangents[i + 1]);
		const x0s = xScale(pa.x);
		const y0s = yScale(pa.y);
		const x1s = xScale(pb.x);
		const y1s = yScale(pb.y);
		const dxs = (x1s - x0s) / 3;
		ctx.bezierCurveTo(x0s + dxs, y0s + dxs * m0, x1s - dxs, y1s - dxs * m1, x1s, y1s);
	}
	return ctx.toString();
};

export const buildMonotoneSpline = (
	pts: SplinePoint[],
	xScale: (x: number) => number,
	yScale: (y: number) => number
) => {
	if (pts.length === 0) return { pathD: "", evaluate: (_x: number) => NaN };
	if (pts.length === 1) {
		const p = pts[0];
		return {
			pathD: `M${xScale(p.x)},${yScale(p.y)}`,
			evaluate: (_x: number) => p.y,
		};
	}
	const tangents = computeTangents(pts);
	const pathD = buildPathFromTangents(pts, tangents, xScale, yScale);

	const evaluate = (x: number) => {
		const n = pts.length;
		if (x <= pts[0].x) return pts[0].y;
		if (x >= pts[n - 1].x) return pts[n - 1].y;
		let lo = 0;
		let hi = n - 1;
		while (hi - lo > 1) {
			const mid = (lo + hi) >> 1;
			if (x < pts[mid].x) hi = mid; else lo = mid;
		}
		const x0 = pts[lo].x;
		const x1 = pts[hi].x;
		const y0 = pts[lo].y;
		const y1 = pts[hi].y;
		const h = x1 - x0;
		if (h === 0) return y0;
		const u = (x - x0) / h;
		return hermite(u, h, y0, y1, tangents[lo], tangents[hi]);
	};

	return { pathD, evaluate };
};

export const buildMonotonePath = (
	pts: SplinePoint[],
	xScale: (x: number) => number,
	yScale: (y: number) => number
) => buildMonotoneSpline(pts, xScale, yScale).pathD;
