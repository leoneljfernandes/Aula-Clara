import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";

import { Button } from "@/components/Button";
import { ProgressBar } from "@/components/ProgressBar";
import { VoiceConsentDialog } from "@/components/VoiceConsentDialog";
import {
  AssistantPanel,
  definePrompt,
  explainPrompt,
  LiveCaptions,
  quickActionLabel,
  useChat,
} from "@/features/assistant";
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
import { KEYMAP, type ShortcutId } from "@/lib/keymap";
import { speechBus } from "@/lib/speech";
import { useReadAloud } from "@/lib/useReadAloud";
import type { VoiceCommand } from "@/lib/voice/commands";

import { findBlock, readableIndex } from "./blockNav";
import { BrailleDialog } from "./braille/BrailleDialog";
import { DocumentView } from "./DocumentView";
import { ReaderBottomBar } from "./ReaderBottomBar";
import { prefersReducedMotion, useReaderHotkeys, useReadingProgress, useTextSelection } from "./hooks";
import { useReaderNavigation } from "./useReaderNavigation";
import { ToolsPanel } from "./ToolsPanel";
import { useVoiceCommands } from "./useVoiceCommands";
import { VoiceCommandBar } from "./VoiceCommandBar";
import { VoiceHelpDialog } from "./VoiceHelpDialog";

/** Los comandos de voz que manejan la lectura en voz alta. */
const AUDIO_COMMANDS: ReadonlySet<VoiceCommand["kind"]> = new Set([
  "play",
  "pause",
  "stop",
  "faster",
  "slower",
]);

