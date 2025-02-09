import type { Constructor, InjectionOptions } from './types.ts';
import { setInjectionMetadata } from './injector.ts';

/**
 * Decorator to mark a class as injectable.
 *
 * @param {InjectionOptions} options - Options for the injection.
 *
 * @example Makes a class injectable.
 * ```ts
 * @Injectable()
 * class FooService { }
 * ```
 */
export function Injectable<T>(options: InjectionOptions = {}): (Type: Constructor<T>) => void {
  return (Type: Constructor<T>): void =>
    setInjectionMetadata(Type, {
      isSingleton: options.isSingleton !== false,
    });
}

/**
 * Decorator to mark a class as bootstrapped.
 *
 * @example Makes a class bootstrapped.
 * ```ts
 * @Bootstrapped()
 * class AppModule { }
 * ```
 */
export function Bootstrapped<T>(): (_: Constructor<T>) => void {
  return (_: Constructor<T>): void => {};
}
