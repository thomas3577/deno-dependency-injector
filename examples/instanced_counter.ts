import { bootstrap, Bootstrapped, Injectable } from '../mod.ts';

@Injectable({ isSingleton: false })
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
  constructor(public counter1: Counter, public counter2: Counter) {}
}

const main = bootstrap(Main);
main.counter1.increment();
console.log(main.counter1.getCount(), main.counter2.getCount()); // "1 0"
main.counter2.increment();
console.log(main.counter1.getCount(), main.counter2.getCount()); // "1 1"
