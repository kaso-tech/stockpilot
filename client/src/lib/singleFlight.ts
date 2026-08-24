export function createSingleFlight<T>() {
  let active: Promise<T> | null = null;

  return (task: () => Promise<T>) => {
    if (active) return active;
    const next = Promise.resolve().then(task);
    const tracked = next.finally(() => {
      if (active === tracked) active = null;
    });
    active = tracked;
    return tracked;
  };
}
