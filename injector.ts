import { Reflect } from '@dx/reflect';

import type { Constructor, InjectionMetadata } from './types.ts';

/**
 * Resolved instances.
 */
export const resolved = new Map<Constructor, () => unknown>();

/**
 * Set injection metadata.
 *
 * @param {Constructor} Type - Constructor type
 * @param {InjectionMetadata} metadata - Injection metadata
 */
export function setInjectionMetadata(Type: Constructor, metadata: InjectionMetadata): void {
  Reflect.defineMetadata('di:metadata', metadata, Type);
}

/**
 * Bootstraps the application.
 *
 * @param {Constructor<T>} Type - Constructor type
 * @param {Map<Constructor, Constructor>} [overrides=new Map<Constructor, Constructor>()]
 *
 * @returns {T}
 */
export function bootstrap<T>(Type: Constructor<T>, overrides: Map<Constructor, Constructor> = new Map<Constructor, Constructor>()): T {
  const injector = new Injector(overrides);

  return injector.bootstrap(Type);
}

/**
 * Injector class.
 */
export class Injector {
  #overrides: Map<Constructor, Constructor>;

  /**
   * Constructor
   *
   * @param {Map<Constructor, Constructor>} [overrides=new Map<Constructor, Constructor>()]
   */
  constructor(overrides: Map<Constructor, Constructor> = new Map<Constructor, Constructor>()) {
    this.#overrides = overrides;
  }

  /**
   * Bootstraps the application.
   *
   * @param {Constructor<T>} Type
   *
   * @returns {T}
   */
  bootstrap<T>(Type: Constructor<T>): T {
    if (this.#isInjectable(Type)) {
      this.#resolve([Type]);

      return resolved.get(Type)!() as T;
    }

    const dependencies: Constructor[] = this.#getDependencies(Type);

    this.#resolve(dependencies);

    return new Type(...dependencies.map((Dep: Constructor) => resolved.get(Dep)!()));
  }

  #resolve(types: Constructor[]): void {
    const unresolved = new Map([...this.#discoverDependencies(types)].filter(([Type]) => !resolved.has(Type)));

    while (unresolved.size > 0) {
      const nextResolvable = [...unresolved].find(([, meta]) => meta.dependencies.every((Dep: Constructor) => resolved.has(Dep)));
      if (!nextResolvable) {
        const unresolvable: string = [...unresolved]
          .map(([Type, { dependencies }]) => `${Type.name} (-> ${dependencies.map((Dep: Constructor) => Dep.name).join(',')})`)
          .join(', ');

        throw new Error(`Dependency cycle detected: Failed to resolve ${unresolvable}`);
      }

      const [Next, meta] = nextResolvable;
      const createInstance = () => new Next(...meta.dependencies.map((Dep: Constructor) => resolved.get(Dep)!())) as typeof Next;

      if (meta.isSingleton) {
        const instance: Constructor = createInstance();

        resolved.set(Next, () => instance);
      } else {
        resolved.set(Next, createInstance);
      }

      unresolved.delete(Next);
    }
  }

  #getInjectionMetadata(Type: Constructor): InjectionMetadata {
    const metadata: InjectionMetadata | undefined = Reflect.getOwnMetadata('di:metadata', Type);
    if (!metadata) {
      throw new TypeError(`Type ${Type.name} is not injectable`);
    }

    return metadata;
  }

  #isInjectable(Type: Constructor): boolean {
    return typeof Reflect.getOwnMetadata('di:metadata', Type) === 'object';
  }

  #getDependencies(Type: Constructor): Constructor[] {
    const dependencies: Constructor[] = Reflect.getOwnMetadata('design:paramtypes', Type) || [];

    return dependencies.map((Dep: Constructor) => {
      if (this.#overrides.has(Dep) && this.#overrides.get(Dep) !== Type) {
        return this.#overrides.get(Dep)!;
      }

      return Dep;
    });
  }

  #discoverDependencies(types: Constructor[]): Map<Constructor, InjectionMetadata & { dependencies: Constructor[] }> {
    const discovered = new Map<Constructor, InjectionMetadata & { dependencies: Constructor[] }>();
    const undiscovered = new Set(types);

    while (undiscovered.size > 0) {
      const Next: Constructor = [...undiscovered.keys()][0];
      const dependencies: Constructor[] = this.#getDependencies(Next);
      const metadata: InjectionMetadata = this.#getInjectionMetadata(Next);

      dependencies
        .filter((Dep: Constructor) => !discovered.has(Dep))
        .forEach((Dep: Constructor) => {
          if (!this.#isInjectable(Dep)) {
            throw new TypeError(`Dependency ${Dep.name} of ${Next.name} is not injectable`);
          }

          undiscovered.add(Dep);
        });

      undiscovered.delete(Next);
      discovered.set(Next, { ...metadata, dependencies });
    }

    return discovered;
  }
}
