import { createContext, type ReactNode, use, useRef, useState } from "react";

type Announce = (message: string) => void;

const AnnouncerContext = createContext<Announce | null>(null);

/** El último anuncio; `id` crece con cada uno, aunque el texto se repita. */
export interface LastAnnouncement {
  message: string;
  id: number;
}
const LastAnnouncementContext = createContext<LastAnnouncement | null>(null);

/** Región aria-live global: `announce("Tema Sepia")` se lee en voz alta sin mover el foco. */
export function AnnouncerProvider({ children }: { children: ReactNode }): ReactNode {
  const [message, setMessage] = useState("");
  const [last, setLast] = useState<LastAnnouncement | null>(null);
  const counter = useRef(0);

  const announce: Announce = (next) => {
    setMessage(""); // vaciar primero: el mismo texto dos veces seguidas igual se anuncia
    setTimeout(() => {
      setMessage(next);
      counter.current += 1;
      setLast({ message: next, id: counter.current });
    }, 40);
  };

  return (
    <AnnouncerContext value={announce}>
      <LastAnnouncementContext value={last}>
        <div className="sr-only" role="status" aria-live="polite">
          {message}
        </div>
        {children}
      </LastAnnouncementContext>
    </AnnouncerContext>
  );
}

export function useAnnounce(): Announce {
  const announce = use(AnnouncerContext);
  if (!announce) throw new Error("useAnnounce must be used inside <AnnouncerProvider>");
  return announce;
}

/** El último anuncio hecho con `announce`, o `null` si todavía no hubo ninguno. */
export function useLastAnnouncement(): LastAnnouncement | null {
  return use(LastAnnouncementContext);
}
