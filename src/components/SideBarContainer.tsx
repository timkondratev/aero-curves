import { SideBar } from "./SideBar";
import { useAppContext } from "../state/AppContext";

export function SideBarContainer() {
	const { activePlot, actions } = useAppContext();

	return (
		<SideBar
			key={activePlot ? `${activePlot.id}:${activePlot.name}:${activePlot.domainX.join(",")}:${activePlot.domainY.join(",")}:${activePlot.snapPrecisionX}:${activePlot.snapPrecisionY}:${activePlot.background.offsetX}:${activePlot.background.offsetY}:${activePlot.background.scaleX}:${activePlot.background.scaleY}` : "empty"}
			plot={activePlot}
			onChange={actions.replacePlot}
			onChangeTransient={actions.replacePlotTransient}
			onDuplicate={actions.duplicatePlot}
			onRemove={actions.removePlot}
		/>
	);
}
