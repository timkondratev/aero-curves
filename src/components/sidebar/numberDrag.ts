import type { KeyboardEvent, MouseEvent as ReactMouseEvent } from "react";

// Blur on Enter to commit value
export const onEnterBlur = (e: KeyboardEvent<HTMLInputElement>) => {
	if (e.key === "Enter") e.currentTarget.blur();
};

// Drag-to-adjust numeric inputs; calls apply with updated value
export const startNumberDrag = (
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
		if (Math.abs(dy) < 2) return;
		const modifier = ev.shiftKey ? 10 : ev.altKey ? 0.1 : 1;
		const next = startVal - dy * baseStep * modifier;
		apply(next);
	};
	const handleUp = () => {
		window.removeEventListener("mousemove", handleMove);
		window.removeEventListener("mouseup", handleUp);
	};
	e.currentTarget.focus();
	window.addEventListener("mousemove", handleMove);
	window.addEventListener("mouseup", handleUp);
};