export function ReaderScreen({ doc, article }: { doc: LibraryDocument; article: Article }): ReactNode {
  const { settings, updateSettings } = usePreferences();
  const announce = useAnnounce();
  const mainRef = useRef<HTMLElement>(null);
  const articleRef = useRef<HTMLElement>(null);
  const chatInput = useRef<HTMLInputElement>(null);
  const [toolsOpen, setToolsOpen] = useToggle();
  // Pantalla simplificada: con la interfaz grande las herramientas quedan plegadas a cualquier ancho.
  const simplified = settings.uiScale === "large";
  // Párrafo elegido con un clic o Enter (`clickToSelect`): las acciones están en la barra de abajo.
  const [selectedBlock, setSelectedBlock] = useState<number | null>(null);
  // Descripciones de figuras hechas en esta sesión. Mapa aparte: cambiar `article` reiniciaría el motor de lectura.
  const [brailleOpen, setBrailleOpen] = useState(false);
  const [voiceHelpOpen, setVoiceHelpOpen] = useState(false);
  const [figureAlts, setFigureAlts] = useState<Record<string, string>>({});

  // Bloques que se leen en voz alta (todo menos las figuras) y su posición en el artículo.
  // useMemo por identidad (no por optimización): el motor de voz se reinicia si esta lista cambia.
  const readable = useMemo(
    () => article.blocks.flatMap((b, i) => (b.type === "figure" ? [] : [{ index: i, text: b.text }])),
    [article],
  );
  const texts = useMemo(() => readable.map((r) => r.text), [readable]);
  const audio = useReadAloud(texts, settings.rate, () => announce("Lectura finalizada"));
  const activeBlock = audio.idx >= 0 ? (readable[audio.idx]?.index ?? -1) : -1;

  const chat = useChat(texts.join("\n\n"), settings.aiLanguage);
  const {
    text: selection,
    pos,
    hidePopover,
  } = useTextSelection(
    articleRef,
    mainRef,
    // Con lenguaje claro o Lectura Fácil alcanza con 3 letras: se puede pedir la definición de una palabra.
    settings.aiLanguage === "standard" ? 12 : 3,
  );
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

  // Salir del lector no deja una voz pendiente hablando en otra pantalla.
  useEffect(() => () => speechBus.silence(), []);

  // Leer: desde el bloque del cursor si la lectura está detenida; en pausa se reanuda donde quedó.
  const startReading = (): void => {
    if (audio.status === "stopped") {
      const from = readableIndex(article.blocks, nav.cursor);
      if (from !== null) return audio.playFrom(from);
    }
    audio.play();
  };

  const describeFigure = (figureId: string, text: string): void => {
    setFigureAlts((prev) => ({ ...prev, [figureId]: text }));
    // Si el navegador no deja guardar (modo privado), la descripción igual vale durante esta sesión.
    libraryApi.saveFigureAlt(doc.id, figureId, text).catch(() => undefined);
  };

  // Un único punto de entrada para el Braille (botón, teclado y voz). Con las herramientas apagadas, avisa.
  const openBraille = (): string | void => {
    if (!settings.brailleTools) {
      const notice = "El Braille todavía no está disponible";
      announce(notice);
      return notice;
    }
    setBrailleOpen(true);
  };

  // Explica más simple el párrafo elegido con un clic o, si no hay, el del cursor.
  const simplifyBlock = (): void => {
    const block = article.blocks[selectedBlock ?? nav.cursor];
    if (block === undefined || block.type === "figure") {
      announce("Elegí un párrafo primero (Alt+↓ o J).");
      return;
    }
    void chat.send(explainPrompt(block.text), "simplify", { selection: block.text });
  };

  const runVoiceCommand = (command: VoiceCommand): string | void => {
    // Con un diálogo abierto el documento de atrás no se navega: solo se puede cortar la voz.
    if (
      document.querySelector('[aria-modal="true"]') &&
      command.kind !== "stop" &&
      command.kind !== "pause"
    ) {
      return "Hay un diálogo abierto";
    }
    // Una consulta a la IA con otra en curso se descartaría: se avisa en vez de marcarla como hecha.
    const askAI = (...args: Parameters<typeof chat.send>): string | void => {
      if (chat.typing) return "Esperá a que termine la respuesta";
      void chat.send(...args);
    };
    // Con el audio oculto no hay lectura que manejar: se avisa en vez de empezar una lectura invisible.
    if (settings.hideAudio && AUDIO_COMMANDS.has(command.kind)) return "La lectura en voz alta está oculta";
    switch (command.kind) {
      case "play":
        // Ya leyendo no se reinicia el párrafo.
        if (audio.status !== "playing") startReading();
        return;
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
        return askAI(quickActionLabel("summarize"), "summarize");
      case "keyConcepts":
        return askAI(quickActionLabel("key_concepts"), "key_concepts");
      case "quiz":
        return askAI(quickActionLabel("quiz"), "quiz");
      case "describeFigure": {
        // La figura donde está el cursor o, si está en otro bloque, la que sigue.
        const here = article.blocks[nav.cursor]?.type === "figure" ? nav.cursor : null;
        const index = here ?? findBlock(article.blocks, nav.cursor, "figure", 1);
        if (index === null) {
          announce("No hay más gráficos");
          return "No hay más gráficos";
        }
        document.getElementById(`fig-btn-${index}`)?.click();
        return;
      }
      case "ask":
        return askAI(command.question, "free");
      case "openBraille":
        return openBraille();
      case "showHelp":
        setVoiceHelpOpen(true);
        return;
    }
  };
  const voiceOn = settings.voiceCommands !== "off";
  const voice = useVoiceCommands({ mode: settings.voiceCommands, onCommand: runVoiceCommand });
  const handlers: Partial<Record<ShortcutId, () => void>> = {
    playPause: () => (audio.status === "playing" ? audio.pause() : startReading()),
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
    simplifyBlock,
    openBraille: () => void openBraille(),
    silence: () => speechBus.silence(),
    ...(voiceOn && voice.available ? { toggleMic: voice.toggle } : {}),
    ...(voiceOn ? { voiceHelp: () => setVoiceHelpOpen(true) } : {}),
    nextBlock: () => nav.move("any", 1),
    prevBlock: () => nav.move("any", -1),
    nextHeading: () => nav.move("h2", 1),
    nextFigure: () => nav.move("figure", 1),
  };
  // Con el audio oculto, los atajos de lectura no hacen nada (ni empiezan una lectura que nadie ve).
  if (settings.hideAudio) {
    for (const shortcut of KEYMAP) if (shortcut.requires === "audio") delete handlers[shortcut.id];
  }
  useReaderHotkeys({ singleKey: settings.singleKeyShortcuts, handlers });

  useEffect(() => {
    if (activeBlock < 0) return;
    document
      .getElementById(`blk-${activeBlock}`)
      ?.scrollIntoView({ block: "center", behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }, [activeBlock]);

  const selectBlock = (index: number): void => {
    setSelectedBlock(index);
    nav.setCursor(index);
    announce("Párrafo seleccionado. Las acciones están en la barra de abajo.");
  };
  const selectedBlockData = selectedBlock === null ? undefined : article.blocks[selectedBlock];
  const selectedText = selectedBlockData && selectedBlockData.type !== "figure" ? selectedBlockData.text : "";
  // El texto sobre el que actúan el asistente y la barra: el párrafo elegido o, si no, el texto arrastrado.
  const assistantSelection = selectedText || selection;
  const readFrom = selectedBlock === null ? null : readableIndex(article.blocks, selectedBlock);

  const barVisible = simplified || (settings.clickToSelect && assistantSelection !== "");

  /** Una selección de hasta 3 palabras es un término: se ofrece definirlo en vez de explicar un párrafo. */
  const isTerm = selection.split(/\s+/).filter(Boolean).length <= 3;
  const explainSelection = (): void => {
    hidePopover();
    if (isTerm) void chat.send(definePrompt(selection), "glossary", { selection });
    else void chat.send(explainPrompt(selection), "simplify", { selection });
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
          className={simplified ? "" : "lg:hidden"}
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
            <span aria-hidden="true">🎙</span> Micrófono
          </Button>
        )}
        {settings.brailleTools && (
          <Button onClick={() => void openBraille()}>
            <span aria-hidden="true">⠿</span> Braille
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
      {voiceOn && <VoiceCommandBar {...voice} onHelp={() => setVoiceHelpOpen(true)} />}
      {voice.consentOpen && (
        <VoiceConsentDialog
          kind="commands"
          continuous={settings.voiceCommands === "continuous"}
          onAccept={voice.acceptConsent}
          onCancel={voice.cancelConsent}
        />
      )}

      <div
        className={`grid min-h-0 flex-1 ${simplified ? "lg:grid-cols-[minmax(0,1fr)_420px]" : "lg:grid-cols-[290px_minmax(0,1fr)_390px]"}`}
      >
        <aside
          id="herramientas"
          aria-label="Barra de accesibilidad"
          className={`${toolsOpen ? "block" : "hidden"} border-b-2 border-[var(--border)] bg-[var(--panel)] ${simplified ? "lg:col-span-2" : "lg:block lg:overflow-y-auto lg:border-r-2 lg:border-b-0"}`}
        >
          <ToolsPanel audio={audio} total={readable.length} onPlay={startReading} />
        </aside>

        <main
          id="contenido"
          ref={mainRef}
          className={`min-w-0 bg-[var(--bg)] lg:overflow-y-auto ${barVisible ? "pb-36 scroll-pb-36" : ""}`}
        >
          <DocumentView
            article={article}
            activeBlock={activeBlock}
            showListenButton={settings.audioFocus && !settings.hideAudio && audio.status === "stopped"}
            autoSpeak={settings.voiceGuide}
            canListen={!settings.hideAudio}
            rate={settings.rate}
            onListen={audio.play}
            onAskAboutFigure={() => void chat.send("¿Qué muestra el Gráfico 1?", "free")}
            selectedBlock={selectedBlock}
            {...(settings.clickToSelect ? { onSelectBlock: selectBlock } : {})}
            figureAlts={figureAlts}
            onFigureDescribed={describeFigure}
            style={readingStyle(settings)}
            articleRef={articleRef}
            titleRef={(el) => el?.focus()}
          />
        </main>

        <aside
          id="asistente"
          aria-label="Panel de asistencia IA"
          className={`flex flex-col border-t-2 border-[var(--border)] bg-[var(--panel)] lg:overflow-hidden lg:border-t-0 lg:border-l-2 ${barVisible ? "pb-36" : ""}`}
        >
          {settings.liveCaptions && (
            <LiveCaptions
              style={readingStyle(settings)}
              onExplain={(fragment) =>
                void chat.send("Explicá en lenguaje claro lo que dijo el docente", "simplify", {
                  selection: fragment,
                  language: settings.aiLanguage === "standard" ? "plain" : settings.aiLanguage,
                })
              }
            />
          )}
          <AssistantPanel
            chat={chat}
            inputRef={chatInput}
            selection={assistantSelection}
            rate={settings.rate}
            canListen={!settings.hideAudio}
            autoSpeak={settings.voiceGuide}
            dictation={voiceOn}
            handsFree={settings.voiceCommands === "continuous"}
          />
        </aside>
      </div>

      {voiceHelpOpen && settings.voiceCommands !== "off" && (
        <VoiceHelpDialog mode={settings.voiceCommands} onClose={() => setVoiceHelpOpen(false)} />
      )}

      {brailleOpen && (
        <BrailleDialog
          article={article}
          figureAlts={figureAlts}
          onFigureDescribed={describeFigure}
          onClose={() => setBrailleOpen(false)}
        />
      )}

      <ReaderBottomBar
        block={
          settings.clickToSelect && assistantSelection
            ? {
                text: assistantSelection,
                onExplain: () => {
                  hidePopover();
                  void chat.send(explainPrompt(assistantSelection), "simplify", {
                    selection: assistantSelection,
                  });
                },
                ...(readFrom !== null && selectedText && !settings.hideAudio
                  ? { onReadFrom: () => audio.playFrom(readFrom) }
                  : {}),
                onAsk: () => chatInput.current?.focus(),
                onClear: () => {
                  setSelectedBlock(null);
                  window.getSelection()?.removeAllRanges();
                },
              }
            : null
        }
        nav={
          simplified
            ? {
                onPrev: () => nav.move("any", -1),
                onNext: () => nav.move("any", 1),
                playing: audio.status === "playing",
                ...(settings.hideAudio
                  ? {}
                  : { onPlayPause: () => (audio.status === "playing" ? audio.pause() : startReading()) }),
                ...(voiceOn && voice.available ? { onVoice: voice.toggle } : {}),
                listening: voice.listening,
                onAssistant: () => chatInput.current?.focus(),
              }
            : null
        }
      />

      {!settings.clickToSelect && pos && selection && (
        <div className="fixed z-40" style={{ top: pos.top, left: pos.left }}>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={explainSelection}
            className="inline-flex min-h-12 items-center gap-2 rounded-xl border-2 border-[var(--onAccent)] bg-[var(--accent)] px-4 font-bold text-[var(--onAccent)] shadow-xl"
          >
            {isTerm ? (
              <>
                <span aria-hidden="true">📖</span> Definir término
              </>
            ) : (
              <>
                <span aria-hidden="true">✦</span> Explicar más simple
              </>
            )}
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
