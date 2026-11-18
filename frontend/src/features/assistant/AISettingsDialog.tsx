import { type ReactNode, useId, useRef, useState } from "react";
import { Link } from "react-router";

import { Button } from "@/components/Button";
import { Dialog } from "@/components/Dialog";

import { listModels, type ModelOption } from "./api";
import { aiCredentials, useAICredentials } from "./credentials";
import { describeApiError } from "./errors";
import { PROVIDERS, providerInfo, type ProviderId } from "./providers";
import { dropSession, sealKey } from "./session";

const FIELD =
  "min-h-[52px] w-full rounded-xl border-2 border-[var(--border)] bg-[var(--bg)] px-4 text-[var(--fg)]";

/** Modelos que muestra el selector: con «solo gratuitos», los marcados como gratis (si el proveedor lo informa). */
function visibleModels(models: readonly ModelOption[], onlyFree: boolean): ModelOption[] {
  const reportsFree = models.some((m) => m.free !== null);
  return reportsFree && onlyFree ? models.filter((m) => m.free === true) : [...models];
}

/** Lista de modelos validada para un proveedor y una key concretos: si cambia cualquiera, deja de valer. */
interface Catalog {
  provider: ProviderId;
  /** La key escrita, o `null` si se listó con la key sellada en la cookie. */
  apiKey: string | null;
  models: ModelOption[];
}

const FALLBACK_NOTICE =
  "Listo. Tu key quedó guardada en este navegador, porque el servidor no admite la cookie protegida o tu navegador no la aceptó. Funciona igual.";

function modelLabel(m: ModelOption): string {
  const tags = [m.free ? "gratis" : null, m.supportsImages ? "lee imágenes" : null].filter(Boolean);
  return tags.length ? `${m.name} (${tags.join(", ")})` : m.name;
}

/**
 * «Configurar IA»: cada persona usa su propia API key. La key se valida contra el proveedor (que devuelve
 * sus modelos) antes de guardarla. Al guardar se intenta sellarla en una cookie `HttpOnly`, que la página
 * no puede leer; si no se puede, queda en este navegador. Con una key ya sellada no hay nada para mostrar:
 * el diálogo deja cambiar el modelo, reemplazar la key o borrarla.
 */
