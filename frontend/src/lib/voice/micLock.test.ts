import { expect, it, vi } from "vitest";

import { micLock } from "./micLock";

it("quien lo pide corta al dueño anterior y soltarlo avisa que quedó libre", () => {
  const a = { onPreempted: vi.fn() };
  const b = { onPreempted: vi.fn() };
  const free = vi.fn();
  const off = micLock.onFree(free);

  micLock.acquire(a);
  micLock.acquire(b);
  expect(a.onPreempted).toHaveBeenCalledOnce();
  expect(b.onPreempted).not.toHaveBeenCalled();

  micLock.release(a); // ya no es suyo: no libera nada
  expect(free).not.toHaveBeenCalled();
  micLock.release(b);
  expect(free).toHaveBeenCalledOnce();

  off();
  micLock.acquire(a);
  micLock.release(a);
  expect(free).toHaveBeenCalledOnce();
});
