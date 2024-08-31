// deno-lint-ignore-file

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
export type Constructor<T = unknown> = new (...args: any[]) => T;
