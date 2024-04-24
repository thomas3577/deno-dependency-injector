import { Bootstrapped, Injectable, Injector } from '../mod.ts';

// Equivalent to @Injectable({ isSingleton: true })
@Injectable()
// deno-lint-ignore no-unused-vars
class Counter {
  private count = 0;

  public increment(): void {
    this.count++;
  }

  public getCount(): number {
    return this.count;
  }
}

@Bootstrapped()
class Main {
  constructor(public counter: Counter) {}
}

const injector = new Injector();
const main1 = injector.bootstrap(Main);
main1.counter.increment();
console.log(main1.counter.getCount()); // "1"

const main2 = injector.bootstrap(Main);
console.log(main1.counter.getCount(), main2.counter.getCount()); // "1 1"

main2.counter.increment();
console.log(main1.counter.getCount(), main2.counter.getCount()); // "2 2"
