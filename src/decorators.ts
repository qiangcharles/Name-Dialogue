export interface DecoratorBoxSettings {
	borderThickness: number
	fillOpacity: number
	cornerRadius: number
}

export interface DecoratorSettings {
	verticalGap: number
	default: DecoratorBoxSettings
	thought: DecoratorBoxSettings
}

export type DecoratorProperty = "verticalGap"
	| `default.${keyof DecoratorBoxSettings}`
	| `thought.${keyof DecoratorBoxSettings}`

export const DEFAULT_DECORATORS: DecoratorSettings = {
	verticalGap: 1.2,
	default: {
		borderThickness: 1.5,
		fillOpacity: 11,
		cornerRadius: 12,
	},
	thought: {
		borderThickness: 1.5,
		fillOpacity: 9,
		cornerRadius: 18,
	},
}

function getRecord(value: unknown): Record<string, unknown> {
	return typeof value === "object" && value !== null
		? value as Record<string, unknown>
		: {}
}

function getBoundedNumber(
	value: unknown,
	fallback: number,
	minimum: number,
	maximum: number,
): number {
	if (typeof value !== "number" || !Number.isFinite(value)) return fallback
	return Math.min(maximum, Math.max(minimum, value))
}

function normalizeDecoratorBox(
	value: unknown,
	defaults: DecoratorBoxSettings,
): DecoratorBoxSettings {
	const style = getRecord(value)
	return {
		borderThickness: getBoundedNumber(style.borderThickness, defaults.borderThickness, 0, 8),
		fillOpacity: getBoundedNumber(style.fillOpacity, defaults.fillOpacity, 0, 100),
		cornerRadius: getBoundedNumber(style.cornerRadius, defaults.cornerRadius, 0, 48),
	}
}

export function normalizeDecorators(value: unknown): DecoratorSettings {
	const decorators = getRecord(value)
	return {
		verticalGap: getBoundedNumber(decorators.verticalGap, DEFAULT_DECORATORS.verticalGap, 0, 4),
		default: normalizeDecoratorBox(
			decorators.default ?? decorators.speech,
			DEFAULT_DECORATORS.default,
		),
		thought: normalizeDecoratorBox(decorators.thought, DEFAULT_DECORATORS.thought),
	}
}

export function getDecoratorProperties(
	verticalGap: number,
	style: DecoratorBoxSettings,
): Record<string, string> {
	return {
		"--decorator-vertical-gap": `${verticalGap}rem`,
		"--decorator-border-thickness": `${style.borderThickness}px`,
		"--decorator-fill-opacity": `${style.fillOpacity}%`,
		"--decorator-box-radius": `${style.cornerRadius}px`,
	}
}
