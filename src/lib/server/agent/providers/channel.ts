// Async plumbing shared by provider adapters: a provider pushes events from
// several places at once (its message loop, its hooks), while the caller pulls
// them as a single ordered stream.

/** Push-driven async iterable. One consumer, drained in push order. */
export class EventChannel<T> implements AsyncIterable<T> {
  private queue: T[] = [];
  private resolve: ((r: IteratorResult<T>) => void) | null = null;
  private reject: ((e: unknown) => void) | null = null;
  private failure: unknown = null;
  private ended = false;

  push(item: T) {
    if (this.ended) return;
    const resolve = this.resolve;
    if (resolve) {
      this.resolve = this.reject = null;
      resolve({ value: item, done: false });
    } else {
      this.queue.push(item);
    }
  }

  /** Ends the stream. With an error, the consumer sees it after draining what's queued. */
  end(failure?: unknown) {
    if (this.ended) return;
    this.ended = true;
    this.failure = failure ?? null;
    const resolve = this.resolve;
    const reject = this.reject;
    this.resolve = this.reject = null;
    if (!resolve) return;
    if (failure) reject!(failure);
    else resolve({ value: undefined as never, done: true });
  }

  async *[Symbol.asyncIterator]() {
    while (true) {
      if (this.queue.length > 0) {
        yield this.queue.shift()!;
        continue;
      }
      if (this.ended) {
        if (this.failure) throw this.failure;
        return;
      }
      const next = await new Promise<IteratorResult<T>>((resolve, reject) => {
        this.resolve = resolve;
        this.reject = reject;
      });
      if (next.done) return;
      yield next.value;
    }
  }
}

/** Never-ending queue of user turns. Blocks until the next one is pushed. */
export class InputChannel implements AsyncIterable<string> {
  private queue: string[] = [];
  private resolve: ((text: string) => void) | null = null;

  push(text: string) {
    const resolve = this.resolve;
    if (resolve) {
      this.resolve = null;
      resolve(text);
    } else {
      this.queue.push(text);
    }
  }

  async *[Symbol.asyncIterator]() {
    while (true) {
      if (this.queue.length > 0) {
        yield this.queue.shift()!;
        continue;
      }
      yield await new Promise<string>((resolve) => {
        this.resolve = resolve;
      });
    }
  }
}
