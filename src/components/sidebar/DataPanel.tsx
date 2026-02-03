import { useMemo, useState } from "react";
import { Parser } from "expr-eval";
import type { PlotState } from "../../state/reducer";
import { buildMonotoneSpline } from "../../utils/monotone";
import { clampValue } from "../../utils/geometry";

const toJson = (points: PlotState["points"]) => JSON.stringify(points.map(p => ({ x: p.x, y: p.y })), null, 2);

type Props = {
	plot: PlotState;
	onChange: (plot: PlotState) => void;
};

export function DataPanel({ plot, onChange }: Props) {
	const [copied, setCopied] = useState(false);
	const [formula, setFormula] = useState("sin(x)");
	const [formulaError, setFormulaError] = useState<string | null>(null);
	const pointsJson = useMemo(() => toJson(plot.points), [plot.points]);

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(pointsJson);
			setCopied(true);
			setTimeout(() => setCopied(false), 800);
		} catch {
			setCopied(false);
		}
	};

	const handleNormalize = () => {
		if (plot.points.length < 2) return;
		const sorted = [...plot.points].sort((a, b) => a.x - b.x);
		const { evaluate } = buildMonotoneSpline(sorted, x => x, y => y);
		const [x0, x1] = plot.domainX;
		const span = x1 - x0;
		const step = span > 0 && plot.snapPrecisionX > 0 ? plot.snapPrecisionX : span / (sorted.length - 1 || 1);
		if (step <= 0) return;
		const xs: number[] = [];
		for (let x = x0, i = 0; x <= x1 + 1e-9 && xs.length < 2000; x += step, i++) {
			const snapped = parseFloat(x.toFixed(8));
			xs.push(snapped);
		}
		if (xs[xs.length - 1] < x1 && xs.length < 2000) xs.push(x1);
		const nextPoints = xs.map((x, i) => {
			const y = clampValue(evaluate(x), plot.domainY);
			const id = sorted[i]?.id ?? `pt_norm_${i}`;
			return { id, x, y };
		});
		onChange({ ...plot, points: nextPoints, selection: [], brush: null });
	};

	const handleCalculate = () => {
		setFormulaError(null);
		const trimmed = formula.trim();
		if (!trimmed) {
			setFormulaError("Enter a formula to calculate.");
			return;
		}
		let expr;
		try {
			expr = Parser.parse(trimmed);
		} catch (err) {
			const message = err instanceof Error ? err.message : "Invalid formula.";
			setFormulaError(message);
			return;
		}

		const [x0, x1] = plot.domainX;
		const minX = Math.min(x0, x1);
		const maxX = Math.max(x0, x1);
		const span = maxX - minX;
		const step = plot.snapPrecisionX > 0 ? plot.snapPrecisionX : span / 100;
		if (!Number.isFinite(step) || step <= 0) {
			setFormulaError("Grid step must be greater than 0.");
			return;
		}

		const nextPoints: PlotState["points"] = [];
		let i = 0;
		for (let x = minX; x <= maxX + 1e-9 && nextPoints.length < 2000; x += step) {
			const snapped = parseFloat(x.toFixed(8));
			let y: number;
			try {
				y = expr.evaluate({ x: snapped });
			} catch (err) {
				const message = err instanceof Error ? err.message : "Invalid formula.";
				setFormulaError(`Error at x=${snapped}: ${message}`);
				return;
			}
			if (!Number.isFinite(y)) {
				setFormulaError(`Formula returned non-finite value at x=${snapped}.`);
				return;
			}
			const clamped = clampValue(y, plot.domainY);
			nextPoints.push({ id: `pt_expr_${i}`, x: snapped, y: clamped });
			i += 1;
		}

		if (nextPoints.length > 0 && nextPoints[nextPoints.length - 1].x < maxX && nextPoints.length < 2000) {
			const snapped = parseFloat(maxX.toFixed(8));
			let y: number;
			try {
				y = expr.evaluate({ x: snapped });
			} catch (err) {
				const message = err instanceof Error ? err.message : "Invalid formula.";
				setFormulaError(`Error at x=${snapped}: ${message}`);
				return;
			}
			if (!Number.isFinite(y)) {
				setFormulaError(`Formula returned non-finite value at x=${snapped}.`);
				return;
			}
			const clamped = clampValue(y, plot.domainY);
			nextPoints.push({ id: `pt_expr_${i}`, x: snapped, y: clamped });
		}

		if (!nextPoints.length) {
			setFormulaError("No points generated.");
			return;
		}
		onChange({ ...plot, points: nextPoints, selection: [], brush: null });
	};

	return (
		<div className="panel-section">
			<div className="section-title">DATA</div>
			<div className="form-row">
				<div className="row-label">Formula</div>
				<input
					className="row-control"
					value={formula}
					onChange={e => {
						setFormula(e.target.value);
						setFormulaError(null);
					}}
					placeholder="e.g. sin(x)"
				/>
				<button className="btn" type="button" onClick={handleCalculate}>
					Calculate
				</button>
			</div>
			{formulaError && (
				<div className="form-row">
					<div className="row-label" />
					<div className="row-control field-message is-error">{formulaError}</div>
				</div>
			)}
			<div className="form-row inline-pair">
				<button className="btn" type="button" onClick={handleNormalize} disabled={plot.points.length < 2}>
					Normalize to domain
				</button>
				<button className="btn" type="button" onClick={handleCopy}>
					{copied ? "Copied" : "Copy JSON"}
				</button>
			</div>
			<div className="form-row">
				<textarea className="row-control" value={pointsJson} readOnly rows={8} style={{ fontFamily: "monospace" }} />
			</div>
		</div>
	);
}
