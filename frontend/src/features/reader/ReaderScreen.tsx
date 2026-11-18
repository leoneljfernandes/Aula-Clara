import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";

import { Button } from "@/components/Button";
import { ProgressBar } from "@/components/ProgressBar";
import { VoiceConsentDialog } from "@/components/VoiceConsentDialog";
import { AssistantPanel, quickActionLabel, useChat } from "@/features/assistant";
import { type Article, libraryApi, type LibraryDocument } from "@/features/library";
import {
  clamp,
  MAX_FS,
  MIN_FS,
  RATES,
  readingStyle,
  THEME_ORDER,
  THEMES,
  usePreferences,
} from "@/features/preferences";
import { useAnnounce } from "@/lib/announcer";
import { speechBus } from "@/lib/speech";
import { useReadAloud } from "@/lib/useReadAloud";
import type { VoiceCommand } from "@/lib/voice/commands";

import { findBlock } from "./blockNav";
import { DocumentView } from "./DocumentView";
import { prefersReducedMotion, useReaderHotkeys, useReadingProgress, useTextSelection } from "./hooks";
import { useReaderNavigation } from "./useReaderNavigation";
import { ToolsPanel } from "./ToolsPanel";
import { useVoiceCommands } from "./useVoiceCommands";
import { VoiceCommandBar } from "./VoiceCommandBar";

