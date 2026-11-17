import { createContext, type ReactNode, use, useState } from "react";

type Announce = (message: string) => void;

const AnnouncerContext = createContext<Announce | null>(null);

/** Región aria-live global: `announce("Tema Sepia")` se lee en voz alta sin mover el foco. */
export function AnnouncerProvider({ children }: { children: ReactNode }): ReactNode {
  const [message, setMessage] = useState("");

  const announce: Announce = (next) => {
    setMessage(""); // vaciar primero: el mismo texto dos veces seguidas igual se anuncia
    setTimeout(() => setMessage(next), 40);
  };

  return (
    <AnnouncerContext value={announce}>
      <div className="sr-only" role="status" aria-live="polite">
        {message}
      </div>
      {children}
    </AnnouncerContext>
  );
}

export function useAnnounce(): Announce {
  const announce = use(AnnouncerContext);
  if (!announce) throw new Error("useAnnounce must be used inside <AnnouncerProvider>");
  return announce;
}
