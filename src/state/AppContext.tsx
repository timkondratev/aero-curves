import type { ReactNode } from "react";
import { createContext, useContext } from "react";
import type { AppState, PlotId, PlotState } from "./reducer";

type AppActions = {
	setActive: (id: PlotId | null) => void;
	replacePlot: (plot: PlotState) => void;
	replacePlotTransient: (plot: PlotState) => void;
	duplicatePlot: (id: PlotId) => void;
	removePlot: (id: PlotId) => void;
};

type AppContextValue = {
	state: AppState;
	activePlot: PlotState | null;
	actions: AppActions;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ value, children }: { value: AppContextValue; children: ReactNode }) {
	return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
	const ctx = useContext(AppContext);
	if (!ctx) throw new Error("useAppContext must be used within AppProvider");
	return ctx;
}
