import { useEffect, useMemo, useRef, useState, useLayoutEffect } from "react";
import { Plot } from "./Plot";
import type { PlotHandle } from "./Plot";

type ViewDims = { width: number; height: number };
const GRID_GAP = 12;

const getDims = (): ViewDims => {
  const clientWidth = document.documentElement.clientWidth || window.innerWidth;
  const clientHeight = document.documentElement.clientHeight || window.innerHeight;
  return {
    width: clientWidth,
    height: Math.max(520, Math.floor(clientHeight * 0.95)),
  };
};

function App() {
  const [dims, setDims] = useState<ViewDims>(getDims());
  const [plots, setPlots] = useState<string[]>(["plot-1"]);
  const [activePlot, setActivePlot] = useState<string>("plot-1");
  const [sideWidth, setSideWidth] = useState(300);
  const [names, setNames] = useState<Record<string, string>>({ "plot-1": "curve_1" });

  const plotRefs = useRef(new Map<string, PlotHandle>());
  const nextId = useRef(2);

  const sidePanelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleResize = () => setDims(getDims());
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useLayoutEffect(() => {
    const node = sidePanelRef.current;
    if (!node) return;

    const updateWidth = () => setSideWidth(node.getBoundingClientRect().width);
    updateWidth();

    const observer = new ResizeObserver(() => updateWidth());
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const plotHeight = useMemo(() => Math.max(300, Math.floor(dims.height / 2)), [dims.height]);
  const plotWidth = useMemo(() => Math.max(320, dims.width - sideWidth - GRID_GAP - 24), [dims.width, sideWidth]);

  const getActiveHandle = () => plotRefs.current.get(activePlot) ?? null;

  const call = (fn: (h: PlotHandle) => void) => {
    const handle = getActiveHandle();
    if (handle) fn(handle);
  };

  const ensureUniqueName = (base: string, current: Record<string, string>, selfId?: string) => {
    const used = new Set(
      Object.entries(current)
        .filter(([id]) => id !== selfId)
        .map(([, name]) => name)
    );
    let candidate = base;
    while (used.has(candidate)) {
      candidate += "_";
    }
    return candidate;
  };

  const addPlot = () => {
    const id = `plot-${nextId.current++}`;
    setPlots(prev => [...prev, id]);
    const base = `curve_${plots.length + 1}`;
    const unique = ensureUniqueName(base, names);
    setNames(prev => ({ ...prev, [id]: unique }));
    setActivePlot(id);
  };

  const removePlot = (id: string) => {
    setPlots(prev => {
      if (prev.length <= 1) return prev; // keep at least one plot
      const next = prev.filter(p => p !== id);
      if (activePlot === id && next.length > 0) {
        setActivePlot(next[0]);
      }
      return next;
    });
    setNames(prev => {
      const { [id]: _, ...rest } = prev;
      return rest;
    });
  };

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "100vw",
        height: "100vh",
        maxHeight: "100vh",
        overflow: "hidden",
        padding: 12,
        boxSizing: "border-box",
        display: "flex",
        alignItems: "flex-start",
        gap: GRID_GAP,
      }}
    >
      <div
        style={{
          flex: "1 1 0",
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          gap: GRID_GAP,
          height: "100%",
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        {/* Shared top control bar */}
        <div
          style={{
            width: "100%",
            display: "flex",
            flexWrap: "wrap",
            gap: "10px",
            padding: "10px",
            backgroundColor: "#fff",
            border: "1px solid #ccc",
            borderRadius: 6,
            boxSizing: "border-box",
            position: "sticky",
            top: 0,
            zIndex: 2,
          }}
        >
          <button onClick={() => call(h => h.flipVertical())}>Flip Vertical</button>
          <button onClick={() => call(h => h.flipHorizontal())}>Flip Horizontal</button>
          <button onClick={() => call(h => h.trim())}>Trim</button>
          <button onClick={() => call(h => h.trimLeft())}>Trim Left</button>
          <button onClick={() => call(h => h.trimRight())}>Trim Right</button>
          <button onClick={() => call(h => h.mirrorLeft())}>Mirror Left</button>
          <button onClick={() => call(h => h.mirrorRight())}>Mirror Right</button>
          <button onClick={() => call(h => h.duplicateLeft())}>Duplicate Left</button>
          <button onClick={() => call(h => h.duplicateRight())}>Duplicate Right</button>
        </div>

        {/* Stacked plots (scrollable) */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflow: "auto",
            display: "flex",
            flexDirection: "column",
            gap: GRID_GAP,
            width: "100%",
          }}
        >
          {plots.map(id => (
            <Plot
              key={id}
              ref={node => {
                if (node) plotRefs.current.set(id, node);
                else plotRefs.current.delete(id);
              }}
              width={plotWidth}
              height={plotHeight}
              active={activePlot === id}
              onActivate={() => setActivePlot(id)}
              defaultName={names[id] ?? `curve_${id}`}
              onNameChange={name => {
                const unique = ensureUniqueName(name, names, id);
                setNames(prev => ({ ...prev, [id]: unique }));
                return unique;
              }}
              showTopPanel={false}
              showSidePanel
              renderSidePanelInline={false}
              sidePanelContainer={sidePanelRef.current}
              onRemove={plots.length > 1 ? () => removePlot(id) : undefined}
            />
          ))}
          <button
            onClick={addPlot}
            style={{
              padding: "10px 12px",
              width: "fit-content",
              borderRadius: 6,
              border: "1px solid #ccc",
              background: "#f7f7f7",
              cursor: "pointer",
            }}
          >
            + Add plot
          </button>
        </div>
      </div>

      <div
        ref={sidePanelRef}
        style={{
          flex: "0 0 auto",
          width: "max-content",
          maxWidth: 400,
          minWidth: 260,
          height: "calc(100vh - 24px)",
          maxHeight: "calc(100vh - 24px)",
          padding: "12px",
          backgroundColor: "#fff",
          border: "1px solid #ccc",
          borderRadius: 6,
          boxSizing: "border-box",
          overflow: "auto",
          position: "sticky",
          top: 12,
        }}
      >
        {!getActiveHandle() && <div style={{ color: "#666" }}>Select a plot to edit.</div>}
      </div>
    </div>
  );
}

export default App;
