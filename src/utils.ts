export type AnyFunction = (...parameters: never[]) => unknown

export function isFunction(value: unknown): value is AnyFunction {
  return typeof value === 'function'
}

export function isObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null
}
