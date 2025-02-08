/**
 * Injection metadata.
 */
export interface InjectionMetadata {
  isSingleton: boolean;
}

/**
 * Options for the `Injectable` decorator.
 */
export interface InjectionOptions {
  isSingleton?: boolean;
}

/**
 * Constructor type.
 */
// deno-lint-ignore no-explicit-any
export type Constructor<T = unknown> = new (...args: any[]) => T;
