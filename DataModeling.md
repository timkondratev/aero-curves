// My thoughts about the app design

TYPES
Point: [Number, Number] #[x, y]
Domain: [Number, Number] #[min, max]
Brush: [Number, Number] #[from, to]


STATE

APP
	- activePlot: Number

Plot
	- name: str
	- points: Point[]
	- selection: Index[]
	- brush: Brush
	- domainX: Domain
	- domainY: Domain
	- snapX: bool
	- snapY: bool
	- snapPrecisionX: Number
	- snapPrecisionY: Number

SideBar
    - nameInput #candidate for name value



COMPONENTS

App
	ToolBar
		ToolButton
	SideBar
        PlotName
        SelectionX
        SelectionY
        SnapX
        SnapY
        SnapPrecisionX
        SnapPrecisionY
        MinX
        MaxX
        MinY
        MaxY
	PlotArea
		Plot
        AddPlotButton


