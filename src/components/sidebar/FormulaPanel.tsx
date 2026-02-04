import { useState } from "react";
import { Parser } from "expr-eval";
import type { PlotState } from "../../state/reducer";
import { buildMonotoneSpline } from "../../utils/monotone";
import { clampValue } from "../../utils/geometry";

const plotFunctionPrefix = "PLOT_";
const toPlotFunctionName = (name: string) => `${plotFunctionPrefix}${name.replace(/[^a-zA-Z0-9_]/g, "_")}`;

type Props = {
	plot: PlotState;
	plots: PlotState[];
	onChange: (plot: PlotState) => void;
	onChangeTransient?: (plot: PlotState) => void;
};

export function FormulaPanel({ plot, plots, onChange, onChangeTransient }: Props) {
	const [formula, setFormula] = useState(plot.formula ?? "sin(x)");
	const [formulaError, setFormulaError] = useState<string | null>(null);

	const formulaCatalog = [
		{
			section: "Aerodynamics",
			items: [
				{
					label: "Normal Force Coefficient Cn (from Cl, Cd)",
					value: "PLOT_Cl(x) * cos(x * PI / 180) + PLOT_Cd(x) * sin(x * PI / 180)",
				},
				{
					label: "Tangential Force Coefficient Ct (from Cl, Cd)",
					value: "PLOT_Cl(x) * sin(x * PI / 180) - PLOT_Cd(x) * cos(x * PI / 180)",
				},
				{
					label: "Lift Coefficient Cl (from Cn, Ct)",
					value: "PLOT_Cn(x) * cos(x * PI / 180) + PLOT_Ct(x) * sin(x * PI / 180)",
				},
				{
					label: "Drag Coefficient Cd (from Cn, Ct)",
					value: "PLOT_Cn(x) * sin(x * PI / 180) - PLOT_Ct(x) * cos(x * PI / 180)",
				},
			],
		},
	];

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
			setFormulaError(`${message} Use explicit multiplication, e.g. 2*x or x*(...)`);
			return;
		}

		const plotFunctionEntries = new Map<string, { fn: (x: number) => number; plotName: string; valid: boolean }>();
		const nameConflicts: string[] = [];
		plots.forEach(source => {
			const fnName = toPlotFunctionName(source.name);
			if (plotFunctionEntries.has(fnName)) {
				nameConflicts.push(fnName);
				return;
			}
			if (source.points.length < 2) {
				plotFunctionEntries.set(fnName, { fn: () => Number.NaN, plotName: source.name, valid: false });
				return;
			}
			const sorted = [...source.points].sort((a, b) => a.x - b.x);
			const { evaluate } = buildMonotoneSpline(sorted, x => x, y => y);
			plotFunctionEntries.set(fnName, {
				fn: (x: number) => {
					const boundedX = clampValue(x, source.domainX);
					const y = evaluate(boundedX);
					return clampValue(y, source.domainY);
				},
				plotName: source.name,
				valid: true,
			});
		});

		if (nameConflicts.length) {
			setFormulaError(`Multiple plots map to ${nameConflicts[0]}. Rename plots to avoid conflicts.`);
			return;
		}

		const usedPlotFunctions = Array.from(new Set(trimmed.match(/PLOT_[A-Za-z0-9_]+/g) ?? []));
		for (const fnName of usedPlotFunctions) {
			const entry = plotFunctionEntries.get(fnName);
			if (!entry) {
				setFormulaError(`Unknown plot function: ${fnName}.`);
				return;
			}
			if (!entry.valid) {
				setFormulaError(`Plot ${entry.plotName} needs at least 2 points to be used in a formula.`);
				return;
			}
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

		const functionScope: Record<string, (x: number) => number> = {};
		plotFunctionEntries.forEach((entry, name) => {
			functionScope[name] = entry.fn;
		});

		const nextPoints: PlotState["points"] = [];
		let i = 0;
		for (let x = minX; x <= maxX + 1e-9 && nextPoints.length < 2000; x += step) {
			const snapped = parseFloat(x.toFixed(8));
			let y: number;
			try {
				y = expr.evaluate({ x: snapped, ...functionScope });
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
				y = expr.evaluate({ x: snapped, ...functionScope });
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
		onChange({ ...plot, formula: trimmed, points: nextPoints, selection: [], brush: null });
	};

	const commitFormula = (value: string) => {
		if (value === plot.formula) return;
		onChange({ ...plot, formula: value });
	};

	return (
		<div className="panel-section">
			<div className="section-title">FORMULA</div>
			<div className="form-row">
				<div className="row-label">
					<button className="btn" type="button" onClick={handleCalculate}>
						Calculate
					</button>
				</div>
				<div className="row-control" style={{ display: "flex", gap: 8, alignItems: "center", minWidth: 0 }}>
					<select
						style={{ flex: "1 1 0", minWidth: 0 }}
						onChange={e => {
							const next = e.target.value;
							if (!next) return;
							setFormula(next);
							const apply = onChangeTransient ?? onChange;
							apply({ ...plot, formula: next });
							setFormulaError(null);
							e.currentTarget.value = "";
						}}
						defaultValue=""
					>
						<option value="" disabled>
							Select a formula...
						</option>
						{formulaCatalog.map(section => (
							<optgroup key={section.section} label={section.section}>
								{section.items.map(item => (
									<option key={item.label} value={item.value}>
										{item.label}
									</option>
								))}
							</optgroup>
						))}
					</select>
				</div>
			</div>
			<div className="form-row">
				<textarea
					className="row-control"
					value={formula}
					onChange={e => {
						const next = e.target.value;
						setFormula(next);
						const apply = onChangeTransient ?? onChange;
						apply({ ...plot, formula: next });
						setFormulaError(null);
					}}
					onBlur={e => commitFormula(e.target.value)}
					placeholder="e.g. sin(x)"
					rows={2}
					style={{ resize: "vertical" }}
				/>
			</div>
			{formulaError ? (
				<div className="form-row">
					<div className="row-control field-message is-error">{formulaError}</div>
				</div>
			) : null}
			<div className="form-row">
				<details className="row-control">
					<summary>Formula help</summary>
					<div className="field-message" style={{ marginTop: 6 }}>
						<div><strong>Variables:</strong> x</div>
						<div><strong>Plot functions:</strong> PLOT_name(x) (e.g. PLOT_Cl(x))</div>
						<div><strong>Constants:</strong> PI, E</div>
						<div><strong>Operators:</strong> +  -  *  /  ^  ( )</div>
						<div><strong>Functions:</strong> sin, cos, tan, asin, acos, atan, abs, sqrt, ln, log, exp, min, max</div>
						<div><strong>Note:</strong> use explicit multiplication, e.g. 2*x or x*(...)</div>
					</div>
				</details>
			</div>
		</div>
	);
}
