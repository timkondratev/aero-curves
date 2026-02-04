import { SideBar } from "./SideBar";
import { useAppContext } from "../state/AppContext";

export function SideBarContainer() {
	const { activePlot, actions, state } = useAppContext();

	return (
		<SideBar
			key={activePlot ? `${activePlot.id}:${activePlot.name}:${activePlot.domainX.join(",")}:${activePlot.domainY.join(",")}:${activePlot.snapPrecisionX}:${activePlot.snapPrecisionY}:${activePlot.background.offsetX}:${activePlot.background.offsetY}:${activePlot.background.scaleX}:${activePlot.background.scaleY}` : "empty"}
			plot={activePlot}
			plots={state.plots}
			onChange={actions.replacePlot}
			onChangeTransient={actions.replacePlotTransient}
			onDuplicate={actions.duplicatePlot}
			onRemove={actions.removePlot}
		/>
	);
}
