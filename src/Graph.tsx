import { scaleLinear, line, curveMonotoneX } from "d3";
import { useMemo, useState, useRef } from "react";

type GraphProps = { width: number; height: number };
type Point = { x: number; y: number };

const MARGIN = { top: 20, right: 20, bottom: 40, left: 50 };
const X_DOMAIN: [number, number] = [-180, 180];
const Y_DOMAIN: [number, number] = [-1, 1];
const MIN_POINTS = 2;

export function Graph({ width, height }: GraphProps) {
  const innerWidth = width - MARGIN.left - MARGIN.right;
  const innerHeight = height - MARGIN.top - MARGIN.bottom;

  const [points, setPoints] = useState<Point[]>(() =>
    Array.from({ length: 16 }, (_, i) => {
      const x = X_DOMAIN[0] + ((X_DOMAIN[1] - X_DOMAIN[0]) * i) / 15;
      return { x, y: Math.sin((x * Math.PI) / 180) * 0.8 };
    })
  );
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [brush, setBrush] = useState<{ x0: number; x1: number } | null>(null);

  const dragStart = useRef<{ x: number; y: number } | null>(null); // pointer start coords
  const dragPointsStart = useRef<Point[]>([]); // positions of points at drag start
  const isDraggingPoints = useRef(false);
  const wasDragging = useRef(false); // Track if dragging occurred

  const sortedPoints = useMemo(() => [...points].sort((a, b) => a.x - b.x), [points]);

  const xScale = useMemo(() => scaleLinear().domain(X_DOMAIN).range([0, innerWidth]), [innerWidth]);
  const yScale = useMemo(() => scaleLinear().domain(Y_DOMAIN).range([innerHeight, 0]), [innerHeight]);

  const xTicks = xScale.ticks(9);
  const yTicks = yScale.ticks(5);

  const getSvgCoords = (e: React.PointerEvent | React.MouseEvent) => {
    //@ts-ignore
    const svg = (e.currentTarget.ownerSVGElement ?? e.currentTarget) as SVGSVGElement;
    const rect = svg.getBoundingClientRect();
    return { x: e.clientX - rect.left - MARGIN.left, y: e.clientY - rect.top - MARGIN.top };
  };

  const pathD = useMemo(() => {
    return line<Point>()
      .x(d => xScale(d.x))
      .y(d => yScale(d.y))
      .curve(curveMonotoneX)(sortedPoints) ?? '';
  }, [sortedPoints, xScale, yScale]);

  const isModifier = (e: React.PointerEvent) => e.shiftKey || e.ctrlKey || e.metaKey;

  const startPointDrag = (index: number, e: React.PointerEvent) => {
    dragStart.current = getSvgCoords(e);
    isDraggingPoints.current = true;
    dragPointsStart.current = points.map(p => ({ ...p }));
  };

  const movePoints = (svgX: number, svgY: number) => {
    if (!isDraggingPoints.current || !dragStart.current) return;

    const dx = xScale.invert(svgX) - xScale.invert(dragStart.current.x);
    const dy = yScale.invert(svgY) - yScale.invert(dragStart.current.y);

    setPoints(prev => {
      const next = [...prev];
      selectedIndices.forEach(i => {
        let x = dragPointsStart.current[i].x + dx;
        let y = dragPointsStart.current[i].y + dy;

        // Clamp X/Y to domains
        x = Math.max(X_DOMAIN[0], Math.min(X_DOMAIN[1], x));
        y = Math.max(Y_DOMAIN[0], Math.min(Y_DOMAIN[1], y));

        // Optional: clamp X between neighbors for monotone curve
        const left = dragPointsStart.current[i - 1]?.x ?? X_DOMAIN[0];
        const right = dragPointsStart.current[i + 1]?.x ?? X_DOMAIN[1];
        x = Math.max(left, Math.min(right, x));

        next[i] = { x, y };
      });
      return next;
    });
  };

  const handleBackgroundPointerDown = (e: React.PointerEvent) => {
    const { x } = getSvgCoords(e);
    setBrush({ x0: x, x1: x });
    isDraggingPoints.current = false;
    wasDragging.current = false; // Reset dragging state
  };

  const handleBackgroundPointerMove = (e: React.PointerEvent) => {
    if (!isDraggingPoints.current && brush) {
      const { x } = getSvgCoords(e);
      setBrush(prev => prev ? { x0: prev.x0, x1: x } : null);
      wasDragging.current = true; // Mark as dragging

      // Update selection
      const [bx0, bx1] = [Math.min(brush.x0, x), Math.max(brush.x0, x)];
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
    if (!wasDragging.current) {
      setSelectedIndices(new Set()); // Deselect points if no drag occurred
    }
    setBrush(null);
    dragStart.current = null;
    isDraggingPoints.current = false;
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
      if (!selectedIndices.has(i)) setSelectedIndices(new Set([i]));
    }
  };

  return (
    <svg
      className="graph"
      width={width}
      height={height}
      style={{ userSelect: 'none', touchAction: 'none' }}
      onDoubleClick={e => {
        const { x, y } = getSvgCoords(e);
        const domainX = xScale.invert(Math.max(0, Math.min(innerWidth, x)));
        const domainY = yScale.invert(Math.max(0, Math.min(innerHeight, y)));
        setPoints(prev => [...prev, { x: domainX, y: domainY }].sort((a, b) => a.x - b.x));
        setSelectedIndices(new Set()); // <-- clear selection on add
      }}
      onPointerDown={handleBackgroundPointerDown}
      onPointerMove={handleBackgroundPointerMove}
      onPointerUp={handleBackgroundPointerUp}
    >
      <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
        {/* AXES */}
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

        {/* CURVE */}
        <path d={pathD} fill="none" stroke="steelblue" strokeWidth={2} />

        {/* BRUSH */}
        {brush && (
          <rect
            x={Math.min(brush.x0, brush.x1)}
            y={0}
            width={Math.abs(brush.x1 - brush.x0)}
            height={innerHeight}
            fill="rgba(0,120,215,0.2)"
          />
        )}

        {/* CONTROL POINTS */}
        {sortedPoints.map((p, i) => (
          <circle
            key={i}
            cx={xScale(p.x)}
            cy={yScale(p.y)}
            r={6}
            fill={selectedIndices.has(i) ? 'orange' : 'white'}
            stroke="black"
            style={{ cursor: 'pointer' }}
            onPointerDown={e => {
              e.stopPropagation();
              handlePointClick(i, e);
              startPointDrag(i, e);
            }}
            onPointerMove={e => {
              if (isDraggingPoints.current) {
                const { x, y } = getSvgCoords(e);
                movePoints(x, y);
              }
            }}
            onDoubleClick={e => {
              e.stopPropagation();
              setPoints(prev => {
                if (prev.length <= MIN_POINTS) return prev;
                const sorted = [...prev].sort((a, b) => a.x - b.x);
                if (i === 0 || i === sorted.length - 1) return prev;
                return sorted.filter((_, idx) => idx !== i);
              });
              setSelectedIndices(new Set()); // <-- clear selection on delete
            }}
          />
        ))}
      </g>
    </svg>
  );
}
