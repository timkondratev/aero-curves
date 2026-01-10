import { scaleLinear } from "d3";
import { useMemo } from "react";

type GraphProps = {
  width: number;
  height: number;
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

  // --- D3 SCALES (PURE MATH) ---
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

  return (
    <svg width={width} height={height}>
      <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>

        {/* X AXIS */}
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

        {/* Y AXIS */}
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

        {/* ORIGIN LINE (DEBUG VISUAL) */}
        <line
          x1={xScale(0)}
          x2={xScale(0)}
          y1={0}
          y2={innerHeight}
          stroke="red"
          strokeDasharray="4 4"
        />

      </g>
    </svg>
  );
}
