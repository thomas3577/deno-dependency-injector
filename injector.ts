import { Reflect } from '@dx/reflect';

import type { Constructor } from './types.ts';

export interface InjectionMetadata {
  isSingleton: boolean;
}

export function setInjectionMetadata(Type: Constructor, metadata: InjectionMetadata): void {
  Reflect.defineMetadata('di:metadata', metadata, Type);
}

export function bootstrap<T>(Type: Constructor<T>, overrides: Map<Constructor, Constructor> = new Map<Constructor, Constructor>()): T {
  const injector = new Injector(overrides);

  return injector.bootstrap(Type);
}

export class Injector {
  #resolved = new Map<Constructor, () => unknown>();
  #overrides: Map<Constructor, Constructor>;

  constructor(overrides: Map<Constructor, Constructor> = new Map<Constructor, Constructor>()) {
    this.#overrides = overrides;
  }

  bootstrap<T>(type: Constructor<T>): T {
    if (this.#isInjectable(type)) {
      this.#resolve([type]);

      return this.#resolved.get(type)!() as T;
    } else {
      const dependencies = this.#getDependencies(type);
      this.#resolve(dependencies);

      return new type(...dependencies.map((dep) => this.#resolved.get(dep)!()));
    }
  }

  #resolve(types: Constructor[]): void {
    const unresolved = new Map([...this.#discoverDependencies(types)].filter(([Type]) => !this.#resolved.has(Type)));

    while (unresolved.size > 0) {
      const nextResolvable = [...unresolved].find(([, meta]) => meta.dependencies.every((Dep: Constructor) => this.#resolved.has(Dep)));
      if (!nextResolvable) {
        const unresolvable: string = [...unresolved]
          .map(([Type, { dependencies }]) => `${Type.name} (-> ${dependencies.map((Dep: Constructor) => Dep.name).join(',')})`)
          .join(', ');

        throw new Error(`Dependency cycle detected: Failed to resolve ${unresolvable}`);
      }
      const [Next, meta] = nextResolvable;

      const createInstance = () => new Next(...meta.dependencies.map((Dep: Constructor) => this.#resolved.get(Dep)!())) as typeof Next;
      if (meta.isSingleton) {
        const Instance: Constructor = createInstance();

        this.#resolved.set(Next, () => Instance);
      } else {
        this.#resolved.set(Next, createInstance);
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
      } else {
        return Dep;
      }
    });
  }

  #discoverDependencies(types: Constructor[]): Map<Constructor, InjectionMetadata & { dependencies: Constructor[] }> {
    const discovered = new Map<Constructor, InjectionMetadata & { dependencies: Constructor[] }>();
    const undiscovered = new Set(types);

    while (undiscovered.size > 0) {
      const Next = [...undiscovered.keys()][0];
      const dependencies = this.#getDependencies(Next);
      const metadata = this.#getInjectionMetadata(Next);

      dependencies
        .filter((Dep: Constructor) => !discovered.has(Dep))
        .forEach((Dep: Constructor) => {
          if (!this.#isInjectable(Dep)) {
            throw new TypeError(`Dependency ${Dep.name} of ${Next.name} is not injectable`);
          }

          undiscovered.add(Dep);
        });

      undiscovered.delete(Next);
      discovered.set(Next, {
        ...metadata,
        dependencies,
      });
    }

    return discovered;
  }
}
