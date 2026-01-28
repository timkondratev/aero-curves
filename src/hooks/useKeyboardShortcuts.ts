import { useEffect } from "react";

type ShortcutHandlers = {
	onDuplicateLeft: () => void;
	onDuplicateRight: () => void;
	onCopy: () => void;
	onPaste: () => void | Promise<void>;
	onUndo: () => void;
	onRedo: () => void;
	onDeleteSelection: () => void;
};

export function useKeyboardShortcuts({
	onDuplicateLeft,
	onDuplicateRight,
	onCopy,
	onPaste,
	onUndo,
	onRedo,
	onDeleteSelection,
}: ShortcutHandlers) {
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			const isFormField = e.target instanceof HTMLElement &&
				(e.target.tagName === "INPUT" || e.target.tagName === "SELECT" || e.target.tagName === "TEXTAREA" || e.target.isContentEditable);
			if (isFormField) return;

			const key = e.key.toLowerCase();
			const isModifier = e.metaKey || e.ctrlKey;

			if (isModifier && key === "d") {
				if (e.shiftKey) {
					e.preventDefault();
					onDuplicateLeft();
					return;
				}

				e.preventDefault();
				onDuplicateRight();
				return;
			}

			if (isModifier && key === "c") {
				e.preventDefault();
				onCopy();
				return;
			}

			if (isModifier && key === "v") {
				e.preventDefault();
				void onPaste();
				return;
			}

			if (isModifier && key === "z") {
				e.preventDefault();
				if (e.shiftKey) {
					onRedo();
				} else {
					onUndo();
				}
				return;
			}

			if (!isModifier && (key === "delete" || key === "backspace")) {
				e.preventDefault();
				onDeleteSelection();
				return;
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [onDuplicateLeft, onDuplicateRight, onCopy, onPaste, onUndo, onRedo, onDeleteSelection]);
}
