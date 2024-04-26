import { setInjectionMetadata } from './injector.ts';
import type { Constructor } from './types.ts';

export interface InjectionOptions {
  isSingleton?: boolean;
}

export function Injectable<T>(options: InjectionOptions = {}): (Type: Constructor<T>) => void {
  return (Type: Constructor<T>): void => {
    setInjectionMetadata(Type, {
      isSingleton: options.isSingleton !== false,
    });
  };
}

export function Bootstrapped<T>(): (_: Constructor<T>) => void {
  return (_: Constructor<T>): void => {};
}
