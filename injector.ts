import { Reflect } from '@dx/reflect';
import type { Constructor } from './types.ts';

export interface InjectionMetadata {
  isSingleton: boolean;
}

export function setInjectionMetadata(type: Constructor, metadata: InjectionMetadata): void {
  Reflect.defineMetadata('di:metadata', metadata, type);
}

export function bootstrap<T>(type: Constructor<T>, overrides: Map<Constructor, Constructor> = new Map<Constructor, Constructor>()): T {
  return new Injector(overrides).bootstrap(type);
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
    const unresolved = new Map(
      [...this.#discoverDependencies(types)].filter(([T]) => !this.#resolved.has(T)),
    );

    while (unresolved.size > 0) {
      const nextResolvable = [...unresolved].find(([, meta]) => meta.dependencies.every((dep) => this.#resolved.has(dep)));
      if (!nextResolvable) {
        const unresolvable = [...unresolved]
          .map(([type, { dependencies }]) => `${type.name} (-> ${dependencies.map((D) => D.name).join(',')})`)
          .join(', ');

        throw new Error(`Dependency cycle detected: Failed to resolve ${unresolvable}`);
      }
      const [next, meta] = nextResolvable;

      const createInstance = () => new next(...meta.dependencies.map((dep) => this.#resolved.get(dep)!())) as typeof next;
      if (meta.isSingleton) {
        const instance = createInstance();
        this.#resolved.set(next, () => instance);
      } else {
        this.#resolved.set(next, createInstance);
      }

      unresolved.delete(next);
    }
  }

  #getInjectionMetadata(type: Constructor): InjectionMetadata {
    const metadata: InjectionMetadata | undefined = Reflect.getOwnMetadata('di:metadata', type);
    if (!metadata) {
      throw new TypeError(`Type ${type.name} is not injectable`);
    }

    return metadata;
  }

  #isInjectable(type: Constructor): boolean {
    return typeof Reflect.getOwnMetadata('di:metadata', type) === 'object';
  }

  #getDependencies(Type: Constructor): Constructor[] {
    const dependencies: Constructor[] = Reflect.getOwnMetadata('design:paramtypes', Type) || [];

    return dependencies.map((dep) => {
      if (this.#overrides.has(dep) && this.#overrides.get(dep) !== Type) {
        return this.#overrides.get(dep)!;
      } else {
        return dep;
      }
    });
  }

  #discoverDependencies(types: Constructor[]): Map<Constructor, InjectionMetadata & { dependencies: Constructor[] }> {
    const discovered = new Map<Constructor, InjectionMetadata & { dependencies: Constructor[] }>();
    const undiscovered = new Set(types);

    while (undiscovered.size > 0) {
      const next = [...undiscovered.keys()][0];
      const dependencies = this.#getDependencies(next);
      const metadata = this.#getInjectionMetadata(next);

      dependencies.filter((dep) => !discovered.has(dep)).forEach((dep) => {
        if (!this.#isInjectable(dep)) {
          throw new TypeError(`Dependency ${dep.name} of ${next.name} is not injectable`);
        }

        undiscovered.add(dep);
      });

      undiscovered.delete(next);
      discovered.set(next, {
        ...metadata,
        dependencies,
      });
    }

    return discovered;
  }
}
