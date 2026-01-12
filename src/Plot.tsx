import { scaleLinear, line, curveMonotoneX } from "d3";
import { forwardRef, useMemo, useState, useRef, useEffect, useLayoutEffect, useImperativeHandle } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

// Constants
const MARGIN = { top: 20, right: 20, bottom: 40, left: 50 };
const GRID_GAP = 12;
const X_DOMAIN: [number, number] = [-180, 180];
const Y_DOMAIN: [number, number] = [-1, 1];
const MIN_POINTS = 2;

// Types
export type PlotHandle = {
  flipVertical: () => void;
  flipHorizontal: () => void;
  trim: () => void;
  trimLeft: () => void;
  trimRight: () => void;
  mirrorLeft: () => void;
  mirrorRight: () => void;
  duplicateLeft: () => void;
  duplicateRight: () => void;
  renderSidePanel: () => ReactNode;
};

type PlotProps = {
  width: number;
  height: number;
  active: boolean;
  onActivate: () => void;
  showTopPanel?: boolean;
  showSidePanel?: boolean;
  renderSidePanelInline?: boolean;
  sidePanelContainer?: HTMLElement | null;
};
type Point = { x: number; y: number };

export const Plot = forwardRef<PlotHandle, PlotProps>(function Plot(
  {
    width,
    height,
    active,
    onActivate,
    showTopPanel = true,
    showSidePanel = true,
    renderSidePanelInline = true,
    sidePanelContainer,
  }: PlotProps,
  ref
) {
  // Dimensions (plot flexes; side panel sizes to content with a clamp)
  const sidePanelRef = useRef<HTMLDivElement | null>(null);
  const [sidePanelWidth, setSidePanelWidth] = useState(0);

  useLayoutEffect(() => {
    if (!active || !showSidePanel) {
      setSidePanelWidth(0);
      return;
    }

    const node = sidePanelRef.current;
    if (!node) return;

    const updateWidth = () => {
      setSidePanelWidth(node.getBoundingClientRect().width);
    };

    updateWidth();

    const observer = new ResizeObserver(() => updateWidth());
    observer.observe(node);

    return () => observer.disconnect();
  }, [active, showSidePanel]);

  const sidePanelMaxWidth = Math.min(400, Math.max(260, width * 0.35));
  const safeWidth = Math.max(240, Math.min(width, window.innerWidth || width));
  const sidePanelCountsForWidth = renderSidePanelInline && showSidePanel && active;
  const effectiveSideWidth = sidePanelCountsForWidth ? sidePanelWidth : 0;
  const plotWidth = Math.max(200, safeWidth - effectiveSideWidth - GRID_GAP);
  const innerWidth = plotWidth - MARGIN.left - MARGIN.right;
  const innerHeight = height - MARGIN.top - MARGIN.bottom;

  // State
  const [points, setPoints] = useState<Point[]>(() =>
    Array.from({ length: 16 }, (_, i) => {
      const x = X_DOMAIN[0] + ((X_DOMAIN[1] - X_DOMAIN[0]) * i) / 15;
      return { x, y: Math.sin((x * Math.PI) / 180) * 0.8 };
    })
  );
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [brush, setBrush] = useState<{ x0: number; x1: number } | null>(null);

  // Refs
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const dragPointsStart = useRef<Point[]>([]);
  const isDraggingPoints = useRef(false);
  const wasDragging = useRef(false);
  const animationFrameRef = useRef<number | null>(null);
  const wasPointClicked = useRef(false); // Track if a point was clicked

  // State for axes domain control
  const [xDomain, setXDomain] = useState<[number, number]>(X_DOMAIN);
  const [yDomain, setYDomain] = useState<[number, number]>(Y_DOMAIN);

  // Scales
  const xScale = useMemo(() => scaleLinear().domain(xDomain).range([0, innerWidth]), [innerWidth, xDomain]);
  const yScale = useMemo(() => scaleLinear().domain(yDomain).range([innerHeight, 0]), [innerHeight, yDomain]);

  // Ticks
  const xTicks = useMemo(() => {
    const [min, max] = xDomain;
    const base = scaleLinear().domain([min, max]).ticks(10); // Generate 10 "nice" ticks
    const withEnds = Array.from(new Set([...base, min, max]));
    return withEnds.sort((a, b) => a - b);
  }, [xDomain]);

  const yTicks = useMemo(() => {
    const [min, max] = yDomain;
    const base = scaleLinear().domain([min, max]).ticks(10); // Generate 10 "nice" ticks
    const withEnds = Array.from(new Set([...base, min, max]));
    return withEnds.sort((a, b) => a - b);
  }, [yDomain]);

  // Derived Data
  const sortedPoints = useMemo(() => [...points].sort((a, b) => a.x - b.x), [points]);
  const pathD = useMemo(() => {
    return (
      line<Point>()
        .x(d => xScale(d.x))
        .y(d => yScale(d.y))
        .curve(curveMonotoneX)(sortedPoints) ?? ""
    );
  }, [sortedPoints, xScale, yScale]);

  // Calculate mean coordinates of selected points
  const meanCoordinates = useMemo(() => {
    if (selectedIndices.size === 0) return null;

    const selectedPoints = Array.from(selectedIndices).map(i => points[i]);
    const meanX = selectedPoints.reduce((sum, p) => sum + p.x, 0) / selectedPoints.length;
    const meanY = selectedPoints.reduce((sum, p) => sum + p.y, 0) / selectedPoints.length;

    return { x: meanX, y: meanY };
  }, [selectedIndices, points]);

  // Snapping state
  const [snapX, setSnapX] = useState(false);
  const [snapY, setSnapY] = useState(false);
  const [snapPrecisionX, setSnapPrecisionX] = useState(1.0);
  const [snapPrecisionY, setSnapPrecisionY] = useState(1.0);
  const [plotName, setPlotName] = useState("curve_1");

  const snapValue = (value: number, precision: number) => {
    return Math.round(value / precision) * precision;
  };

  // Local state for input fields
  const [inputX, setInputX] = useState<string>("");
  const [inputY, setInputY] = useState<string>("");

  // Local state for axis domain inputs
  const [inputXDomain, setInputXDomain] = useState<[string, string]>([xDomain[0].toString(), xDomain[1].toString()]);
  const [inputYDomain, setInputYDomain] = useState<[string, string]>([yDomain[0].toString(), yDomain[1].toString()]);

  useEffect(() => {
    if (meanCoordinates) {
      setInputX(meanCoordinates.x.toFixed(2));
      setInputY(meanCoordinates.y.toFixed(2));
    } else {
      setInputX("");
      setInputY("");
    }

    setInputXDomain([xDomain[0].toString(), xDomain[1].toString()]);
    setInputYDomain([yDomain[0].toString(), yDomain[1].toString()]);
  }, [meanCoordinates, xDomain, yDomain]);

  // Utility Functions
  const getSvgCoords = (e: React.PointerEvent | React.MouseEvent) => {
    //@ts-ignore
    const svg = (e.currentTarget.ownerSVGElement ?? e.currentTarget) as SVGSVGElement;
    const rect = svg.getBoundingClientRect();
    return { x: e.clientX - rect.left - MARGIN.left, y: e.clientY - rect.top - MARGIN.top };
  };

  const isModifier = (e: React.PointerEvent) => e.shiftKey || e.ctrlKey || e.metaKey;

  const updateCoordinates = (axis: "x" | "y", value: number) => {
    setPoints(prev => {
      const next = [...prev];
      selectedIndices.forEach(i => {
        next[i] = {
          ...next[i],
          [axis]: axis === "x" && snapX
            ? snapValue(value, snapPrecisionX) // Apply snapping for X
            : axis === "y" && snapY
              ? snapValue(value, snapPrecisionY) // Apply snapping for Y
              : value,
        };
      });
      return next;
    });
  };

  const movePoints = (svgX: number, svgY: number) => {
    if (!isDraggingPoints.current || !dragStart.current) return;

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    animationFrameRef.current = requestAnimationFrame(() => {
      const dx = xScale.invert(svgX) - xScale.invert(dragStart.current!.x);
      const dy = yScale.invert(svgY) - yScale.invert(dragStart.current!.y);

      setPoints(prev => {
        const next = [...prev];
        selectedIndices.forEach(i => {
          let x = dragPointsStart.current[i].x + dx;
          let y = dragPointsStart.current[i].y + dy;

          // Apply snapping if enabled
          x = snapX ? snapValue(x, snapPrecisionX) : x;
          y = snapY ? snapValue(y, snapPrecisionY) : y;

          // Find nearest unselected neighbors
          const left = dragPointsStart.current
            .slice(0, i)
            .reverse()
            .find((_, idx) => !selectedIndices.has(i - idx - 1))?.x ?? X_DOMAIN[0];
          const right = dragPointsStart.current
            .slice(i + 1)
            .find((_, idx) => !selectedIndices.has(i + idx + 1))?.x ?? X_DOMAIN[1];

          // Clamp X/Y to domains and unselected neighbors
          x = Math.max(left, Math.min(right, x));
          x = Math.max(X_DOMAIN[0], Math.min(X_DOMAIN[1], x));
          y = Math.max(Y_DOMAIN[0], Math.min(Y_DOMAIN[1], y));

          next[i] = { x, y };
        });
        return next;
      });
    });
  };

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Pointer Handlers
  const startPointDrag = (i: number, e: React.PointerEvent) => {
    dragStart.current = getSvgCoords(e);
    dragPointsStart.current = [...points];
    isDraggingPoints.current = true;
  };

  const handlePointPointerDown = (i: number, e: React.PointerEvent) => {
    e.stopPropagation();
    wasPointClicked.current = true; // Mark that a point was clicked

    if (isModifier(e)) {
      // Allow toggling selection when a modifier key is pressed
      handlePointClick(i, e);
    } else if (!selectedIndices.has(i)) {
      // Only modify selection if the point is not already part of the selection
      handlePointClick(i, e);
    }

    startPointDrag(i, e);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointPointerUp = (e: React.PointerEvent) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    isDraggingPoints.current = false;
  };

  const handleBackgroundPointerDown = (e: React.PointerEvent) => {
    const { x } = getSvgCoords(e);
    setBrush({ x0: x, x1: x });
    isDraggingPoints.current = false;
    wasDragging.current = false;
  };

  const handleBackgroundPointerMove = (e: React.PointerEvent) => {
    if (!isDraggingPoints.current && brush) {
      const { x } = getSvgCoords(e);
      setBrush(prev => (prev ? { x0: prev.x0, x1: x } : null));
      wasDragging.current = true;

      const [bx0, bx1] = [Math.min(brush.x0, brush.x1), Math.max(brush.x0, brush.x1)];
      setSelectedIndices(prev => {
        const newSelection = new Set(isModifier(e) ? prev : []);
        sortedPoints.forEach((p, i) => {
          const sx = xScale(p.x);
          if (sx >= bx0 && sx <= bx1) newSelection.add(i);
        });
        return newSelection;
      });
    }
  };

  const handleBackgroundPointerUp = () => {
    if (!wasDragging.current && !wasPointClicked.current) {
      setSelectedIndices(new Set()); // Deselect points only if no point was clicked
    }
    setBrush(null);
    dragStart.current = null;
    isDraggingPoints.current = false;
    wasPointClicked.current = false; // Reset the flag
  };

  const handlePointClick = (i: number, e: React.PointerEvent) => {
    e.stopPropagation();
    if (isModifier(e)) {
      setSelectedIndices(prev => {
        const next = new Set(prev);
        if (next.has(i)) next.delete(i);
        else next.add(i);
        return next;
      });
    } else {
      // Always select the clicked point, even if no points are currently selected
      setSelectedIndices(new Set([i]));
    }
  };

  const handleInputBlur = (axis: "x" | "y") => {
    const value = axis === "x" ? parseFloat(inputX) : parseFloat(inputY);
    if (!isNaN(value)) {
      updateCoordinates(axis, value);
    }
  };

  const handleDomainInputBlur = (axis: "x" | "y", minOrMax: "min" | "max") => {
    const value = axis === "x"
      ? parseFloat(minOrMax === "min" ? inputXDomain[0] : inputXDomain[1])
      : parseFloat(minOrMax === "min" ? inputYDomain[0] : inputYDomain[1]);

    if (!isNaN(value)) {
      updateDomain(axis, minOrMax, value);
    } else {
      // Reset input to current domain value if invalid
      if (axis === "x") {
        setInputXDomain([xDomain[0].toString(), xDomain[1].toString()]);
      } else {
        setInputYDomain([yDomain[0].toString(), yDomain[1].toString()]);
      }
    }
  };

  const updateDomain = (axis: "x" | "y", minOrMax: "min" | "max", value: number) => {
    if (axis === "x") {
      setXDomain(prev => {
        const newDomain: [number, number] = minOrMax === "min" ? [value, prev[1]] : [prev[0], value];
        return newDomain[0] < newDomain[1] ? newDomain : prev; // Ensure min < max
      });
    } else {
      setYDomain(prev => {
        const newDomain: [number, number] = minOrMax === "min" ? [value, prev[1]] : [prev[0], value];
        return newDomain[0] < newDomain[1] ? newDomain : prev; // Ensure min < max
      });
    }
  };

  // Calculate min-max lines for selected points
  const minMaxLines = useMemo(() => {
    if (selectedIndices.size === 0) return null;

    const selectedPoints = Array.from(selectedIndices).map(i => points[i]);
    const minX = Math.min(...selectedPoints.map(p => p.x));
    const maxX = Math.max(...selectedPoints.map(p => p.x));
    const minY = Math.min(...selectedPoints.map(p => p.y));
    const maxY = Math.max(...selectedPoints.map(p => p.y));

    return { minX, maxX, minY, maxY };
  }, [selectedIndices, points]);

  // Handlers for selection manipulation
  const trimRight = () => {
    if (selectedIndices.size === 0) return; // Ensure there is a selection
    const maxX = Math.max(...Array.from(selectedIndices).map(i => points[i]?.x ?? -Infinity));
    setPoints(prev => prev.filter(p => p.x <= maxX));
    setSelectedIndices(new Set()); // Deselect all points
  };

  // Update trimLeft to deselect selection after trimming
  const trimLeft = () => {
    if (selectedIndices.size === 0) return; // Ensure there is a selection
    const minX = Math.min(...Array.from(selectedIndices).map(i => points[i]?.x ?? Infinity));
    setPoints(prev => prev.filter(p => p.x >= minX));
    setSelectedIndices(new Set()); // Deselect all points
  };

  const trim = () => {
    if (selectedIndices.size < 2) return; // Ensure there are at least two points selected
    const minX = Math.min(...Array.from(selectedIndices).map(i => points[i]?.x ?? Infinity));
    const maxX = Math.max(...Array.from(selectedIndices).map(i => points[i]?.x ?? -Infinity));
    setPoints(prev => prev.filter(p => p.x >= minX && p.x <= maxX));
    setSelectedIndices(new Set()); // Deselect all points
  };

  // Mirror right: rebuild array with overlap removal (no global sort)
  const mirrorRight = () => {
    const selected = Array.from(selectedIndices).sort((a, b) => a - b);
    if (selected.length < 2) return; // need at least 2 to mirror

    const selectedPoints = selected.map(i => points[i]);
    const maxX = Math.max(...selectedPoints.map(p => p.x));

    // Build mirrored points in ascending x order
    const mirrored = selected.slice(0, -1).reverse().map(i => ({
      x: maxX + (maxX - points[i].x),
      y: points[i].y,
    }));

    const lastIdx = selected[selected.length - 1];
    const mirrorCount = mirrored.length;

    // Remove overlapping region to the right equal to mirror length
    const rightRemoveStart = lastIdx + 1;
    const rightRemoveEnd = Math.min(points.length, rightRemoveStart + mirrorCount);
    const leftKeep = points.slice(0, rightRemoveStart);
    const rightKeep = points.slice(rightRemoveEnd);

    setPoints([...leftKeep, ...mirrored, ...rightKeep]);
    setSelectedIndices(new Set());
  };

  // Mirror left: rebuild array with overlap removal (no global sort)
  const mirrorLeft = () => {
    const selected = Array.from(selectedIndices).sort((a, b) => a - b);
    if (selected.length < 2) return; // need at least 2 to mirror

    const selectedPoints = selected.map(i => points[i]);
    const minX = Math.min(...selectedPoints.map(p => p.x));

    // Build mirrored points in ascending x order
    const mirrored = selected.slice(1).map(i => ({
      x: minX - (points[i].x - minX),
      y: points[i].y,
    })).reverse();

    const firstIdx = selected[0];
    const mirrorCount = mirrored.length;

    // Remove overlapping region to the left equal to mirror length
    const leftRemoveEnd = Math.max(0, firstIdx - mirrorCount);
    const leftKeep = points.slice(0, leftRemoveEnd);
    const rightKeep = points.slice(firstIdx);

    setPoints([...leftKeep, ...mirrored, ...rightKeep]);
    setSelectedIndices(new Set());
  };

  const flipVertical = () => {
    setPoints(prev => {
      const flipped = Array.from(selectedIndices).map(i => ({ ...points[i], y: -points[i].y }));
      const updated = [...prev];
      flipped.forEach((p, i) => {
        updated[Array.from(selectedIndices)[i]] = p;
      });
      return updated;
    });
    setSelectedIndices(new Set()); // Deselect all points
  };

  const flipHorizontal = () => {
    setPoints(prev => {
      const selectedPoints = Array.from(selectedIndices).map(i => points[i]);
      if (selectedPoints.length === 0) return prev; // Prevent crash if no points are selected

      const minX = Math.min(...selectedPoints.map(p => p.x));
      const maxX = Math.max(...selectedPoints.map(p => p.x));
      const flipped = selectedPoints.map(p => ({ ...p, x: maxX - (p.x - minX) }));

      const updated = [...prev];
      flipped.forEach((p, i) => {
        updated[Array.from(selectedIndices)[i]] = p;
      });
      return updated;
    });
    setSelectedIndices(new Set()); // Deselect all points
  };

  // Rewrite duplicateRight to mirror slice-based approach (no resorting)
  const duplicateRight = () => {
    const selected = Array.from(selectedIndices).sort((a, b) => a - b);
    if (selected.length === 0) return;

    const firstIdx = selected[0];
    const lastIdx = selected[selected.length - 1];
    const spanCount = lastIdx - firstIdx; // slots we might overwrite on the right

    const minX = Math.min(...selected.map(i => points[i].x));
    const maxX = Math.max(...selected.map(i => points[i].x));

    const duplicated = selected.map(i => ({
      x: maxX + (points[i].x - minX),
      y: points[i].y,
    }));

    // Keep only the part of the array strictly right of the duplicated span
    const rightRemoveStart = lastIdx + 1;
    const rightRemoveEnd = Math.min(points.length, lastIdx + 1 + spanCount);
    const leftKeep = points.slice(0, rightRemoveStart);
    const rightKeep = points.slice(rightRemoveEnd);

    setPoints([...leftKeep, ...duplicated, ...rightKeep]);
    setSelectedIndices(new Set());
  };

  // Implement duplicateLeft using array slicing (avoid resorting/filtering)
  const duplicateLeft = () => {
    const selected = Array.from(selectedIndices).sort((a, b) => a - b);
    if (selected.length === 0) return;

    const firstIdx = selected[0];
    const lastIdx = selected[selected.length - 1];
    const spanCount = lastIdx - firstIdx; // number of slots to the left to potentially replace

    const minX = Math.min(...selected.map(i => points[i].x));
    const maxX = Math.max(...selected.map(i => points[i].x));

    // Build duplicated segment mirrored to the left of the selection
    const duplicated = selected.map(i => ({
      x: minX - (maxX - points[i].x),
      y: points[i].y,
    }));

    // Keep only the part of the array strictly left of the duplicated span
    const leftKeepStart = Math.max(0, firstIdx - spanCount);
    const leftKeep = points.slice(0, leftKeepStart);
    const rightKeep = points.slice(firstIdx);

    setPoints([...leftKeep, ...duplicated, ...rightKeep]);
    setSelectedIndices(new Set());
  };

  const renderSidePanel = () => (
    <div
      ref={sidePanelRef}
      style={{
        flex: "0 1 auto",
        width: "max-content",
        maxWidth: sidePanelMaxWidth,
        padding: "12px",
        backgroundColor: "#fff",
        border: "1px solid #ccc",
        borderRadius: 6,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        boxSizing: "border-box",
        overflow: "auto",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label>
          Plot Name:
          <input
            type="text"
            value={plotName}
            onChange={e => setPlotName(e.target.value)}
            style={{ marginLeft: 5, width: 180 }}
          />
        </label>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <label>
          X:
          <input
            type="text"
            value={inputX}
            onChange={e => setInputX(e.target.value)}
            onBlur={() => handleInputBlur("x")}
            style={{ marginLeft: 5, width: 120 }}
            disabled={!meanCoordinates}
          />
        </label>
        <label>
          Y:
          <input
            type="text"
            value={inputY}
            onChange={e => setInputY(e.target.value)}
            onBlur={() => handleInputBlur("y")}
            style={{ marginLeft: 5, width: 120 }}
            disabled={!meanCoordinates}
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={snapX}
            onChange={e => setSnapX(e.target.checked)}
            style={{ marginRight: 6 }}
          />
          Snap X
        </label>
        <label>
          <input
            type="checkbox"
            checked={snapY}
            onChange={e => setSnapY(e.target.checked)}
            style={{ marginRight: 6 }}
          />
          Snap Y
        </label>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <label>
          Snap Precision X:
          <select
            value={snapPrecisionX}
            onChange={e => setSnapPrecisionX(parseFloat(e.target.value))}
            style={{ marginLeft: 5 }}
          >
            <option value={1.0}>1.0</option>
            <option value={0.1}>0.1</option>
            <option value={0.01}>0.01</option>
          </select>
        </label>
        <label>
          Snap Precision Y:
          <select
            value={snapPrecisionY}
            onChange={e => setSnapPrecisionY(parseFloat(e.target.value))}
            style={{ marginLeft: 5 }}
          >
            <option value={1.0}>1.0</option>
            <option value={0.1}>0.1</option>
            <option value={0.01}>0.01</option>
          </select>
        </label>
        <label>
          X Min:
          <input
            type="text"
            value={inputXDomain[0]}
            onChange={e => setInputXDomain([e.target.value, inputXDomain[1]])}
            onBlur={() => handleDomainInputBlur("x", "min")}
            style={{ marginLeft: 5, width: 120 }}
          />
        </label>
        <label>
          X Max:
          <input
            type="text"
            value={inputXDomain[1]}
            onChange={e => setInputXDomain([inputXDomain[0], e.target.value])}
            onBlur={() => handleDomainInputBlur("x", "max")}
            style={{ marginLeft: 5, width: 120 }}
          />
        </label>
        <label>
          Y Min:
          <input
            type="text"
            value={inputYDomain[0]}
            onChange={e => setInputYDomain([e.target.value, inputYDomain[1]])}
            onBlur={() => handleDomainInputBlur("y", "min")}
            style={{ marginLeft: 5, width: 120 }}
          />
        </label>
        <label>
          Y Max:
          <input
            type="text"
            value={inputYDomain[1]}
            onChange={e => setInputYDomain([inputYDomain[0], e.target.value])}
            onBlur={() => handleDomainInputBlur("y", "max")}
            style={{ marginLeft: 5, width: 120 }}
          />
        </label>
      </div>
    </div>
  );

  useImperativeHandle(
    ref,
    () => ({
      flipVertical,
      flipHorizontal,
      trim,
      trimLeft,
      trimRight,
      mirrorLeft,
      mirrorRight,
      duplicateLeft,
      duplicateRight,
      renderSidePanel,
    }),
    [flipVertical, flipHorizontal, trim, trimLeft, trimRight, mirrorLeft, mirrorRight, duplicateLeft, duplicateRight, renderSidePanel]
  );

  return (
    <div
      className="curve-editor"
      onPointerDownCapture={onActivate}
      style={{
        display: "flex",
        width: "100%",
        maxWidth: width,
        height,
        minHeight: height,
        columnGap: GRID_GAP,
        alignItems: "flex-start",
        overflow: "hidden",
        cursor: active ? "default" : "pointer",
        flex: "0 0 auto",
        flexShrink: 0,
      }}
    >
      <div style={{ flex: "1 1 0", minWidth: 0, display: "flex", flexDirection: "column", gap: GRID_GAP }}>
        {/* Selection Manipulation Panel (can be hidden when managed externally) */}
        {showTopPanel && (
          <div
            style={{
              width: plotWidth,
              display: "flex",
              flexWrap: "wrap",
              gap: "10px",
              padding: "10px",
              backgroundColor: "#fff",
              border: "1px solid #ccc",
              borderRadius: 6,
              boxSizing: "border-box",
            }}
          >
            <button onClick={flipVertical}>Flip Vertical</button>
            <button onClick={flipHorizontal}>Flip Horizontal</button>
            <button onClick={trim}>Trim</button>
            <button onClick={trimLeft}>Trim Left</button>
            <button onClick={trimRight}>Trim Right</button>
            <button onClick={mirrorLeft}>Mirror Left</button>
            <button onClick={mirrorRight}>Mirror Right</button>
            <button onClick={duplicateLeft}>Duplicate Left</button>
            <button onClick={duplicateRight}>Duplicate Right</button>
          </div>
        )}

        {/* SVG Plot with title overlay */}
        <div
          style={{
            position: "relative",
            width: plotWidth,
            height,
            border: `2px solid ${active ? "#1976d2" : "#ccc"}`,
            borderRadius: 6,
            overflow: "hidden",
            backgroundColor: "#fff",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 8,
              left: 8,
              fontWeight: "bold",
              backgroundColor: "rgba(255,255,255,0.85)",
              padding: "2px 6px",
              borderRadius: 4,
              pointerEvents: "none",
            }}
          >
            {plotName}
          </div>
          <svg
            className="plot"
            width={plotWidth}
            height={height}
            style={{ userSelect: "none", touchAction: "none", display: "block" }}
            onDoubleClick={e => {
              const { x, y } = getSvgCoords(e);
              const domainX = xScale.invert(Math.max(0, Math.min(innerWidth, x)));
              const domainY = yScale.invert(Math.max(0, Math.min(innerHeight, y)));
              setPoints(prev => [...prev, { x: domainX, y: domainY }].sort((a, b) => a.x - b.x));
              setSelectedIndices(new Set());
            }}
            onPointerDown={handleBackgroundPointerDown}
            onPointerMove={handleBackgroundPointerMove}
            onPointerUp={handleBackgroundPointerUp}
          >
            <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
              {/* Axes */}
              <line x1={0} x2={innerWidth} y1={innerHeight} y2={innerHeight} stroke="black" />
              {xTicks.map(tick => (
                <g key={tick} transform={`translate(${xScale(tick)}, ${innerHeight})`}>
                  <line y2={6} stroke="black" />
                  <text y={20} textAnchor="middle" fontSize={12}>{tick}</text>
                </g>
              ))}
              <line x1={0} x2={0} y1={0} y2={innerHeight} stroke="black" />
              {yTicks.map(tick => (
                <g key={tick} transform={`translate(0, ${yScale(tick)})`}>
                  <line x2={-6} stroke="black" />
                  <text x={-10} dy="0.32em" textAnchor="end" fontSize={12}>{tick}</text>
                </g>
              ))}

              {/* Zero axes */}
              {xDomain[0] <= 0 && xDomain[1] >= 0 && (
                <line x1={xScale(0)} x2={xScale(0)} y1={0} y2={innerHeight} stroke="#888" strokeWidth={1} />
              )}
              {yDomain[0] <= 0 && yDomain[1] >= 0 && (
                <line x1={0} x2={innerWidth} y1={yScale(0)} y2={yScale(0)} stroke="#888" strokeWidth={1} />
              )}

              {/* Curve */}
              <path d={pathD} fill="none" stroke="black" strokeWidth={1.5} />

              {/* Brush */}
              {brush && (
                <rect
                  x={Math.min(brush.x0, brush.x1)}
                  y={0}
                  width={Math.abs(brush.x1 - brush.x0)}
                  height={innerHeight}
                  fill="rgba(0,120,215,0.2)"
                />
              )}

              {/* Control Points */}
              {sortedPoints.map((p, i) => (
                <circle
                  key={i}
                  cx={xScale(p.x)}
                  cy={yScale(p.y)}
                  r={5}
                  fill={selectedIndices.has(i) ? "black" : "white"}
                  stroke="black"
                  style={{ cursor: "pointer" }}
                  onPointerDown={e => handlePointPointerDown(i, e)}
                  onPointerMove={e => {
                    if (isDraggingPoints.current) {
                      const { x, y } = getSvgCoords(e);
                      movePoints(x, y);
                    }
                  }}
                  onPointerUp={handlePointPointerUp}
                  onDoubleClick={e => {
                    e.stopPropagation();
                    setPoints(prev => {
                      if (prev.length <= MIN_POINTS) return prev;
                      return prev.filter((_, idx) => idx !== i);
                    });
                    setSelectedIndices(new Set());
                  }}
                />
              ))}

              {/* Min-Max Lines for Selected Points */}
              {minMaxLines && (
                <g>
                  {/* X-axis lines */}
                  <line
                    x1={xScale(minMaxLines.minX)}
                    x2={xScale(minMaxLines.minX)}
                    y1={0}
                    y2={innerHeight}
                    stroke="red"
                    strokeDasharray="4"
                  />
                  <line
                    x1={xScale(minMaxLines.maxX)}
                    x2={xScale(minMaxLines.maxX)}
                    y1={0}
                    y2={innerHeight}
                    stroke="red"
                    strokeDasharray="4"
                  />

                  {/* Y-axis lines */}
                  <line
                    x1={0}
                    x2={innerWidth}
                    y1={yScale(minMaxLines.minY)}
                    y2={yScale(minMaxLines.minY)}
                    stroke="blue"
                    strokeDasharray="4"
                  />
                  <line
                    x1={0}
                    x2={innerWidth}
                    y1={yScale(minMaxLines.maxY)}
                    y2={yScale(minMaxLines.maxY)}
                    stroke="blue"
                    strokeDasharray="4"
                  />
                </g>
              )}
            </g>
          </svg>
        </div>
      </div>

      {/* Side Panel (render inline only when requested) */}
      {renderSidePanelInline && showSidePanel && active && renderSidePanel()}
      {!renderSidePanelInline && showSidePanel && active && sidePanelContainer
        ? createPortal(renderSidePanel(), sidePanelContainer)
        : null}
    </div>
  );
});
