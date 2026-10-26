import { createSerialRunner } from '../serialRunner';

function gate() {
  let open: () => void = () => {};
  const promise = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { promise, open };
}

describe('createSerialRunner', () => {
  it('runs the job once when nothing else is running', async () => {
    const job = jest.fn(async () => undefined);
    await createSerialRunner(job).run();
    expect(job).toHaveBeenCalledTimes(1);
  });

  it('collapses calls made while running into exactly one more run', async () => {
    const first = gate();
    const job = jest.fn().mockImplementationOnce(() => first.promise).mockResolvedValue(undefined);
    const runner = createSerialRunner(job);

    const running = runner.run();
    void runner.run();
    void runner.run();
    first.open();
    await running;

    expect(job).toHaveBeenCalledTimes(2);
  });

  it('never runs two jobs at the same time', async () => {
    let active = 0;
    let maxActive = 0;
    const runner = createSerialRunner(async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
    });

    await Promise.all([runner.run(), runner.run(), runner.run()]);

    expect(maxActive).toBe(1);
  });

  it('keeps working after a job throws', async () => {
    const job = jest.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValue(undefined);
    const runner = createSerialRunner(job);

    await runner.run();
    await runner.run();

    expect(job).toHaveBeenCalledTimes(2);
  });
});
