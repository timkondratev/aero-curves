import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import type { PlotId, PlotState, PointId } from "../state/reducer";
import { clampValue } from "../utils/geometry";
import { snapValue } from "../utils/snapping";
import { SelectionPanel } from "./sidebar/SelectionPanel";
import { GridPanel } from "./sidebar/GridPanel";
import { PlotPanel } from "./sidebar/PlotPanel";
import { BackgroundPanel } from "./sidebar/BackgroundPanel";
import { DataPanel } from "./sidebar/DataPanel";

type Props = {
    plot: PlotState | null;
    onChange: (plot: PlotState) => void;
    onDuplicate?: (id: PlotId) => void;
    onRemove?: (id: PlotId) => void;
};

export function SideBar({ plot, onChange, onDuplicate, onRemove }: Props) {
    if (!plot) {
        return <div className="plot-meta">Select a plot to edit.</div>;
    }

    const selection = useMemo(() => new Set<PointId>(plot.selection), [plot.selection]);
    const selectedPoints = useMemo(
        () => plot.points.filter(p => selection.has(p.id)),
        [plot.points, selection]
    );
    const center = useMemo(() => {
        if (!selectedPoints.length) return null;
        if (selectedPoints.length === 1) return { x: selectedPoints[0].x, y: selectedPoints[0].y };
        const xs = selectedPoints.map(p => p.x);
        const ys = selectedPoints.map(p => p.y);
        return {
            x: (Math.min(...xs) + Math.max(...xs)) / 2,
            y: (Math.min(...ys) + Math.max(...ys)) / 2,
        };
    }, [selectedPoints]);

    const [nameDraft, setNameDraft] = useState(plot.name);
    const [coordDraft, setCoordDraft] = useState<{ x: string; y: string }>({ x: center ? String(center.x) : "", y: center ? String(center.y) : "" });
    const [domainDraft, setDomainDraft] = useState<{ x0: string; x1: string; y0: string; y1: string }>({
        x0: String(plot.domainX[0]),
        x1: String(plot.domainX[1]),
        y0: String(plot.domainY[0]),
        y1: String(plot.domainY[1]),
    });
    const [stepDraft, setStepDraft] = useState<{ x: string; y: string }>({
        x: String(plot.snapPrecisionX),
        y: String(plot.snapPrecisionY),
    });
    const [scaleDraft, setScaleDraft] = useState<{ x: string; y: string }>({
        x: String(plot.background.scaleX),
        y: String(plot.background.scaleY),
    });

    useEffect(() => {
        setNameDraft(plot.name);
        setDomainDraft({
            x0: String(plot.domainX[0]),
            x1: String(plot.domainX[1]),
            y0: String(plot.domainY[0]),
            y1: String(plot.domainY[1]),
        });
        setStepDraft({ x: String(plot.snapPrecisionX), y: String(plot.snapPrecisionY) });
        setScaleDraft({ x: String(plot.background.scaleX), y: String(plot.background.scaleY) });
    }, [plot]);

    useEffect(() => {
        if (!selectedPoints.length || !center) {
            setCoordDraft({ x: "", y: "" });
            return;
        }
        setCoordDraft({ x: String(center.x), y: String(center.y) });
    }, [center?.x, center?.y, selectedPoints.length]);

    const commitName = () => {
        if (nameDraft === plot.name) return;
        onChange({ ...plot, name: nameDraft });
    };

    const commitDomain = (axis: "x" | "y", index: 0 | 1, override?: number) => {
        const draftVal = axis === "x" ? (index === 0 ? domainDraft.x0 : domainDraft.x1) : index === 0 ? domainDraft.y0 : domainDraft.y1;
        const value = override ?? parseFloat(draftVal);
        if (Number.isNaN(value)) return;
        if (axis === "x") {
            const next: PlotState = { ...plot, domainX: index === 0 ? [value, plot.domainX[1]] : [plot.domainX[0], value] };
            onChange(next);
        } else {
            const next: PlotState = { ...plot, domainY: index === 0 ? [value, plot.domainY[1]] : [plot.domainY[0], value] };
            onChange(next);
        }
    };

    const handleShowGridToggle = (axis: "x" | "y") => (e: ChangeEvent<HTMLInputElement>) => {
        const enabled = e.target.checked;
        const next: PlotState = axis === "x" ? { ...plot, showGridX: enabled } : { ...plot, showGridY: enabled };
        onChange(next);
    };

    const handleSnapToggle = (axis: "x" | "y") => (e: ChangeEvent<HTMLInputElement>) => {
        const enabled = e.target.checked;
        const next: PlotState = axis === "x" ? { ...plot, snapX: enabled } : { ...plot, snapY: enabled };
        onChange(next);
    };

    const commitSnapPrecision = (axis: "x" | "y", override?: number) => {
        const draftVal = axis === "x" ? stepDraft.x : stepDraft.y;
        const value = override ?? parseFloat(draftVal);
        if (Number.isNaN(value) || value <= 0) return;
        const next: PlotState = axis === "x" ? { ...plot, snapPrecisionX: value } : { ...plot, snapPrecisionY: value };
        onChange(next);
    };

    const commitCoord = (axis: "x" | "y", override?: number) => {
        const draftVal = axis === "x" ? coordDraft.x : coordDraft.y;
        const val = override ?? parseFloat(draftVal);
        if (!selectedPoints.length || Number.isNaN(val)) return;
        const snapEnabled = axis === "x" ? plot.snapX : plot.snapY;
        const precision = axis === "x" ? plot.snapPrecisionX : plot.snapPrecisionY;
        const domain = axis === "x" ? plot.domainX : plot.domainY;

        if (selectedPoints.length === 1) {
            const id = selectedPoints[0].id;

            if (axis === "x") {
                const sorted = [...plot.points].sort((a, b) => a.x - b.x);
                const sortedIdx = sorted.findIndex(p => p.id === id);
                const left = sortedIdx > 0 ? sorted[sortedIdx - 1].x : domain[0];
                const right = sortedIdx < sorted.length - 1 ? sorted[sortedIdx + 1].x : domain[1];
                const snapped = snapValue(val, snapEnabled, precision);
                const bounded = clampValue(snapped, [left, right]);
                const nextPoints = plot.points.map(p => (p.id === id ? { ...p, x: bounded } : p));
                onChange({ ...plot, points: nextPoints });
                return;
            }

            const nextPoints = plot.points.map(p => {
                if (p.id !== id) return p;
                const snapped = snapValue(val, snapEnabled, precision);
                return { ...p, y: clampValue(snapped, domain) };
            });
            onChange({ ...plot, points: nextPoints });
            return;
        }

        // For multiple points, shift selection so its center moves to the target value
        const currentCenter = center;
        if (!currentCenter) return;
        const delta = val - (axis === "x" ? currentCenter.x : currentCenter.y);

        if (axis === "x") {
            const sorted = [...plot.points].sort((a, b) => a.x - b.x);
            let firstIdx = -1;
            let lastIdx = -1;
            for (let i = 0; i < sorted.length; i++) {
                if (!selection.has(sorted[i].id)) continue;
                if (firstIdx === -1) firstIdx = i;
                lastIdx = i;
            }
            const leftNeighbor = firstIdx > 0 ? sorted[firstIdx - 1].x : domain[0];
            const rightNeighbor = lastIdx >= 0 && lastIdx < sorted.length - 1 ? sorted[lastIdx + 1].x : domain[1];
            const minX = Math.min(...selectedPoints.map(p => p.x));
            const maxX = Math.max(...selectedPoints.map(p => p.x));
            const minDelta = leftNeighbor - minX;
            const maxDelta = rightNeighbor - maxX;
            const clampedDelta = clampValue(delta, [minDelta, maxDelta]);

            const nextPoints = plot.points.map(p => {
                if (!selection.has(p.id)) return p;
                const shifted = p.x + clampedDelta;
                const snapped = snapValue(shifted, snapEnabled, precision);
                return { ...p, x: clampValue(snapped, domain) };
            });
            onChange({ ...plot, points: nextPoints });
            return;
        }

        const nextPoints = plot.points.map(p => {
            if (!selection.has(p.id)) return p;
            const shifted = p.y + delta;
            const snapped = snapValue(shifted, snapEnabled, precision);
            return { ...p, y: clampValue(snapped, domain) };
        });
        onChange({ ...plot, points: nextPoints });
    };

    const handleBackgroundFile = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            const src = typeof reader.result === "string" ? reader.result : null;
            if (!src) return;
            const img = new Image();
            img.onload = () => {
                onChange({
                    ...plot,
                    background: {
                        ...plot.background,
                        src,
                        name: file.name,
                        naturalWidth: img.naturalWidth,
                        naturalHeight: img.naturalHeight,
                    },
                });
            };
            img.src = src;
        };
        reader.readAsDataURL(file);
    };

    const handleBackgroundOpacity = (e: ChangeEvent<HTMLInputElement>) => {
        const opacity = parseFloat(e.target.value);
        if (Number.isNaN(opacity)) return;
        onChange({ ...plot, background: { ...plot.background, opacity } });
    };

    const handleBackgroundOffset = (axis: "x" | "y") => (e: ChangeEvent<HTMLInputElement>) => {
        const val = parseFloat(e.target.value);
        if (Number.isNaN(val)) return;
        onChange({
            ...plot,
            background: {
                ...plot.background,
                offsetX: axis === "x" ? val : plot.background.offsetX,
                offsetY: axis === "y" ? val : plot.background.offsetY,
            },
        });
    };

    const commitBackgroundScale = (axis: "x" | "y", override?: number) => {
        const raw = axis === "x" ? scaleDraft.x : scaleDraft.y;
        const val = override ?? parseFloat(raw);
        if (Number.isNaN(val)) return;
        const clamped = clampValue(val, [1e-4, 1000]);
        setScaleDraft(d => ({ ...d, [axis]: String(clamped) }));
        onChange({
            ...plot,
            background: {
                ...plot.background,
                scaleX: axis === "x" ? clamped : plot.background.scaleX,
                scaleY: axis === "y" ? clamped : plot.background.scaleY,
            },
        });
    };

    const spanX = plot.domainX[1] - plot.domainX[0];
    const spanY = plot.domainY[1] - plot.domainY[0];
    const offsetStepX = Math.max(spanX / 1000, 1e-6);
    const offsetStepY = Math.max(spanY / 1000, 1e-6);
    const currentScaleX = parseFloat(scaleDraft.x) || plot.background.scaleX || 1;
    const currentScaleY = parseFloat(scaleDraft.y) || plot.background.scaleY || 1;
    const scaleStepX = Math.max(currentScaleX / 1000, 1e-5);
    const scaleStepY = Math.max(currentScaleY / 1000, 1e-5);

    const clearBackground = () => {
        onChange({
            ...plot,
            background: {
                ...plot.background,
                src: null,
                name: null,
                naturalWidth: null,
                naturalHeight: null,
                scaleX: 1,
                scaleY: 1,
            },
        });
    };

    return (
        <div className="sidebar-form">
            <PlotPanel
                plot={plot}
                nameDraft={nameDraft}
                setNameDraft={setNameDraft}
                domainDraft={domainDraft}
                setDomainDraft={setDomainDraft}
                commitName={commitName}
                commitDomain={commitDomain}
                onDuplicate={onDuplicate ? () => onDuplicate(plot.id) : undefined}
                onRemove={onRemove ? () => onRemove(plot.id) : undefined}
            />
            <SelectionPanel
                coordDraft={coordDraft}
                setCoordDraft={setCoordDraft}
                center={center}
                selectedCount={selectedPoints.length}
                commitCoord={commitCoord}
            />
            <GridPanel
                plot={plot}
                stepDraft={stepDraft}
                setStepDraft={setStepDraft}
                commitSnapPrecision={commitSnapPrecision}
                handleSnapToggle={handleSnapToggle}
                handleShowGridToggle={handleShowGridToggle}
            />
            <BackgroundPanel
                plot={plot}
                scaleDraft={scaleDraft}
                setScaleDraft={setScaleDraft}
                onChange={onChange}
                handleBackgroundFile={handleBackgroundFile}
                handleBackgroundOpacity={handleBackgroundOpacity}
                handleBackgroundOffset={handleBackgroundOffset}
                commitBackgroundScale={commitBackgroundScale}
                clearBackground={clearBackground}
                offsetStepX={offsetStepX}
                offsetStepY={offsetStepY}
                scaleStepX={scaleStepX}
                scaleStepY={scaleStepY}
            />
            <DataPanel plot={plot} onChange={onChange} />
        </div>
    );
}
