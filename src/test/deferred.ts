/** A promise resolved by hand: lets a test pause a fake request or storage write mid-flight. */
export interface Deferred<T> {
  promise: Promise<T>;
  resolve(value: T): void;
}

export function deferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

/** Lets pending promise callbacks run (several macrotask turns). */
export async function flushAsync(turns = 5): Promise<void> {
  for (let i = 0; i < turns; i += 1) {
    await new Promise((done) => setImmediate(done));
  }
}
