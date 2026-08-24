import { describe, expect, it } from "vitest";
import { createSingleFlight } from "./singleFlight";

describe("createSingleFlight", () => {
  it("réutilise la même promesse pour les appels concurrents", async () => {
    const run = createSingleFlight<number>();
    let executions = 0;
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const task = async () => { executions += 1; await gate; return 42; };
    const first = run(task);
    const second = run(task);
    release();
    await expect(Promise.all([first, second])).resolves.toEqual([42, 42]);
    expect(executions).toBe(1);
  });

  it("autorise une nouvelle passe après la fin de la précédente", async () => {
    const run = createSingleFlight<number>();
    expect(await run(async () => 1)).toBe(1);
    expect(await run(async () => 2)).toBe(2);
  });
});
