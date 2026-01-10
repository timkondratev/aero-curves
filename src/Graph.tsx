import { scaleLinear, line, curveMonotoneX } from "d3";
import { useMemo, useState } from "react";

type GraphProps = {
  width: number;
  height: number;
};

type Point = {
  x: number;
  y: number;
};

const MARGIN = {
  top: 20,
  right: 20,
  bottom: 40,
  left: 50,
};

const X_DOMAIN: [number, number] = [-180, 180];
const Y_DOMAIN: [number, number] = [-1, 1];
const MIN_POINTS = 2;

export function Graph({ width, height }: GraphProps) {
  const innerWidth = width - MARGIN.left - MARGIN.right;
  const innerHeight = height - MARGIN.top - MARGIN.bottom;

  const [points, setPoints] = useState<Point[]>(() => {
    const count = 16;
    return Array.from({ length: count }, (_, i) => {
      const x = X_DOMAIN[0] + ((X_DOMAIN[1] - X_DOMAIN[0]) * i) / (count - 1);
      return {
        x,
        y: Math.sin((x * Math.PI) / 180) * 0.8,
      };
    });
  });

  const sortedPoints = useMemo(
    () => [...points].sort((a, b) => a.x - b.x),
    [points]
  );

  const xScale = useMemo(
    () =>
      scaleLinear()
        .domain(X_DOMAIN)
        .range([0, innerWidth]),
    [innerWidth]
  );

  const yScale = useMemo(
    () =>
      scaleLinear()
        .domain(Y_DOMAIN)
        .range([innerHeight, 0]),
    [innerHeight]
  );

  const xTicks = xScale.ticks(9);
  const yTicks = yScale.ticks(5);

  // Convert pointer to SVG local coords
  const getSvgCoords = (e: React.PointerEvent | React.MouseEvent) => {
    //@ts-ignore
    const svg = (e.currentTarget.ownerSVGElement ?? e.currentTarget) as SVGSVGElement;
    const rect = svg.getBoundingClientRect();
    return {
      x: e.clientX - rect.left - MARGIN.left,
      y: e.clientY - rect.top - MARGIN.top,
    };
  };

  const pathD = useMemo(() => {
    return (
      line<Point>()
        .x(d => xScale(d.x))
        .y(d => yScale(d.y))
        .curve(curveMonotoneX)(sortedPoints) ?? ""
    );
  }, [sortedPoints, xScale, yScale]);

  const updatePoint = (index: number, svgX: number, svgY: number) => {
    const clampedX = Math.max(0, Math.min(innerWidth, svgX));
    const clampedY = Math.max(0, Math.min(innerHeight, svgY));

    let x = xScale.invert(clampedX);
    let y = yScale.invert(clampedY);

    y = Math.max(Y_DOMAIN[0], Math.min(Y_DOMAIN[1], y));

    setPoints(prev => {
      const sorted = [...prev].sort((a, b) => a.x - b.x);

      const left = sorted[index - 1]?.x ?? X_DOMAIN[0];
      const right = sorted[index + 1]?.x ?? X_DOMAIN[1];

      x = Math.max(left, Math.min(right, x));

      const next = [...sorted];
      next[index] = { x, y };
      return next;
    });
  };

  return (
    <svg
      width={width}
      height={height}
      onDoubleClick={e => {
        const { x, y } = getSvgCoords(e);

        const domainX = xScale.invert(Math.max(0, Math.min(innerWidth, x)));
        const domainY = yScale.invert(Math.max(0, Math.min(innerHeight, y)));

        setPoints(prev =>
          [...prev, { x: domainX, y: domainY }].sort((a, b) => a.x - b.x)
        );
      }}
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

        {/* CONTROL POINTS */}
        {sortedPoints.map((p, i) => (
          <circle
            key={i}
            cx={xScale(p.x)}
            cy={yScale(p.y)}
            r={5}
            fill="white"
            stroke="black"
            style={{ cursor: "move" }}
            onDoubleClick={e => {
              e.stopPropagation();
              setPoints(prev => {
                if (prev.length <= MIN_POINTS) return prev;
                const sorted = [...prev].sort((a, b) => a.x - b.x);
                if (i === 0 || i === sorted.length - 1) return prev;
                return sorted.filter((_, idx) => idx !== i);
              });
            }}
            onPointerDown={e => e.currentTarget.setPointerCapture(e.pointerId)}
            onPointerMove={e => {
              if (e.buttons === 1) {
                const { x, y } = getSvgCoords(e);
                updatePoint(i, x, y);
              }
            }}
          />
        ))}
      </g>
    </svg>
  );
}
