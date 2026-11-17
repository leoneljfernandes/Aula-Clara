import { type ReactNode, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";

import { Button } from "@/components/Button";
import { Logo } from "@/components/Logo";
import { useAnnounce } from "@/lib/announcer";

import { clamp, FONTS, MAX_FS, MIN_FS, PROFILES, type Profile, readingStyle } from "./config";
import { safeNext } from "./guards";
import { usePreferences } from "./PreferencesProvider";
import { ThemeButtons } from "./ThemeButtons";

const STEPS = ["Elegí tu perfil", "Ajustá los detalles"] as const;
const FIELD =
  "w-full min-h-[52px] px-3 rounded-xl border-2 border-[var(--border)] bg-[var(--bg)] text-[var(--fg)] text-lg font-bold";

function ProfileStep({
  selected,
  onChoose,
  onNext,
}: {
  selected: Profile["id"] | null;
  onChoose: (p: Profile) => void;
  onNext: () => void;
}): ReactNode {
  return (
    <section aria-labelledby="ob-title">
      <h1 id="ob-title" tabIndex={-1} className="mb-3 text-4xl font-bold" ref={(el) => el?.focus()}>
        Personalizá tu experiencia de lectura
      </h1>
      <p className="mb-8 text-xl text-[var(--muted)]">
        Lo configurás una sola vez. Cada documento que subas se va a abrir con estas preferencias.
      </p>
      <fieldset>
        <legend className="sr-only">Perfil de accesibilidad</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          {PROFILES.map((p) => {
            const active = selected === p.id;
            return (
              <label
                key={p.id}
                className={`relative block cursor-pointer rounded-2xl border-2 p-5 ${active ? "border-[var(--accent)] bg-[var(--soft)]" : "border-[var(--border)] hover:bg-[var(--soft)]"}`}
                style={active ? { boxShadow: "inset 0 0 0 2px var(--accent)" } : undefined}
              >
                <input
                  type="radio"
                  name="perfil"
                  value={p.id}
                  checked={active}
                  onChange={() => onChoose(p)}
                  className="absolute top-5 right-5 h-6 w-6"
                  style={{ accentColor: "var(--accent)" }}
                />
                <span
                  aria-hidden="true"
                  className="mb-4 grid h-14 w-14 place-items-center rounded-xl bg-[var(--accent)] text-2xl font-bold text-[var(--onAccent)]"
                >
                  {p.icon}
                </span>
                <span className="mb-1 block text-2xl font-bold">Perfil {p.title}</span>
                <span className="mb-3 block text-lg text-[var(--muted)]">{p.desc}</span>
                <span className="flex flex-wrap gap-2">
                  {p.tags.map((t) => (
                    <span
                      key={t}
                      className="rounded-full border-2 border-[var(--border)] px-3 py-1 text-sm font-bold"
                    >
                      {t}
                    </span>
                  ))}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <div className="mt-8 flex justify-end">
        <Button variant="primary" className="min-h-14 px-8 text-lg" disabled={!selected} onClick={onNext}>
          Siguiente →
        </Button>
      </div>
    </section>
  );
}

function DetailsStep({ onBack, onFinish }: { onBack: () => void; onFinish: () => void }): ReactNode {
  const { settings, updateSettings } = usePreferences();
  return (
    <section aria-labelledby="ob2-title">
      <h1 id="ob2-title" tabIndex={-1} className="mb-3 text-4xl font-bold" ref={(el) => el?.focus()}>
        Ajustá los detalles
      </h1>
      <p className="mb-8 text-xl text-[var(--muted)]">
        Mirá la vista previa y cambiá lo que necesites. Podés modificarlo después desde tu perfil.
      </p>
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-7">
          <div>
            <label htmlFor="fs" className="mb-2 flex justify-between text-lg font-bold">
              <span>Tamaño de fuente</span>
              <span>{settings.fontSize} px</span>
            </label>
            <input
              id="fs"
              type="range"
              min={MIN_FS}
              max={MAX_FS}
              value={settings.fontSize}
              onChange={(e) => updateSettings({ fontSize: clamp(+e.target.value, MIN_FS, MAX_FS) })}
              className="w-full"
              style={{ accentColor: "var(--accent)", height: 32 }}
            />
          </div>
          <div>
            <label htmlFor="lh" className="mb-2 flex justify-between text-lg font-bold">
              <span>Interlineado</span>
              <span>{settings.lineHeight.toFixed(1)}</span>
            </label>
            <input
              id="lh"
              type="range"
              min="1.3"
              max="2.4"
              step="0.1"
              value={settings.lineHeight}
              onChange={(e) => updateSettings({ lineHeight: +e.target.value })}
              className="w-full"
              style={{ accentColor: "var(--accent)", height: 32 }}
            />
          </div>
          <div>
            <label htmlFor="ff" className="mb-2 block text-lg font-bold">
              Tipografía
            </label>
            <select
              id="ff"
              value={settings.font}
              onChange={(e) => updateSettings({ font: e.target.value as keyof typeof FONTS })}
              className={FIELD}
            >
              {Object.entries(FONTS).map(([id, f]) => (
                <option key={id} value={id}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <span className="mb-2 block text-lg font-bold">Colores</span>
            <ThemeButtons compact />
          </div>
          <label className="flex min-h-12 cursor-pointer items-center gap-3 text-lg font-bold">
            <input
              type="checkbox"
              className="h-6 w-6"
              style={{ accentColor: "var(--accent)" }}
              checked={settings.audioFocus}
              onChange={(e) => updateSettings({ audioFocus: e.target.checked })}
            />
            Destacar la lectura en voz alta
          </label>
        </div>
        <div>
          <span className="mb-2 block text-lg font-bold">Vista previa</span>
          <div
            className="rounded-2xl border-2 border-[var(--border)] bg-[var(--bg)] p-6"
            style={readingStyle(settings)}
          >
            <p className="mb-3 font-bold" style={{ fontSize: "1.15em" }}>
              Diseño Universal para el Aprendizaje
            </p>
            <p>
              El DUA propone anticipar la diversidad desde el origen, ofreciendo múltiples formas de
              representación, de acción y de implicación.
            </p>
          </div>
        </div>
      </div>
      <div className="mt-10 flex justify-between gap-3">
        <Button onClick={onBack}>← Atrás</Button>
        <Button variant="primary" className="min-h-14 px-8 text-lg" onClick={onFinish}>
          Guardar y continuar
        </Button>
      </div>
    </section>
  );
}

/** Wizard de 2 pasos: elegir perfil y ajustar detalles con vista previa en vivo. */
export function OnboardingWizard(): ReactNode {
  const { profile, updateSettings, saveProfile } = usePreferences();
  const announce = useAnnounce();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [step, setStep] = useState<1 | 2>(1);
  const [selected, setSelected] = useState<Profile["id"] | null>(profile);
  const choose = (p: Profile): void => {
    setSelected(p.id);
    if (p.preset) {
      updateSettings(p.preset);
      announce(`Perfil ${p.title} aplicado`);
    }
  };
  const finish = (): void => {
    if (!selected) return;
    saveProfile(selected);
    announce("Preferencias guardadas");
    void navigate(safeNext(params.get("next")) ?? "/biblioteca");
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b-2 border-[var(--border)] px-6 py-4">
        <Logo />
        <span className="font-bold text-[var(--muted)]">Paso {step} de 2</span>
      </header>
      <main id="contenido" className="mx-auto w-full max-w-4xl flex-1 px-5 py-10">
        <ol className="mb-8 flex gap-3" aria-label="Progreso de la configuración">
          {STEPS.map((label, i) => (
            <li key={label} className="flex-1" aria-current={step === i + 1 ? "step" : undefined}>
              <div
                className={`h-2 rounded-full ${step >= i + 1 ? "bg-[var(--accent)]" : "border border-[var(--border)] bg-[var(--soft)]"}`}
              />
              <span
                className={`mt-2 block text-base ${step === i + 1 ? "font-bold" : "text-[var(--muted)]"}`}
              >
                {i + 1}. {label}
              </span>
            </li>
          ))}
        </ol>
        {step === 1 ? (
          <ProfileStep selected={selected} onChoose={choose} onNext={() => setStep(2)} />
        ) : (
          <DetailsStep onBack={() => setStep(1)} onFinish={finish} />
        )}
      </main>
    </div>
  );
}