export function ReaderScreen({ doc, article }: { doc: LibraryDocument; article: Article }): ReactNode {
  const { settings, updateSettings } = usePreferences();
  const announce = useAnnounce();
  const mainRef = useRef<HTMLElement>(null);
  const articleRef = useRef<HTMLElement>(null);
  const chatInput = useRef<HTMLInputElement>(null);
  const [toolsOpen, setToolsOpen] = useToggle();

  // Bloques que se leen en voz alta (todo menos las figuras) y su posición en el artículo.
  // useMemo por identidad (no por optimización): el motor de voz se reinicia si esta lista cambia.
  const readable = useMemo(
    () => article.blocks.flatMap((b, i) => (b.type === "figure" ? [] : [{ index: i, text: b.text }])),
    [article],
  );
  const texts = useMemo(() => readable.map((r) => r.text), [readable]);
  const audio = useReadAloud(texts, settings.rate, () => announce("Lectura finalizada"));
  const activeBlock = audio.idx >= 0 ? (readable[audio.idx]?.index ?? -1) : -1;

  const chat = useChat(texts.join("\n\n"));
  const { text: selection, pos, hidePopover } = useTextSelection(articleRef, mainRef);
  const progress = useReadingProgress(articleRef, mainRef, doc.progress, (p) =>
    libraryApi.saveProgress(doc.id, p),
  );

  const nav = useReaderNavigation({
    blocks: article.blocks,
    audio,
    voiceGuide: settings.voiceGuide,
    activeBlock,
    announce,
  });

  const runVoiceCommand = (command: VoiceCommand): void => {
    switch (command.kind) {
      case "play":
        return audio.play();
      case "pause":
        return audio.pause();
      case "stop":
        return audio.stop();
      case "nextBlock":
        return nav.move("any", 1);
      case "prevBlock":
        return nav.move("any", -1);
      case "nextHeading":
        return nav.move("h2", 1);
      case "nextFigure":
        return nav.move("figure", 1);
      case "faster":
      case "slower": {
        const at = RATES.findIndex((r) => r === settings.rate);
        const next =
          RATES[Math.min(RATES.length - 1, Math.max(0, at + (command.kind === "faster" ? 1 : -1)))];
        if (next === undefined) return;
        updateSettings({ rate: next });
        announce(`Velocidad x${String(next).replace(".", ",")}`);
        return;
      }
      case "summarize":
        return void chat.send(quickActionLabel("summarize"), "summarize");
      case "keyConcepts":
        return void chat.send(quickActionLabel("key_concepts"), "key_concepts");
      case "quiz":
        return void chat.send(quickActionLabel("quiz"), "quiz");
      case "describeFigure": {
        // La figura donde está el cursor o, si está en otro bloque, la que sigue.
        const here = article.blocks[nav.cursor]?.type === "figure" ? nav.cursor : null;
        const index = here ?? findBlock(article.blocks, nav.cursor, "figure", 1);
        if (index === null) return announce("No hay más gráficos");
        document.getElementById(`fig-btn-${index}`)?.click();
        return;
      }
      case "ask":
        return void chat.send(command.question, "free");
      case "openBraille":
        return; // el lector Braille llega con el plan 03
    }
  };
  const voiceOn = settings.voiceCommands !== "off";
  const voice = useVoiceCommands({ mode: settings.voiceCommands, onCommand: runVoiceCommand });
  useReaderHotkeys({
    singleKey: settings.singleKeyShortcuts,
    handlers: {
      playPause: () => (audio.status === "playing" ? audio.pause() : audio.play()),
      stop: audio.stop,
      fontUp: () => updateSettings({ fontSize: clamp(settings.fontSize + 2, MIN_FS, MAX_FS) }),
      fontDown: () => updateSettings({ fontSize: clamp(settings.fontSize - 2, MIN_FS, MAX_FS) }),
      nextTheme: () => {
        const next = THEME_ORDER[(THEME_ORDER.indexOf(settings.theme) + 1) % THEME_ORDER.length] ?? "claro";
        updateSettings({ theme: next });
        announce(`Tema ${THEMES[next].label}`);
      },
      focusAssistant: () => chatInput.current?.focus(),
      summarize: () => void chat.send(quickActionLabel("summarize"), "summarize"),
      keyConcepts: () => void chat.send(quickActionLabel("key_concepts"), "key_concepts"),
      quiz: () => void chat.send(quickActionLabel("quiz"), "quiz"),
      silence: () => speechBus.silence(),
      ...(voiceOn && voice.available ? { toggleMic: voice.toggle } : {}),
      nextBlock: () => nav.move("any", 1),
      prevBlock: () => nav.move("any", -1),
      nextHeading: () => nav.move("h2", 1),
      nextFigure: () => nav.move("figure", 1),
    },
  });

  useEffect(() => {
    if (activeBlock < 0) return;
    document
      .getElementById(`blk-${activeBlock}`)
      ?.scrollIntoView({ block: "center", behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }, [activeBlock]);

  const explainSelection = (): void => {
    hidePopover();
    void chat.send(`Explicame este párrafo con palabras más simples: «${selection}»`, "simplify", {
      selection,
    });
  };

  return (
    <div className="flex flex-col lg:h-screen">
      <title>{`${doc.title} · Aula Clara`}</title>
      <header className="flex flex-wrap items-center gap-3 border-b-2 border-[var(--border)] bg-[var(--panel)] px-4 py-3 lg:px-5">
        <Link
          to="/biblioteca"
          onClick={audio.stop}
          className="inline-flex min-h-12 items-center rounded-xl border-2 border-[var(--border)] bg-[var(--bg)] px-4 font-bold hover:bg-[var(--soft)]"
        >
          ← Mi biblioteca
        </Link>
        <div className="min-w-[180px] flex-1">
          <p className="truncate text-lg leading-tight font-bold">{doc.title}</p>
          <div className="max-w-xs">
            <ProgressBar value={progress} label="Progreso de lectura" />
          </div>
        </div>
        <Button
          className="lg:hidden"
          aria-expanded={toolsOpen}
          aria-controls="herramientas"
          onClick={setToolsOpen}
        >
          ⚙ Herramientas
        </Button>
        <Button className="lg:hidden" onClick={() => document.getElementById("asistente")?.scrollIntoView()}>
          ✦ Asistente
        </Button>
        {voiceOn && voice.available && (
          <Button
            aria-pressed={voice.listening}
            onClick={voice.toggle}
            className="aria-pressed:border-[var(--accent)] aria-pressed:bg-[var(--accent)] aria-pressed:text-[var(--onAccent)]"
          >
            🎙 Micrófono
          </Button>
        )}
        <Link
          to="/perfil"
          onClick={audio.stop}
          className="hidden min-h-12 items-center rounded-xl border-2 border-[var(--border)] bg-[var(--bg)] px-4 font-bold hover:bg-[var(--soft)] lg:inline-flex"
        >
          👤 Perfil
        </Link>
      </header>
      {voiceOn && <VoiceCommandBar {...voice} />}
      {voice.consentOpen && (
        <VoiceConsentDialog kind="commands" onAccept={voice.acceptConsent} onCancel={voice.cancelConsent} />
      )}

      <div className="grid min-h-0 flex-1 lg:grid-cols-[290px_minmax(0,1fr)_390px]">
        <aside
          id="herramientas"
          aria-label="Barra de accesibilidad"
          className={`${toolsOpen ? "block" : "hidden"} border-b-2 border-[var(--border)] bg-[var(--panel)] lg:block lg:overflow-y-auto lg:border-r-2 lg:border-b-0`}
        >
          <ToolsPanel audio={audio} total={readable.length} />
        </aside>

        <main id="contenido" ref={mainRef} className="min-w-0 bg-[var(--bg)] lg:overflow-y-auto">
          <DocumentView
            article={article}
            activeBlock={activeBlock}
            showListenButton={settings.audioFocus && audio.status === "stopped"}
            autoSpeak={settings.voiceGuide}
            rate={settings.rate}
            onListen={audio.play}
            onAskAboutFigure={() => void chat.send("¿Qué muestra el Gráfico 1?", "free")}
            style={readingStyle(settings)}
            articleRef={articleRef}
            titleRef={(el) => el?.focus()}
          />
        </main>

        <aside
          id="asistente"
          aria-label="Panel de asistencia IA"
          className="flex flex-col border-t-2 border-[var(--border)] bg-[var(--panel)] lg:overflow-hidden lg:border-t-0 lg:border-l-2"
        >
          <AssistantPanel
            chat={chat}
            inputRef={chatInput}
            selection={selection}
            rate={settings.rate}
            autoSpeak={settings.voiceGuide}
            dictation={voiceOn}
          />
        </aside>
      </div>

      {pos && selection && (
        <div className="fixed z-40" style={{ top: pos.top, left: pos.left }}>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={explainSelection}
            className="inline-flex min-h-12 items-center gap-2 rounded-xl border-2 border-[var(--onAccent)] bg-[var(--accent)] px-4 font-bold text-[var(--onAccent)] shadow-xl"
          >
            <span aria-hidden="true">✦</span> Explicar más simple
          </button>
        </div>
      )}
    </div>
  );
}

function useToggle(): [boolean, () => void] {
  const [open, setOpen] = useState(false);
  return [open, () => setOpen((o) => !o)];
}
