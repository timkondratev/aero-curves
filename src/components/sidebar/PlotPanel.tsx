import type { Dispatch, SetStateAction } from "react";
import type { PlotState } from "../../state/reducer";
import { onEnterBlur, startNumberDrag } from "./numberDrag";

type DomainDraft = { x0: string; x1: string; y0: string; y1: string };

type Props = {
	plot: PlotState;
	nameDraft: string;
	setNameDraft: Dispatch<SetStateAction<string>>;
	domainDraft: DomainDraft;
	setDomainDraft: Dispatch<SetStateAction<DomainDraft>>;
	commitName: () => void;
	commitDomain: (axis: "x" | "y", index: 0 | 1, override?: number) => void;
	onDuplicate?: () => void;
	onRemove?: () => void;
};

export function PlotPanel({ nameDraft, setNameDraft, domainDraft, setDomainDraft, commitName, commitDomain, onDuplicate, onRemove }: Props) {
	return (
		<div className="panel-section">
			<div className="section-title">PLOT</div>
			<div className="form-row">
				<div className="row-label">Name</div>
				<input
					className="row-control"
					value={nameDraft}
					onChange={e => setNameDraft(e.target.value)}
					onBlur={commitName}
					onKeyDown={onEnterBlur}
				/>
			</div>
			{(onDuplicate || onRemove) && (
				<div className="form-row">
					<div className="row-label">Actions</div>
					<div className="row-control" style={{ display: "flex", gap: 8 }}>
						{onDuplicate && (
							<button className="btn" onClick={onDuplicate} style={{ flex: 1 }}>
								Duplicate
							</button>
						)}
						{onRemove && (
							<button className="btn" onClick={onRemove} style={{ flex: 1 }}>
								Remove
							</button>
						)}
					</div>
				</div>
			)}
			<div className="form-row inline-pair">
				<div className="row-label">Domain X</div>
				<input
					className="row-control"
					type="number"
					value={domainDraft.x0}
					onChange={e => setDomainDraft(d => ({ ...d, x0: e.target.value }))}
					onBlur={() => commitDomain("x", 0)}
					onKeyDown={onEnterBlur}
					onMouseDown={e =>
						startNumberDrag(
							e,
							() => parseFloat(domainDraft.x0) || 0,
							val => {
								setDomainDraft(d => ({ ...d, x0: String(val) }));
								commitDomain("x", 0, val);
							}
						)
					}
				/>
				<input
					className="row-control"
					type="number"
					value={domainDraft.x1}
					onChange={e => setDomainDraft(d => ({ ...d, x1: e.target.value }))}
					onBlur={() => commitDomain("x", 1)}
					onKeyDown={onEnterBlur}
					onMouseDown={e =>
						startNumberDrag(
							e,
							() => parseFloat(domainDraft.x1) || 0,
							val => {
								setDomainDraft(d => ({ ...d, x1: String(val) }));
								commitDomain("x", 1, val);
							}
						)
					}
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
					onKeyDown={onEnterBlur}
					onMouseDown={e =>
						startNumberDrag(
							e,
							() => parseFloat(domainDraft.y0) || 0,
							val => {
								setDomainDraft(d => ({ ...d, y0: String(val) }));
								commitDomain("y", 0, val);
							}
						)
					}
				/>
				<input
					className="row-control"
					type="number"
					value={domainDraft.y1}
					onChange={e => setDomainDraft(d => ({ ...d, y1: e.target.value }))}
					onBlur={() => commitDomain("y", 1)}
					onKeyDown={onEnterBlur}
					onMouseDown={e =>
						startNumberDrag(
							e,
							() => parseFloat(domainDraft.y1) || 0,
							val => {
								setDomainDraft(d => ({ ...d, y1: String(val) }));
								commitDomain("y", 1, val);
							}
						)
					}
				/>
			</div>
		</div>
	);
}
