export const snapValue = (value: number, enabled: boolean, precision: number) => {
	if (!enabled) return value;
	if (!precision || !Number.isFinite(precision)) return value;
	return Math.round(value / precision) * precision;
};
