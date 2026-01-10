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

  // --------------------
  // STATEFUL POINTS
  // --------------------
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

  // --------
  // SCALES
  // --------
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

  const screenToDomain = (clientX: number, clientY: number) => {
    const svgX = clientX - MARGIN.left;
    const svgY = clientY - MARGIN.top;

    const x = xScale.invert(
      Math.max(0, Math.min(innerWidth, svgX))
    );
    const y = yScale.invert(
      Math.max(0, Math.min(innerHeight, svgY))
    );

    return {
      x: Math.max(X_DOMAIN[0], Math.min(X_DOMAIN[1], x)),
      y: Math.max(Y_DOMAIN[0], Math.min(Y_DOMAIN[1], y)),
    };
  };


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
  // DRAG HANDLER (XY)
  // --------
  const updatePoint = (
    index: number,
    clientX: number,
    clientY: number
  ) => {
    const svgX = clientX - MARGIN.left;
    const svgY = clientY - MARGIN.top;

    const clampedSvgX = Math.max(0, Math.min(innerWidth, svgX));
    const clampedSvgY = Math.max(0, Math.min(innerHeight, svgY));

    let x = xScale.invert(clampedSvgX);
    let y = yScale.invert(clampedSvgY);

    // Clamp Y to domain
    y = Math.max(Y_DOMAIN[0], Math.min(Y_DOMAIN[1], y));

    setPoints(prev => {
      const sorted = [...prev].sort((a, b) => a.x - b.x);

      const left = sorted[index - 1]?.x ?? X_DOMAIN[0];
      const right = sorted[index + 1]?.x ?? X_DOMAIN[1];

      // Clamp X between neighbors
      x = Math.max(left, Math.min(right, x));

      const updated = [...sorted];
      updated[index] = { x, y };
      return updated;
    });
  };

  return (
    <svg
      width={width}
      height={height}
      onDoubleClick={e => {
        const { x, y } = screenToDomain(e.clientX, e.clientY);

        setPoints(prev => {
          const next = [...prev, { x, y }];
          return next.sort((a, b) => a.x - b.x);
        });
      }}>
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

                // Protect endpoints
                if (i === 0 || i === sorted.length - 1) return prev;

                return sorted.filter((_, idx) => idx !== i);
              });
            }}
            onPointerDown={e =>
              e.currentTarget.setPointerCapture(e.pointerId)
            }
            onPointerMove={e => {
              if (e.buttons === 1) {
                updatePoint(i, e.clientX, e.clientY);
              }
            }}
          />

        ))}

      </g>
    </svg>
  );
}
