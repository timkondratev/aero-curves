import { scaleLinear, line, curveMonotoneX } from "d3";
import { useMemo, useState, useRef, useEffect } from "react";

// Constants
const MARGIN = { top: 20, right: 20, bottom: 40, left: 50 };
const X_DOMAIN: [number, number] = [-180, 180];
const Y_DOMAIN: [number, number] = [-1, 1];
const MIN_POINTS = 2;

// Types
type GraphProps = { width: number; height: number };
type Point = { x: number; y: number };

export function Graph({ width, height }: GraphProps) {
  // Dimensions
  const innerWidth = width - MARGIN.left - MARGIN.right;
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

  // Scales
  const xScale = useMemo(() => scaleLinear().domain(X_DOMAIN).range([0, innerWidth]), [innerWidth]);
  const yScale = useMemo(() => scaleLinear().domain(Y_DOMAIN).range([innerHeight, 0]), [innerHeight]);

  // Ticks
  const xTicks = xScale.ticks(9);
  const yTicks = yScale.ticks(5);

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

  const snapValue = (value: number, precision: number) => {
    return Math.round(value / precision) * precision;
  };

  // Local state for input fields
  const [inputX, setInputX] = useState<string>("");
  const [inputY, setInputY] = useState<string>("");

  useEffect(() => {
    if (meanCoordinates) {
      setInputX(meanCoordinates.x.toFixed(2));
      setInputY(meanCoordinates.y.toFixed(2));
    } else {
      setInputX("");
      setInputY("");
    }
  }, [meanCoordinates]);

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

      const [bx0, bx1] = [Math.min(brush.x0, brush.x1), Math.max(brush.x0, x)];
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

  return (
    <div className="curve-editor" style={{ position: "relative", width, height: height + 80 }}> {/* Adjusted height for both panels */}
      {/* Inspector Panel */}
      <div
        style={{
          height: 40,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: "#f0f0f0",
          padding: "0 10px",
          borderBottom: "1px solid #ccc",
        }}
      >
        <label>
          X:
          <input
            type="text"
            value={inputX}
            onChange={e => setInputX(e.target.value)}
            onBlur={() => handleInputBlur("x")}
            style={{ marginLeft: 5, width: 80 }}
            disabled={!meanCoordinates} // Disable input if no points are selected
          />
        </label>
        <label>
          Y:
          <input
            type="text"
            value={inputY}
            onChange={e => setInputY(e.target.value)}
            onBlur={() => handleInputBlur("y")}
            style={{ marginLeft: 5, width: 80 }}
            disabled={!meanCoordinates} // Disable input if no points are selected
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={snapX}
            onChange={e => setSnapX(e.target.checked)}
            style={{ marginLeft: 10 }}
          />
          Snap X
        </label>
        <label>
          <input
            type="checkbox"
            checked={snapY}
            onChange={e => setSnapY(e.target.checked)}
            style={{ marginLeft: 10 }}
          />
          Snap Y
        </label>
      </div>

      {/* SVG Graph */}
      <svg
        className="graph"
        width={width}
        height={height}
        style={{ userSelect: "none", touchAction: "none" }}
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

          {/* Curve */}
          <path d={pathD} fill="none" stroke="steelblue" strokeWidth={2} />

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
              r={6}
              fill={selectedIndices.has(i) ? "orange" : "white"}
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
                  const sorted = [...prev].sort((a, b) => a.x - b.x);
                  if (i === 0 || i === sorted.length - 1) return prev;
                  return sorted.filter((_, idx) => idx !== i);
                });
                setSelectedIndices(new Set());
              }}
            />
          ))}
        </g>
      </svg>

      {/* Snapping Precision Panel */}
      <div
        style={{
          height: 40,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: "#f0f0f0",
          padding: "0 10px",
          borderTop: "1px solid #ccc",
        }}
      >
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
      </div>
    </div>
  );
}
