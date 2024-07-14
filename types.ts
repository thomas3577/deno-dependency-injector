// deno-lint-ignore-file

/**
 * Constructor type.
 */
export type Constructor<T = unknown> = new (...args: any[]) => T;
