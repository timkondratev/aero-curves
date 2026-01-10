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

export function Graph({ width, height }: GraphProps) {
  const innerWidth = width - MARGIN.left - MARGIN.right;
  const innerHeight = height - MARGIN.top - MARGIN.bottom;

  // --------------------
  // STATEFUL POINTS
  // --------------------
  const [points, setPoints] = useState<Point[]>(() => {
    const count = 16;
    return Array.from({ length: count }, (_, i) => {
      const x = -180 + (360 * i) / (count - 1);
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

  // --------
  // SCALES
  // --------
  const xScale = useMemo(
    () =>
      scaleLinear()
        .domain([-180, 180])
        .range([0, innerWidth]),
    [innerWidth]
  );

  const yScale = useMemo(
    () =>
      scaleLinear()
        .domain([-1, 1])
        .range([innerHeight, 0]),
    [innerHeight]
  );

  const xTicks = xScale.ticks(9);
  const yTicks = yScale.ticks(5);

  // --------
  // CURVE
  // --------
  const pathD = useMemo(() => {
    return (
      line<Point>()
        .x(d => xScale(d.x))
        .y(d => yScale(d.y))
        .curve(curveMonotoneX)(sortedPoints) ?? ""
    );
  }, [sortedPoints, xScale, yScale]);

  // --------
  // DRAG HANDLER
  // --------
  const updatePointY = (index: number, clientY: number) => {
    const svgY = clientY - MARGIN.top;
    const clampedY = Math.max(0, Math.min(innerHeight, svgY));
    const y = yScale.invert(clampedY);

    setPoints(prev =>
      prev.map((p, i) =>
        i === index ? { ...p, y: Math.max(-1, Math.min(1, y)) } : p
      )
    );
  };

  return (
    <svg width={width} height={height}>
      <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>

        {/* AXES */}
        <line
          x1={0}
          x2={innerWidth}
          y1={innerHeight}
          y2={innerHeight}
          stroke="black"
        />
        {xTicks.map(tick => (
          <g
            key={tick}
            transform={`translate(${xScale(tick)}, ${innerHeight})`}
          >
            <line y2={6} stroke="black" />
            <text y={20} textAnchor="middle" fontSize={12}>
              {tick}
            </text>
          </g>
        ))}

        <line
          x1={0}
          x2={0}
          y1={0}
          y2={innerHeight}
          stroke="black"
        />
        {yTicks.map(tick => (
          <g
            key={tick}
            transform={`translate(0, ${yScale(tick)})`}
          >
            <line x2={-6} stroke="black" />
            <text
              x={-10}
              dy="0.32em"
              textAnchor="end"
              fontSize={12}
            >
              {tick}
            </text>
          </g>
        ))}

        {/* CURVE */}
        <path
          d={pathD}
          fill="none"
          stroke="steelblue"
          strokeWidth={2}
        />

        {/* CONTROL POINTS */}
        {sortedPoints.map((p, i) => (
          <circle
            key={i}
            cx={xScale(p.x)}
            cy={yScale(p.y)}
            r={5}
            fill="white"
            stroke="black"
            style={{ cursor: "ns-resize" }}
            onPointerDown={e =>
              e.currentTarget.setPointerCapture(e.pointerId)
            }
            onPointerMove={e => {
              if (e.buttons === 1) {
                updatePointY(i, e.clientY);
              }
            }}
          />
        ))}

      </g>
    </svg>
  );
}
