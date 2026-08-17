import { describe, expect, test } from 'vitest'

import { isFunction, isObject } from '../utils.js'

describe('isFunction', () => {
  test('accepts functions only', () => {
    expect(isFunction(() => undefined)).toBe(true)
    expect(isFunction({})).toBe(false)
  })
})

describe('isObject', () => {
  test('accepts non-null objects only', () => {
    expect(isObject({})).toBe(true)
    expect(isObject(null)).toBe(false)
    expect(isObject(() => undefined)).toBe(false)
  })
})
