import { useEffect, useRef, useState } from "react";

import { ReadAloudEngine, type ReadState, STOPPED } from "@/lib/speech";

export interface ReadAloud extends ReadState {
  play: () => void;
  pause: () => void;
  stop: () => void;
  /** Lee desde el párrafo `i` de la lista de textos leíbles. */
  playFrom: (i: number) => void;
}

/** Lectura en voz alta de una lista de párrafos, con resaltado (idx), pausa y velocidad. */
export function useReadAloud(items: readonly string[], rate: number, onFinished: () => void): ReadAloud {
  const [state, setState] = useState<ReadState>(STOPPED);
  const engine = useRef<ReadAloudEngine | null>(null);
  const rateRef = useRef(rate);
  const finishedRef = useRef(onFinished);

  useEffect(() => {
    rateRef.current = rate;
    finishedRef.current = onFinished;
  });

  useEffect(() => {
    const created = new ReadAloudEngine(
      items,
      () => rateRef.current,
      setState,
      () => finishedRef.current(),
    );
    engine.current = created;
    return () => {
      created.dispose();
      engine.current = null;
    };
  }, [items]);

  useEffect(() => {
    engine.current?.restartIfPlaying();
  }, [rate]);

  return {
    ...state,
    play: () => engine.current?.play(),
    pause: () => engine.current?.pause(),
    stop: () => engine.current?.stop(),
    playFrom: (i) => engine.current?.playFrom(i),
  };
}
