import type { PlotState } from "../state/reducer";
import { Plot } from "./Plot";
import { useAppContext } from "../state/AppContext";

type Props = {
	plot: PlotState;
};

export function PlotContainer({ plot }: Props) {
	const { state, actions } = useAppContext();
	const active = plot.id === state.activePlotId;

	return (
		<Plot
			plot={plot}
			active={active}
			onActivate={() => actions.setActive(plot.id)}
			onChange={actions.replacePlot}
			onChangeTransient={actions.replacePlotTransient}
		/>
	);
}
