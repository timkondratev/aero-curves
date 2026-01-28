export type PlotId = string;
export type PointId = string;
export type Domain = [number, number];
export type Point = { id: PointId; x: number; y: number };

export type BackgroundImage = {
	src: string | null;
	name: string | null;
	naturalWidth: number | null;
	naturalHeight: number | null;
	opacity: number;
	fit: "contain" | "cover" | "stretch";
	offsetX: number;
	offsetY: number;
	scaleX: number;
	scaleY: number;
};

export type PlotState = {
	id: PlotId;
	name: string;
	points: Point[];
	selection: PointId[];
	brush: [number, number] | null;
	domainX: Domain;
	domainY: Domain;
	showGridX: boolean;
	showGridY: boolean;
	snapX: boolean;
	snapY: boolean;
	snapPrecisionX: number;
	snapPrecisionY: number;
	background: BackgroundImage;
};

export type AppState = {
	plots: PlotState[];
	activePlotId: PlotId | null;
};

export type Action =
	| { type: "plot/add" }
	| { type: "plot/duplicate"; id: PlotId }
	| { type: "plot/remove"; id: PlotId }
	| { type: "plot/replace"; plot: PlotState }
	| { type: "app/set-active"; id: PlotId | null }
	| { type: "app/replace-state"; state: AppState };

let idCounter = 1;
const nextId = () => `p_${idCounter++}`;

const DEFAULT_DOMAIN_X: Domain = [-180, 180];
const DEFAULT_DOMAIN_Y: Domain = [-1, 1];
const DEFAULT_SHOW_GRID_X = false;
const DEFAULT_SHOW_GRID_Y = false;
const DEFAULT_SNAP_X = false;
const DEFAULT_SNAP_Y = false;
const DEFAULT_SNAP_PRECISION_X = 1;
const DEFAULT_SNAP_PRECISION_Y = 1;
const DEFAULT_POINT_COUNT = 20;

const makeDefaultBackground = (): BackgroundImage => ({
	src: null,
	name: null,
	naturalWidth: null,
	naturalHeight: null,
	opacity: 0.6,
	fit: "contain",
	offsetX: 0,
	offsetY: 0,
	scaleX: 1,
	scaleY: 1,
});

const makeDefaultPoints = (domainX: Domain, domainY: Domain): Point[] => {
	const [minX, maxX] = domainX;
	const spanX = maxX - minX;
	const [minY, maxY] = domainY;
	const midY = (minY + maxY) / 2;
	const ampY = (maxY - minY) * 0.25; // keep a modest vertical range inside the domain

	return Array.from({ length: DEFAULT_POINT_COUNT }, (_, i) => {
		const t = i / (DEFAULT_POINT_COUNT - 1);
		return {
			id: nextId(),
			x: minX + spanX * t,
			y: midY + Math.sin(t * Math.PI * 2) * ampY,
		};
	});
};

const makePlot = (name: string): PlotState => ({
	id: nextId(),
	name,
	points: makeDefaultPoints(DEFAULT_DOMAIN_X, DEFAULT_DOMAIN_Y),
	selection: [],
	brush: null,
	domainX: DEFAULT_DOMAIN_X,
	domainY: DEFAULT_DOMAIN_Y,
	showGridX: DEFAULT_SHOW_GRID_X,
	showGridY: DEFAULT_SHOW_GRID_Y,
	snapX: DEFAULT_SNAP_X,
	snapY: DEFAULT_SNAP_Y,
	snapPrecisionX: DEFAULT_SNAP_PRECISION_X,
	snapPrecisionY: DEFAULT_SNAP_PRECISION_Y,
	background: makeDefaultBackground(),
});

export const makeInitialState = (): AppState => {
	const firstPlot = makePlot("curve_1");
	return {
		plots: [firstPlot],
		activePlotId: firstPlot.id,
	};
};

export const reducer = (state: AppState, action: Action): AppState => {
	switch (action.type) {
		case "plot/add": {
			const next = makePlot(`curve_${state.plots.length + 1}`);
			return { plots: [...state.plots, next], activePlotId: next.id };
		}
		case "plot/duplicate": {
			const source = state.plots.find(p => p.id === action.id);
			if (!source) return state;
			const cloneId = nextId();
			const clone: PlotState = {
				...source,
				id: cloneId,
				name: `${source.name}_copy`,
				selection: [],
				brush: null,
				points: source.points.map(pt => ({ ...pt, id: nextId() })),
			};
			return { plots: [...state.plots, clone], activePlotId: cloneId };
		}
		case "plot/remove": {
			const remaining = state.plots.filter(p => p.id !== action.id);
			const activePlotId = state.activePlotId === action.id ? remaining[0]?.id ?? null : state.activePlotId;
			return { plots: remaining, activePlotId };
		}
		case "plot/replace": {
			return {
				...state,
				plots: state.plots.map(p => (p.id === action.plot.id ? action.plot : p)),
			};
		}
		case "app/set-active": {
			return { ...state, activePlotId: action.id };
		}
		case "app/replace-state": {
			return action.state;
		}
		default:
			return state;
	}
};
