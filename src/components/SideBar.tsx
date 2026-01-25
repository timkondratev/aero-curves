import { useEffect, useMemo, useState, type ChangeEvent, type KeyboardEvent, type MouseEvent as ReactMouseEvent } from "react";
import type { PlotState, PointId } from "../state/reducer";
import { clampValue } from "../utils/geometry";
import { snapValue } from "../utils/snapping";

type Props = {
    plot: PlotState | null;
    onChange: (plot: PlotState) => void;
};

export function SideBar({ plot, onChange }: Props) {
    if (!plot) {
        return <div className="plot-meta">Select a plot to edit.</div>;
    }

    const bg = plot.background;

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

    const onEnter = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.currentTarget.blur();
        }
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

    const handleBackgroundFit = (e: ChangeEvent<HTMLSelectElement>) => {
        const fit = e.target.value as typeof plot.background.fit;
        onChange({ ...plot, background: { ...plot.background, fit } });
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
        const clamped = clampValue(val, [0.1, 10]);
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

    const startNumberDrag = (
        e: ReactMouseEvent<HTMLInputElement>,
        getValue: () => number,
        apply: (val: number) => void,
        baseStep = 1
    ) => {
        if (e.button !== 0) return;
        const startY = e.clientY;
        const startVal = getValue();
        const handleMove = (ev: MouseEvent) => {
            const dy = ev.clientY - startY;
            if (Math.abs(dy) < 2) return; // small jiggles shouldn't change value
            const modifier = ev.shiftKey ? 10 : ev.altKey ? 0.1 : 1;
            const next = startVal - dy * baseStep * modifier;
            apply(next);
        };
        const handleUp = () => {
            window.removeEventListener("mousemove", handleMove);
            window.removeEventListener("mouseup", handleUp);
        };
        // Allow focus for typing even when dragging is available
        e.currentTarget.focus();
        window.addEventListener("mousemove", handleMove);
        window.addEventListener("mouseup", handleUp);
    };

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
            <div className="panel-section">
                <div className="section-title">SELECTION</div>
                <div className="form-row inline-pair">
                    <div className="row-label">Coordinate</div>
                    <label className="mini-label">X</label>
                    <input
                        className="row-control"
                        type="number"
                        value={coordDraft.x}
                        onChange={e => setCoordDraft(d => ({ ...d, x: e.target.value }))}
                        onBlur={() => commitCoord("x")}
                        onKeyDown={onEnter}
                        onMouseDown={e => startNumberDrag(
                            e,
                            () => parseFloat(coordDraft.x) || 0,
                            val => {
                                setCoordDraft(d => ({ ...d, x: String(val) }));
                                commitCoord("x", val);
                            },
                            0.5
                        )}
                        disabled={!center}
                    />
                    <label className="mini-label">Y</label>
                    <input
                        className="row-control"
                        type="number"
                        value={coordDraft.y}
                        onChange={e => setCoordDraft(d => ({ ...d, y: e.target.value }))}
                        onBlur={() => commitCoord("y")}
                        onKeyDown={onEnter}
                        onMouseDown={e => startNumberDrag(
                            e,
                            () => parseFloat(coordDraft.y) || 0,
                            val => {
                                setCoordDraft(d => ({ ...d, y: String(val) }));
                                commitCoord("y", val);
                            },
                            0.5
                        )}
                        disabled={!center}
                    />
                </div>
            </div>

            <div className="panel-section">
                <div className="section-title">GRID</div>
                <div className="form-row inline-pair">
                    <div className="row-label">Step</div>
                    <label className="mini-label">X</label>
                    <input
                        className="row-control"
                        type="number"
                        step="any"
                        min={0.000001}
                        value={stepDraft.x}
                        onChange={e => setStepDraft(d => ({ ...d, x: e.target.value }))}
                        onBlur={() => commitSnapPrecision("x")}
                        onKeyDown={onEnter}
                        onMouseDown={e => startNumberDrag(
                            e,
                            () => parseFloat(stepDraft.x) || 0,
                            val => {
                                const next = Math.max(val, 0.000001);
                                setStepDraft(d => ({ ...d, x: String(next) }));
                                commitSnapPrecision("x", next);
                            },
                            0.05
                        )}
                    />
                    <label className="mini-label">Y</label>
                    <input
                        className="row-control"
                        type="number"
                        step="any"
                        min={0.000001}
                        value={stepDraft.y}
                        onChange={e => setStepDraft(d => ({ ...d, y: e.target.value }))}
                        onBlur={() => commitSnapPrecision("y")}
                        onKeyDown={onEnter}
                        onMouseDown={e => startNumberDrag(
                            e,
                            () => parseFloat(stepDraft.y) || 0,
                            val => {
                                const next = Math.max(val, 0.000001);
                                setStepDraft(d => ({ ...d, y: String(next) }));
                                commitSnapPrecision("y", next);
                            },
                            0.05
                        )}
                    />
                </div>
                <div className="form-row inline-pair">
                    <div className="row-label">Snap</div>
                    <label className="mini-label" htmlFor="snap-x">X</label>
                    <input id="snap-x" type="checkbox" checked={plot.snapX} onChange={handleSnapToggle("x")} />
                    <label className="mini-label" htmlFor="snap-y">Y</label>
                    <input id="snap-y" type="checkbox" checked={plot.snapY} onChange={handleSnapToggle("y")} />
                </div>
                <div className="form-row inline-pair">
                    <div className="row-label">Show grid</div>
                    <label className="mini-label" htmlFor="grid-x">X</label>
                    <input id="grid-x" type="checkbox" checked={plot.showGridX} onChange={handleShowGridToggle("x")} />
                    <label className="mini-label" htmlFor="grid-y">Y</label>
                    <input id="grid-y" type="checkbox" checked={plot.showGridY} onChange={handleShowGridToggle("y")} />
                </div>
            </div>

            <div className="panel-section">
                <div className="section-title">PLOT</div>
                <div className="form-row">
                    <div className="row-label">Name</div>
                    <input
                        className="row-control"
                        value={nameDraft}
                        onChange={e => setNameDraft(e.target.value)}
                        onBlur={commitName}
                        onKeyDown={onEnter}
                    />
                </div>
                <div className="form-row inline-pair">
                    <div className="row-label">Domain X</div>
                    <input
                        className="row-control"
                        type="number"
                        value={domainDraft.x0}
                        onChange={e => setDomainDraft(d => ({ ...d, x0: e.target.value }))}
                        onBlur={() => commitDomain("x", 0)}
                        onKeyDown={onEnter}
                        onMouseDown={e => startNumberDrag(
                            e,
                            () => parseFloat(domainDraft.x0) || 0,
                            val => {
                                setDomainDraft(d => ({ ...d, x0: String(val) }));
                                commitDomain("x", 0, val);
                            }
                        )}
                    />
                    <input
                        className="row-control"
                        type="number"
                        value={domainDraft.x1}
                        onChange={e => setDomainDraft(d => ({ ...d, x1: e.target.value }))}
                        onBlur={() => commitDomain("x", 1)}
                        onKeyDown={onEnter}
                        onMouseDown={e => startNumberDrag(
                            e,
                            () => parseFloat(domainDraft.x1) || 0,
                            val => {
                                setDomainDraft(d => ({ ...d, x1: String(val) }));
                                commitDomain("x", 1, val);
                            }
                        )}
                    />
                </div>
                <div className="form-row inline-pair">
                    <div className="row-label">Domain Y</div>
                    <input
                        className="row-control"
                        type="number"
                        value={domainDraft.y0}
                        onChange={e => setDomainDraft(d => ({ ...d, y0: e.target.value }))}
                        onBlur={() => commitDomain("y", 0)}
                        onKeyDown={onEnter}
                        onMouseDown={e => startNumberDrag(
                            e,
                            () => parseFloat(domainDraft.y0) || 0,
                            val => {
                                setDomainDraft(d => ({ ...d, y0: String(val) }));
                                commitDomain("y", 0, val);
                            }
                        )}
                    />
                    <input
                        className="row-control"
                        type="number"
                        value={domainDraft.y1}
                        onChange={e => setDomainDraft(d => ({ ...d, y1: e.target.value }))}
                        onBlur={() => commitDomain("y", 1)}
                        onKeyDown={onEnter}
                        onMouseDown={e => startNumberDrag(
                            e,
                            () => parseFloat(domainDraft.y1) || 0,
                            val => {
                                setDomainDraft(d => ({ ...d, y1: String(val) }));
                                commitDomain("y", 1, val);
                            }
                        )}
                    />
                </div>
            </div>
            <div className="panel-section">
                <div className="section-title">BACKGROUND IMAGE</div>
                <div className="form-row">
                    <div className="row-label">Image</div>
                    <input
                        className="row-control"
                        type="file"
                        accept="image/*"
                        onChange={handleBackgroundFile}
                    />
                </div>
                <div className="form-row inline-pair">
                    <div className="row-label">Loaded</div>
                    <div className="row-static">{bg.name ?? "None"}</div>
                    <div className="row-static">
                        {bg.naturalWidth && bg.naturalHeight ? `${bg.naturalWidth}x${bg.naturalHeight}` : ""}
                    </div>
                    {bg.src && (
                        <button className="btn" type="button" onClick={clearBackground}>
                            Clear
                        </button>
                    )}
                </div>
                <div className="form-row inline-pair">
                    <div className="row-label">Opacity</div>
                    <input
                        className="row-control"
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={bg.opacity}
                        onChange={handleBackgroundOpacity}
                    />
                    <div className="row-static">{bg.opacity.toFixed(2)}</div>
                </div>
                <div className="form-row inline-pair">
                    <div className="row-label">Fit</div>
                    <select
                        className="row-control"
                        value={bg.fit}
                        onChange={handleBackgroundFit}
                        disabled={!bg.src}
                    >
                        <option value="contain">Contain</option>
                        <option value="cover">Cover</option>
                        <option value="stretch">Stretch</option>
                    </select>
                </div>
                <div className="form-row inline-pair">
                    <div className="row-label">Offset</div>
                    <label className="mini-label">X</label>
                    <input
                        className="row-control"
                        type="number"
                        step="any"
                        value={bg.offsetX}
                        onChange={handleBackgroundOffset("x")}
                        onMouseDown={e => startNumberDrag(
                            e,
                            () => bg.offsetX,
                            val => onChange({ ...plot, background: { ...plot.background, offsetX: val } })
                        )}
                        disabled={!bg.src}
                    />
                    <label className="mini-label">Y</label>
                    <input
                        className="row-control"
                        type="number"
                        step="any"
                        value={bg.offsetY}
                        onChange={handleBackgroundOffset("y")}
                        onMouseDown={e => startNumberDrag(
                            e,
                            () => bg.offsetY,
                            val => onChange({ ...plot, background: { ...plot.background, offsetY: val } })
                        )}
                        disabled={!bg.src}
                    />
                </div>
                <div className="form-row inline-pair">
                    <div className="row-label">Scale</div>
                    <label className="mini-label">X</label>
                    <input
                        className="row-control"
                        type="number"
                        step="any"
                        value={scaleDraft.x}
                        onChange={e => setScaleDraft(d => ({ ...d, x: e.target.value }))}
                        onBlur={() => commitBackgroundScale("x")}
                        onMouseDown={e => startNumberDrag(
                            e,
                            () => parseFloat(scaleDraft.x) || 0,
                            val => {
                                const clamped = clampValue(val, [0.1, 10]);
                                setScaleDraft(d => ({ ...d, x: String(clamped) }));
                                commitBackgroundScale("x", clamped);
                            },
                            0.05
                        )}
                        disabled={!bg.src}
                    />
                    <label className="mini-label">Y</label>
                    <input
                        className="row-control"
                        type="number"
                        step="any"
                        value={scaleDraft.y}
                        onChange={e => setScaleDraft(d => ({ ...d, y: e.target.value }))}
                        onBlur={() => commitBackgroundScale("y")}
                        onMouseDown={e => startNumberDrag(
                            e,
                            () => parseFloat(scaleDraft.y) || 0,
                            val => {
                                const clamped = clampValue(val, [0.1, 10]);
                                setScaleDraft(d => ({ ...d, y: String(clamped) }));
                                commitBackgroundScale("y", clamped);
                            },
                            0.05
                        )}
                        disabled={!bg.src}
                    />
                </div>
            </div>
        </div>
    );
}
