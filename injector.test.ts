import { assert, assertEquals, assertNotStrictEquals, assertStrictEquals, assertThrows } from '@std/assert';

import type { Constructor } from './types.ts';
import { bootstrap, Bootstrapped, Injectable, Injector } from './mod.ts';
import { resolved } from './injector.ts';

function assertInstanceOf<T>(value: T, Type: Constructor<T>) {
  assert(value instanceof Type, `${value} is not of type ${Type.name}`);
}

@Injectable()
class TestA {
  whoami() {
    return 'TestA';
  }
}

@Injectable()
class TestB {
  constructor(public a: TestA) {}

  whoami() {
    return `TestB, depending on (${this.a.whoami()})`;
  }
}

@Injectable()
class TestC {
  constructor(public a: TestA, public b: TestB) {}

  whoami() {
    return `TestC, depending on (${this.a.whoami()}) and (${this.b.whoami()})`;
  }
}

@Bootstrapped()
class Main {
  constructor(public c: TestC) {}
}

@Injectable()
class TestAOverride {
  whoami() {
    return 'TestA Override';
  }
}

@Injectable({
  isSingleton: false,
})
class TestAInstancedOverride {
  whoami() {
    return 'TestA Instanced Override';
  }
}

@Injectable()
class TestCOverride {
  constructor(public a: TestA, public c: TestC) {}

  whoami() {
    return `TestC Override, depending on (${this.a.whoami()}) and (${this.c.whoami()})`;
  }
}

@Bootstrapped()
class NonInjectableMain {
  constructor(public s: string) {}
}

@Injectable()
// deno-lint-ignore no-unused-vars
class NonInjectableTest {
  constructor(public n: number) {}
}

@Bootstrapped()
class NonInjectableDependency {
  constructor(public u: NonInjectableTest) {}
}

@Injectable()
class CycleDummy {}

@Injectable()
// deno-lint-ignore no-unused-vars
class CycleA {
  constructor(_: CycleDummy) {}
}

@Injectable()
class CycleB {
  constructor(_: CycleA) {}
}

@Bootstrapped()
class CycleMain {
  constructor(_: CycleB) {}
}

Deno.test('bootstrap(), no overrides', () => {
  resolved.clear();

  const main = bootstrap(Main);

  assertInstanceOf(main.c, TestC);
  assertInstanceOf(main.c.a, TestA);
  assertInstanceOf(main.c.b, TestB);
  assertInstanceOf(main.c.b.a, TestA);
  assertStrictEquals(main.c.a, main.c.b.a);
});

Deno.test('bootstrap(), TestAOverride', () => {
  resolved.clear();

  const overrides = new Map([[TestA, TestAOverride]]);
  const main = bootstrap(Main, overrides);

  assertInstanceOf(main.c, TestC);
  assertInstanceOf(main.c.a, TestAOverride);
  assertInstanceOf(main.c.b, TestB);
  assertInstanceOf(main.c.b.a, TestAOverride);
  assertStrictEquals(main.c.a, main.c.b.a);
});

Deno.test('bootstrap(), TestAInstancedOverride', () => {
  resolved.clear();

  const overrides = new Map([[TestA, TestAInstancedOverride]]);
  const main = bootstrap(Main, overrides);

  assertInstanceOf(main.c, TestC);
  assertInstanceOf(main.c.a, TestAInstancedOverride);
  assertInstanceOf(main.c.b, TestB);
  assertInstanceOf(main.c.b.a, TestAInstancedOverride);
  assertNotStrictEquals(main.c.a, main.c.b.a);
});

Deno.test('bootstrap(), TestCOverride', () => {
  resolved.clear();

  const overrides = new Map([[TestC, TestCOverride]]);
  const main = bootstrap(Main, overrides);

  assertInstanceOf(main.c.a, TestA);
  assertInstanceOf(main.c as unknown, TestCOverride);

  const cO = main.c as unknown as TestCOverride;

  assertInstanceOf(cO.c, TestC);
  assertInstanceOf(cO.c.a, TestA);
  assertInstanceOf(cO.c.b, TestB);
  assertInstanceOf(cO.c.b.a, TestA);
  assertStrictEquals(main.c.a, cO.c.a);
  assertStrictEquals(main.c.a, cO.c.b.a);
});

Deno.test('bootstrap(), TestAOverride and TestCOverride', () => {
  resolved.clear();

  const overrides = new Map<Constructor, Constructor>([[TestA, TestAOverride], [TestC, TestCOverride]]);
  const main = bootstrap(Main, overrides);

  assertInstanceOf(main.c.a, TestAOverride);
  assertInstanceOf(main.c as unknown, TestCOverride);

  const cO = main.c as unknown as TestCOverride;

  assertInstanceOf(cO.c, TestC);
  assertInstanceOf(cO.c.b, TestB);
  assertInstanceOf(cO.c.b.a, TestAOverride);
  assertStrictEquals(main.c.a, cO.c.a);
  assertStrictEquals(main.c.a, cO.c.b.a);
});

Deno.test('bootstrap(), TestAInstancedOverride and TestCOverride', () => {
  resolved.clear();

  const overrides = new Map<Constructor, Constructor>([[TestA, TestAInstancedOverride], [TestC, TestCOverride]]);
  const main = bootstrap(Main, overrides);

  assertInstanceOf(main.c.a, TestAInstancedOverride);
  assertInstanceOf(main.c as unknown, TestCOverride);

  const cO = main.c as unknown as TestCOverride;

  assertInstanceOf(cO.c, TestC);
  assertInstanceOf(cO.c.b, TestB);
  assertInstanceOf(cO.c.b.a, TestAInstancedOverride);
  assertNotStrictEquals(main.c.a, cO.c.a);
  assertNotStrictEquals(main.c.a, cO.c.b.a);
  assertNotStrictEquals(cO.c.a, cO.c.b.a);
});

Deno.test('bootstrap(), non-injectable main', () => {
  resolved.clear();

  assertThrows(() => bootstrap(NonInjectableMain), TypeError, 'Type String is not injectable');
});

Deno.test('bootstrap(), non-injectable dependency', () => {
  resolved.clear();

  assertThrows(() => bootstrap(NonInjectableDependency), TypeError, 'Dependency Number of NonInjectableTest is not injectable');
});

Deno.test('bootstrap(), dependency cycle', () => {
  resolved.clear();

  assertThrows(() => bootstrap(CycleMain, new Map([[CycleDummy, CycleB]])), Error, 'Dependency cycle detected: Failed to resolve CycleB (-> CycleA), CycleA (-> CycleB)');
});

Deno.test('bootstrap(), class under test', () => {
  resolved.clear();

  const instance = bootstrap(TestB, new Map([[TestA, TestAOverride]]));

  assertEquals(instance.whoami(), 'TestB, depending on (TestA Override)');
});

Deno.test('Injector.bootstrap(), sharing dependency instances', () => {
  resolved.clear();

  const injector = new Injector();
  const b = injector.bootstrap(TestB);
  const c = injector.bootstrap(TestC);
  const main = injector.bootstrap(Main);

  assertStrictEquals(b.a, c.a);
  assertStrictEquals(c.b, b);
  assertStrictEquals(main.c, c);
});
