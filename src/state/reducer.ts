export type PlotId = string;
export type PointId = string;
export type Domain = [number, number];
export type Point = { id: PointId; x: number; y: number };

export type PlotState = {
	id: PlotId;
	name: string;
	points: Point[];
	selection: PointId[];
	brush: [number, number] | null;
	domainX: Domain;
	domainY: Domain;
	snapX: boolean;
	snapY: boolean;
	snapPrecisionX: number;
	snapPrecisionY: number;
};

export type AppState = {
	plots: PlotState[];
	activePlotId: PlotId | null;
};

export type Action =
	| { type: "plot/add" }
	| { type: "plot/remove"; id: PlotId }
	| { type: "plot/replace"; plot: PlotState }
	| { type: "app/set-active"; id: PlotId | null };

let idCounter = 1;
const nextId = () => `p_${idCounter++}`;

const makeDefaultPoints = (): Point[] => {
	return Array.from({ length: 12 }, (_, i) => {
		const t = i / 11;
		return { id: nextId(), x: -180 + 360 * t, y: Math.sin(t * Math.PI * 2) * 0.5 };
	});
};

const makePlot = (name: string): PlotState => ({
	id: nextId(),
	name,
	points: makeDefaultPoints(),
	selection: [],
	brush: null,
	domainX: [-180, 180],
	domainY: [-1, 1],
	snapX: false,
	snapY: false,
	snapPrecisionX: 1,
	snapPrecisionY: 1,
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
		default:
			return state;
	}
};
