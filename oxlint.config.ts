import { defineConfig } from 'oxlint'

export default defineConfig({
  plugins: ['import', 'typescript', 'promise', 'node', 'unicorn', 'oxc'],
  env: {
    browser: true,
    node: true,
    es2022: true,
  },
  ignorePatterns: ['*.config.*', '*.d.ts', 'example'],
  options: {
    reportUnusedDisableDirectives: 'warn',
    typeAware: true,
    typeCheck: true,
  },
  categories: {
    correctness: 'error',
  },
  rules: {
    curly: 'error',
    'no-unused-vars': 'error',

    // Module boundaries and imports.
    'import/default': 'error',
    'import/no-namespace': ['error', { ignore: ['node:*', 'node:fs/promises', 'vite'] }],
    'import/no-cycle': 'warn',
    'import/no-duplicates': 'error',
    'import/no-self-import': 'error',
    'import/no-webpack-loader-syntax': 'error',
    // Mutable named exports break tree-shaking and confuse module consumers.
    'import/no-mutable-exports': 'error',
    // Empty named import blocks are a code smell and confuse bundlers.
    'import/no-empty-named-blocks': 'error',
    // Project explicitly avoids barrel files (bundle-barrel-imports).
    'oxc/no-barrel-file': 'error',

    // Promise / async correctness. Fire-and-forget work should be written as
    // `void task().catch(...)` so the intent is visible to reviewers and lint.
    'promise/no-callback-in-promise': 'error',
    'promise/no-multiple-resolved': 'error',
    'promise/no-promise-in-callback': 'off',
    'promise/no-return-in-finally': 'error',
    'promise/always-return': 'off',

    // Oxc performance lints.
    'oxc/no-accumulating-spread': 'warn',

    // TypeScript rules that catch runtime bugs without forcing noisy style preferences.
    'typescript/await-thenable': 'error',
    'typescript/no-array-delete': 'error',
    'typescript/no-confusing-void-expression': 'off',
    'typescript/no-deprecated': 'warn',
    'typescript/no-floating-promises': 'error',
    'typescript/no-for-in-array': 'error',
    'typescript/no-implied-eval': 'error',
    'typescript/no-misused-promises': 'error',
    'typescript/no-namespace': 'error',
    'typescript/no-non-null-asserted-optional-chain': 'error',
    'typescript/no-require-imports': 'error',
    'typescript/no-unnecessary-type-assertion': 'off',
    'typescript/no-unsafe-argument': 'off',
    'typescript/no-unsafe-assignment': 'off',
    'typescript/no-unsafe-call': 'off',
    'typescript/no-unsafe-member-access': 'off',
    'typescript/no-unsafe-return': 'off',
    'typescript/no-unsafe-type-assertion': 'off',
    'typescript/prefer-nullish-coalescing': 'off',
    'typescript/prefer-optional-chain': 'off',
    'typescript/restrict-plus-operands': 'warn',
    // `${obj}` silently produces `"[object Object]"`. Caught us once in a
    // log line; the cost of locking it down is zero today.
    'typescript/no-base-to-string': 'error',
    // Spreading a non-iterable / Map / Set into an array or object produces
    // surprising shapes. Rule has no current violations.
    'typescript/no-misused-spread': 'error',
    // Tagged-union exhaustiveness on `'post' | 'page'` discriminators and
    // PortableText block types. 7 sites today are missing default branches;
    // warn lets the backlog drain without blocking.
    'typescript/switch-exhaustiveness-check': 'warn',
    // Discourage blind @ts-ignore; @ts-expect-error is preferred.
    'typescript/ban-ts-comment': 'warn',
    // Clean up unnecessary template-literal wrapping of plain expressions.
    'typescript/no-unnecessary-template-expression': 'warn',

    // Server modules intentionally read the validated env facade instead of raw process.env.
    'node/no-process-env': 'off',

    // Catch `module.exports = ...` slipping into an ESM file.
    'node/no-exports-assign': 'error',

    // Throw hygiene + the silent-await-in-Promise.all() footgun.
    'unicorn/error-message': 'error',
    'unicorn/throw-new-error': 'error',
    'unicorn/no-await-in-promise-methods': 'error',
    // `await foo.bar.baz` parses as `(await foo).bar.baz` only when the
    // expression starts with await — surprising in property-chain reads.
    'unicorn/no-await-expression-member': 'warn',
    // Avoid converting an iterator to an array when the array is immediately
    // consumed by a method that works on iterators (e.g. `.map`, `.filter`).
    'unicorn/no-useless-iterator-to-array': 'warn',

    // P0 — Suspicious (likely bugs, low noise).
    'no-extend-native': 'error',
    'no-unexpected-multiline': 'error',
    'no-unmodified-loop-condition': 'error',
    'no-commented-out-tests': 'warn',
    'no-extraneous-class': 'warn',
    'no-unnecessary-type-arguments': 'warn',
    'no-unnecessary-type-constraint': 'warn',
    'no-unsafe-enum-comparison': 'warn',
    'no-instanceof-builtins': 'warn',

    // P1 — Restriction (feature bans).
    'no-var': 'error',
    'no-sequences': 'error',
    'prefer-node-protocol': 'error',
    'no-param-reassign': 'warn',
    'no-empty-function': 'warn',
    'no-console': 'warn',
    'promise/catch-or-return': 'warn',
    'no-document-cookie': 'error',

    // P2 — Pedantic (strict, incremental).
    'no-throw-literal': 'error',
    'no-case-declarations': 'error',
    'prefer-includes': 'warn',
    'return-await': 'warn',

    // P3 — Perf.
    'prefer-array-flat-map': 'warn',
    'prefer-set-has': 'warn',

    // P4 — Import hygiene.
    'no-absolute-path': 'warn',
  },
})
