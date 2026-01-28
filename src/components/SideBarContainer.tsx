import { SideBar } from "./SideBar";
import { useAppContext } from "../state/AppContext";

export function SideBarContainer() {
	const { activePlot, actions } = useAppContext();

	return (
		<SideBar
			plot={activePlot}
			onChange={actions.replacePlot}
			onChangeTransient={actions.replacePlotTransient}
			onDuplicate={actions.duplicatePlot}
			onRemove={actions.removePlot}
		/>
	);
}
