export type SplinePoint = { x: number; y: number };

type MonotoneState = { _x0: number; _x1: number; _y0: number; _y1: number };

const sign = (x: number) => (x < 0 ? -1 : 1);

// Calculate the slopes of the tangents (Steffen monotone interpolation)
const slope3 = (state: MonotoneState, x2: number, y2: number) => {
	const h0 = state._x1 - state._x0;
	const h1 = x2 - state._x1;
	const s0 = (state._y1 - state._y0) / (h0 || (h1 < 0 ? -0 : 0));
	const s1 = (y2 - state._y1) / (h1 || (h0 < 0 ? -0 : 0));
	const p = (s0 * h1 + s1 * h0) / (h0 + h1);
	return (sign(s0) + sign(s1)) * Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(p)) || 0;
};

// Calculate a one-sided slope.
const slope2 = (state: MonotoneState, t: number) => {
	const h = state._x1 - state._x0;
	return h ? (3 * (state._y1 - state._y0) / h - t) / 2 : t;
};

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

class MonotoneX implements MonotoneState {
	private _context: PathStringContext;
	_x0 = NaN;
	_x1 = NaN;
	_y0 = NaN;
	_y1 = NaN;
	_t0 = NaN;
	_point = 0;
	_line = 0;

	constructor(context: PathStringContext) {
		this._context = context;
	}

	lineStart() {
		this._x0 = this._x1 = this._y0 = this._y1 = this._t0 = NaN;
		this._point = 0;
	}

	lineEnd() {
		switch (this._point) {
			case 2:
				this._context.lineTo(this._x1, this._y1);
				break;
			case 3:
				this.pointHelper(this._t0, slope2(this, this._t0));
				break;
			default:
				break;
		}
		if (this._line || (this._line !== 0 && this._point === 1)) this._context.closePath();
		this._line = 1 - this._line;
	}

	point(x: number, y: number) {
		let t1 = NaN;
		x = +x;
		y = +y;
		if (x === this._x1 && y === this._y1) return; // Ignore coincident points.
		switch (this._point) {
			case 0:
				this._point = 1;
				this._line ? this._context.lineTo(x, y) : this._context.moveTo(x, y);
				break;
			case 1:
				this._point = 2;
				break;
			case 2:
				this._point = 3;
				this.pointHelper(slope2(this, (t1 = slope3(this, x, y))), t1);
				break;
			default:
				this.pointHelper(this._t0, (t1 = slope3(this, x, y)));
				break;
		}

		this._x0 = this._x1;
		this._x1 = x;
		this._y0 = this._y1;
		this._y1 = y;
		this._t0 = t1;
	}

	private pointHelper(t0: number, t1: number) {
		const x0 = this._x0;
		const y0 = this._y0;
		const x1 = this._x1;
		const y1 = this._y1;
		const dx = (x1 - x0) / 3;
		this._context.bezierCurveTo(x0 + dx, y0 + dx * t0, x1 - dx, y1 - dx * t1, x1, y1);
	}
}

export const buildMonotonePath = (
	pts: SplinePoint[],
	xScale: (x: number) => number,
	yScale: (y: number) => number
) => {
	// Compute all slopes in data space for reproducibility, then transform to screen.
	if (pts.length === 0) return "";
	if (pts.length === 1) {
		const p = pts[0];
		return `M${xScale(p.x)},${yScale(p.y)}`;
	}

	// Precompute linear scale derivatives to convert data slopes to screen slopes.
	const kx = xScale(1) - xScale(0);
	const ky = yScale(1) - yScale(0);
	const slopeToScreen = (t: number) => t * (ky / kx);

	const ctx = new PathStringContext();
	const curve = new MonotoneX(ctx);
	curve.lineStart();

	// Feed points in data order but store data-space, then convert per Bézier segment to screen.
	let prev: SplinePoint | null = null;
	let prevPrev: SplinePoint | null = null;
	let tPrev = NaN;

	const emitFirst = (p: SplinePoint) => {
		curve._x0 = curve._x1 = p.x;
		curve._y0 = curve._y1 = p.y;
		curve._t0 = NaN;
		curve._point = 1;
		curve._line ? ctx.lineTo(xScale(p.x), yScale(p.y)) : ctx.moveTo(xScale(p.x), yScale(p.y));
	};

	const emitSecond = (p: SplinePoint) => {
		curve._point = 2;
		curve._x1 = p.x;
		curve._y1 = p.y;
	};

	const emitNext = (p: SplinePoint) => {
		const t1 = slope3(curve, p.x, p.y);
		const screenT0 = slopeToScreen(tPrev);
		const screenT1 = slopeToScreen(t1);
		const x0s = xScale(curve._x0);
		const y0s = yScale(curve._y0);
		const x1s = xScale(curve._x1);
		const y1s = yScale(curve._y1);
		const dxs = (x1s - x0s) / 3;
		ctx.bezierCurveTo(x0s + dxs, y0s + dxs * screenT0, x1s - dxs, y1s - dxs * screenT1, x1s, y1s);
		curve._t0 = t1;
		curve._x0 = curve._x1;
		curve._y0 = curve._y1;
		curve._x1 = p.x;
		curve._y1 = p.y;
		tPrev = t1;
	};

	for (const p of pts) {
		if (!prev) {
			emitFirst(p);
			prev = p;
			continue;
		}
		if (!prevPrev) {
			emitSecond(p);
			curve._x0 = prev.x;
			curve._y0 = prev.y;
			curve._t0 = NaN;
			prevPrev = prev;
			prev = p;
			continue;
		}
		// Compute tPrev when we have three points (first segment tangent).
		if (Number.isNaN(tPrev)) {
			tPrev = slope2(curve, slope3(curve, p.x, p.y));
			curve._t0 = tPrev;
		}
		emitNext(p);
		prevPrev = prev;
		prev = p;
	}

	// Handle lineEnd cases
	switch (curve._point) {
		case 2: {
			const x1s = xScale(curve._x1);
			const y1s = yScale(curve._y1);
			ctx.lineTo(x1s, y1s);
			break;
		}
		case 3: {
			const t1 = slope2(curve, curve._t0);
			const screenT0 = slopeToScreen(curve._t0);
			const screenT1 = slopeToScreen(t1);
			const x0s = xScale(curve._x0);
			const y0s = yScale(curve._y0);
			const x1s = xScale(curve._x1);
			const y1s = yScale(curve._y1);
			const dxs = (x1s - x0s) / 3;
			ctx.bezierCurveTo(x0s + dxs, y0s + dxs * screenT0, x1s - dxs, y1s - dxs * screenT1, x1s, y1s);
			break;
		}
		default:
			break;
	}

	return ctx.toString();
};