export function AISettingsDialog({ onClose }: { onClose: () => void }): ReactNode {
  const saved = useAICredentials();
  const sealedSaved = saved?.sealed ? saved : null;
  const id = useId();
  const [provider, setProvider] = useState<ProviderId>(saved?.provider ?? "gemini");
  const [apiKey, setApiKey] = useState(saved?.apiKey ?? "");
  const [showKey, setShowKey] = useState(false);
  const [remember, setRemember] = useState(saved?.remember ?? false);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [model, setModel] = useState(saved?.model ?? "");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false); // guardado en el modo de respaldo: queda abierto para explicarlo
  // Cada prueba de key y cada cambio de proveedor o key incrementa este número: una respuesta que
  // llega tarde (de una prueba anterior) se descarta en vez de pisar lo que la persona eligió después.
  const attempt = useRef(0);
  const [onlyFree, setOnlyFree] = useState(true);
  const [status, setStatus] = useState<{ kind: "idle" | "loading" | "ok" | "error"; text: string }>({
    kind: "idle",
    text: "",
  });

  const info = providerInfo(provider) ?? PROVIDERS[0]!;
  const trimmedKey = apiKey.trim();
  // Key sellada del mismo proveedor y sin una nueva escrita: se usa la de la cookie (la página no la tiene).
  const usingSealed = sealedSaved !== null && provider === sealedSaved.provider && trimmedKey === "";
  const catalogKey = usingSealed ? null : trimmedKey;
  // La lista solo vale para el proveedor y la key con los que se pidió.
  const models = catalog?.provider === provider && catalog.apiKey === catalogKey ? catalog.models : null;
  const showFreeFilter = models?.some((m) => m.free !== null) ?? false;
  const visible = models ? visibleModels(models, onlyFree) : [];

  const invalidate = (): void => {
    attempt.current += 1;
    setCatalog(null);
  };

  const changeProvider = (next: ProviderId): void => {
    invalidate();
    setProvider(next);
    setModel(next === saved?.provider ? saved.model : "");
    setApiKey(next === saved?.provider ? (saved.apiKey ?? "") : "");
    setStatus({ kind: "idle", text: "" });
  };

  const loadModels = async (): Promise<void> => {
    if (!trimmedKey && !usingSealed) return;
    const current = ++attempt.current;
    const requested = { provider, apiKey: usingSealed ? null : trimmedKey };
    setStatus({ kind: "loading", text: usingSealed ? "Buscando los modelos…" : "Probando la key…" });
    try {
      const { models: found, keyVerified } = await listModels(
        requested.provider,
        requested.apiKey ?? undefined,
      );
      if (current !== attempt.current) return; // la persona cambió de proveedor o de key mientras tanto
      setCatalog({ ...requested, models: found });
      // Se elige el primero de lo que el selector muestra, para no guardar un modelo oculto por el filtro.
      const shown = visibleModels(found, onlyFree);
      if (!shown.some((m) => m.id === model)) setModel(shown[0]?.id ?? "");
      setStatus(
        found.length
          ? {
              kind: "ok",
              text: keyVerified
                ? `Key válida. ${found.length} modelos disponibles: elegí uno.`
                : `${found.length} modelos disponibles: elegí uno. ${info.label} no permite comprobar la key de antemano; si está mal, lo vas a ver en la primera consulta.`,
            }
          : { kind: "error", text: "El proveedor no tiene modelos de texto disponibles para esta key." },
      );
    } catch (error) {
      if (current !== attempt.current) return;
      setCatalog(null);
      setStatus({ kind: "error", text: describeApiError(error) });
    }
  };

  const save = async (): Promise<void> => {
    if (usingSealed) {
      aiCredentials.save({ ...sealedSaved, model }); // la key ya está sellada: solo cambia el modelo
      onClose();
      return;
    }
    setSaving(true);
    const sealed = (await sealKey(provider, trimmedKey, remember)) === "sealed";
    if (sealed) {
      aiCredentials.save({ provider, model, remember, sealed: true });
      onClose();
      return;
    }
    aiCredentials.save({ provider, model, remember, apiKey: trimmedKey });
    setSaving(false);
    setDone(true);
    setStatus({ kind: "ok", text: FALLBACK_NOTICE });
  };

  const forget = async (): Promise<void> => {
    await dropSession();
    aiCredentials.clear();
    invalidate();
    setApiKey("");
    setModel("");
    setStatus({ kind: "ok", text: "Borramos tu key." });
  };

  // Se guarda un modelo de la lista validada para este proveedor y esta key, y que el selector muestra.
  // Sin volver a listar, solo si no cambió nada de lo guardado (por ejemplo, para tildar «recordar»).
  const unchangedKey =
    saved?.apiKey !== undefined &&
    saved.provider === provider &&
    saved.apiKey === trimmedKey &&
    saved.model === model;
  const unchangedSealed = usingSealed && sealedSaved.model === model;
  const canSave =
    !saving &&
    !done &&
    Boolean(
      model &&
      (trimmedKey || usingSealed) &&
      (visible.some((m) => m.id === model) || unchangedKey || unchangedSealed),
    );

  return (
    <Dialog title="Configurar IA" onClose={onClose} labelId={`${id}-title`}>
      <p className="mb-5 text-lg">
        El asistente usa <strong>tu propia API key</strong>. Todos estos proveedores tienen un uso gratuito y
        ninguno pide tarjeta para empezar.{" "}
        <Link to="/ayuda/ia" target="_blank" className="font-bold underline">
          Guía: cómo conseguir tu key, paso a paso{" "}
          <span className="sr-only">(se abre en una pestaña nueva)</span>
        </Link>
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (canSave) void save();
        }}
        className="space-y-6"
      >
        <fieldset>
          <legend className="mb-2 text-lg font-bold">1. Proveedor</legend>
          <div className="space-y-2">
            {PROVIDERS.map((p) => (
              <label
                key={p.id}
                className={`flex cursor-pointer gap-3 rounded-xl border-2 p-3 ${p.id === provider ? "border-[var(--accent)]" : "border-[var(--border)]"}`}
              >
                <input
                  type="radio"
                  name={`${id}-provider`}
                  value={p.id}
                  checked={p.id === provider}
                  onChange={() => changeProvider(p.id)}
                  className="mt-1 h-5 w-5 shrink-0"
                />
                <span>
                  <span className="block font-bold">{p.label}</span>
                  <span className="block text-base text-[var(--muted)]">{p.note}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <label htmlFor={`${id}-key`} className="mb-2 block text-lg font-bold">
            2. Tu API key de {info.label}
          </label>
          {usingSealed && (
            <p className="mb-2 rounded-xl border-2 border-[var(--accent)] p-3 text-base">
              🔒 Tu key de {info.label} está guardada de forma segura y no se puede ver. Podés cambiar el
              modelo, o pegar una key nueva para reemplazarla.
            </p>
          )}
          <p id={`${id}-key-help`} className="mb-2 text-base text-[var(--muted)]">
            {info.keyHint}
          </p>
          <details className="mb-3 rounded-xl border-2 border-[var(--border)] p-3 text-base">
            <summary className="min-h-10 cursor-pointer font-bold">
              ¿No tenés una? Cómo conseguir tu key de {info.label}, paso a paso
            </summary>
            <p className="mt-2">
              <strong>Necesitás:</strong> {info.needs} <strong>Uso gratuito:</strong> {info.free}
            </p>
            <ol className="mt-2 list-decimal space-y-1 pl-6">
              {info.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            {info.warnings.map((w) => (
              <p key={w} className="mt-2">
                ⚠️ {w}
              </p>
            ))}
            <p className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
              <a href={info.keyUrl} target="_blank" rel="noreferrer noopener" className="font-bold underline">
                Ir a crear la key en {info.label}{" "}
                <span className="sr-only">(se abre en una pestaña nueva)</span>
              </a>
              <Link to={`/ayuda/ia#${info.id}`} target="_blank" className="font-bold underline">
                Ver la guía completa <span className="sr-only">(se abre en una pestaña nueva)</span>
              </Link>
            </p>
          </details>
          <div className="flex gap-2">
            <input
              id={`${id}-key`}
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                invalidate();
              }}
              autoComplete="off"
              spellCheck={false}
              placeholder={usingSealed ? "Solo si querés reemplazarla" : ""}
              aria-describedby={`${id}-key-help`}
              className={`${FIELD} min-w-0 flex-1 font-mono`}
            />
            <Button onClick={() => setShowKey((v) => !v)} aria-pressed={showKey}>
              {showKey ? "Ocultar" : "Mostrar"}
            </Button>
          </div>
          <Button
            variant="primary"
            className="mt-3 w-full"
            onClick={() => void loadModels()}
            disabled={(!trimmedKey && !usingSealed) || status.kind === "loading" || done}
          >
            {usingSealed ? "Ver los modelos de mi key guardada" : "Probar key y ver modelos"}
          </Button>
          <p role="status" className={`mt-2 min-h-7 text-base ${status.kind === "error" ? "font-bold" : ""}`}>
            {status.text}
          </p>
        </div>

        {models && models.length > 0 && (
          <div>
            <label htmlFor={`${id}-model`} className="mb-2 block text-lg font-bold">
              3. Modelo
            </label>
            {showFreeFilter && (
              <label className="mb-2 flex items-center gap-2 text-base">
                <input
                  type="checkbox"
                  checked={onlyFree}
                  onChange={(e) => setOnlyFree(e.target.checked)}
                  className="h-5 w-5"
                />
                Mostrar solo modelos gratuitos
              </label>
            )}
            <select
              id={`${id}-model`}
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className={FIELD}
            >
              {!visible.some((m) => m.id === model) && <option value="">Elegí un modelo</option>}
              {visible.map((m) => (
                <option key={m.id} value={m.id}>
                  {modelLabel(m)}
                </option>
              ))}
            </select>
            <p className="mt-2 text-base text-[var(--muted)]">
              Para «Interpretar con IA» elegí un modelo que lea imágenes.
            </p>
          </div>
        )}

        <div>
          <label className="flex items-start gap-3 text-base">
            <input
              type="checkbox"
              checked={usingSealed ? sealedSaved.remember : remember}
              onChange={(e) => setRemember(e.target.checked)}
              disabled={usingSealed}
              className="mt-1 h-5 w-5 shrink-0"
            />
            <span>
              <strong>Recordar en este dispositivo.</strong> Si no lo marcás, se olvida al cerrar la pestaña o
              el navegador. No lo marques en una computadora compartida.
              {usingSealed && " Para cambiar esto, pegá la key de nuevo."}
            </span>
          </label>
        </div>

        <p className="rounded-xl border-2 border-[var(--border)] p-3 text-base">
          <strong>Consejo:</strong> usá una key solo para Aula Clara y sin tarjeta ni saldo asociados, así que
          si se perdiera, lo máximo que podrían gastar es tu cuota gratuita.{" "}
          <Link to="/ayuda/ia#cuida-tu-key" target="_blank" className="font-bold underline">
            Cómo cuidar tu key <span className="sr-only">(se abre en una pestaña nueva)</span>
          </Link>
        </p>

        <p className="rounded-xl border-2 border-[var(--border)] p-3 text-base">
          <strong>Privacidad:</strong> tu key viaja a nuestro servidor solo para hacer cada consulta al
          proveedor; no la guardamos ni la registramos. Si el servidor lo permite, queda en una cookie
          protegida que ni esta página puede leer (así un ataque a la página no puede robarla); si no, se
          guarda en este navegador. El proveedor puede usar lo que le mandes según sus propias condiciones.
        </p>

        <div className="flex flex-wrap gap-3">
          {!done && (
            <Button type="submit" variant="primary" disabled={!canSave}>
              {saving ? "Guardando…" : "Guardar"}
            </Button>
          )}
          {saved && !done && <Button onClick={() => void forget()}>Borrar mi key</Button>}
          <Button onClick={onClose}>{done ? "Listo" : "Cancelar"}</Button>
        </div>
      </form>
    </Dialog>
  );
}
