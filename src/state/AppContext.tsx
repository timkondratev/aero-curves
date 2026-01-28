import { createContext, useContext } from "react";
import type { AppState, PlotId, PlotState } from "./reducer";

type AppActions = {
	setActive: (id: PlotId | null) => void;
	replacePlot: (plot: PlotState) => void;
	replacePlotTransient: (plot: PlotState) => void;
	duplicatePlot: (id: PlotId) => void;
	removePlot: (id: PlotId) => void;
};

export type AppContextValue = {
	state: AppState;
	activePlot: PlotState | null;
	actions: AppActions;
};

export const AppContext = createContext<AppContextValue | null>(null);

export function useAppContext() {
	const ctx = useContext(AppContext);
	if (!ctx) throw new Error("useAppContext must be used within AppProvider");
	return ctx;
}
