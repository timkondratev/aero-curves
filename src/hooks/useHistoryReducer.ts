import { useReducer, useRef } from "react";

type HistoryOptions<TState, TAction> = {
	historyLimit?: number;
	replaceStateAction: (state: TState) => TAction;
};

const cloneState = <TState,>(state: TState): TState => {
	if (typeof structuredClone === "function") {
		return structuredClone(state);
	}
	return JSON.parse(JSON.stringify(state)) as TState;
};

export function useHistoryReducer<TState, TAction>(
	reducer: (state: TState, action: TAction) => TState,
	initialArg: TState | undefined,
	initializer: ((arg: TState | undefined) => TState) | undefined,
	options: HistoryOptions<TState, TAction>
) {
	const { historyLimit = 100, replaceStateAction } = options;
	const [state, dispatch] = useReducer(
		reducer,
		initialArg as TState | undefined,
		initializer as (arg: TState | undefined) => TState
	);
	const pastRef = useRef<TState[]>([]);
	const futureRef = useRef<TState[]>([]);
	const historyBaseRef = useRef<TState | null>(null);

	const recordChange = (prev: TState) => {
		const stack = pastRef.current.concat(cloneState(prev));
		const trimmed = stack.length > historyLimit ? stack.slice(stack.length - historyLimit) : stack;
		pastRef.current = trimmed;
		futureRef.current = [];
	};

	const applyChange = (mutate: () => void) => {
		const snapshot = historyBaseRef.current ?? cloneState(state);
		mutate();
		recordChange(snapshot);
		historyBaseRef.current = null;
	};

	const dispatchTransient = (action: TAction) => {
		if (!historyBaseRef.current) historyBaseRef.current = cloneState(state);
		dispatch(action);
	};

	const undo = () => {
		const prev = pastRef.current.pop();
		if (!prev) return;
		futureRef.current = futureRef.current.concat(cloneState(state));
		dispatch(replaceStateAction(prev));
		historyBaseRef.current = null;
	};

	const redo = () => {
		const next = futureRef.current.pop();
		if (!next) return;
		pastRef.current = pastRef.current.concat(cloneState(state));
		dispatch(replaceStateAction(next));
		historyBaseRef.current = null;
	};

	return {
		state,
		dispatch,
		applyChange,
		dispatchTransient,
		undo,
		redo,
	};
}
