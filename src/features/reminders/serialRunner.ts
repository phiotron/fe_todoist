export interface SerialRunner {
  run(): Promise<void>;
}

/**
 * Runs an async job one at a time. Calls arriving while it runs collapse into exactly one more run,
 * so the last trigger always sees the latest state. A failing job never blocks later runs.
 */
export function createSerialRunner(job: () => Promise<void>): SerialRunner {
  let running: Promise<void> | null = null;
  let again = false;

  async function loop(): Promise<void> {
    do {
      again = false;
      try {
        await job();
      } catch {
        // The job reports its own errors.
      }
    } while (again);
  }

  return {
    run() {
      if (running) {
        again = true;
        return running;
      }
      running = loop().finally(() => {
        running = null;
      });
      return running;
    },
  };
}
