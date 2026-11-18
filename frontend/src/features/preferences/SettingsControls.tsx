import { type ReactNode, useId } from "react";

import { CONTROL_GROUPS, type ControlPlacement, CONTROLS, type ControlSpec, controlsFor } from "./controls";
import { usePreferences } from "./PreferencesProvider";
import { sanitizePatch } from "./settings";

function Control({ spec }: { spec: ControlSpec }): ReactNode {
  const { settings, updateSettings } = usePreferences();
  const helpId = useId();
  // La ayuda va fuera del <label>/<legend> y se enlaza con aria-describedby: dentro del nombre, un
  // lector de pantalla la leería dos veces (como nombre y como descripción).
  const describedBy = spec.help ? helpId : undefined;
  const help = (className: string): ReactNode =>
    spec.help && (
      <span id={helpId} className={`block text-base text-[var(--muted)] ${className}`}>
        {spec.help}
      </span>
    );

  if (spec.kind === "toggle") {
    return (
      <div>
        <label className="flex min-h-12 cursor-pointer items-start gap-3 text-lg font-bold">
          <input
            type="checkbox"
            className="mt-1 h-6 w-6 shrink-0"
            style={{ accentColor: "var(--accent)" }}
            checked={settings[spec.key]}
            aria-describedby={describedBy}
            onChange={(e) => updateSettings(sanitizePatch({ [spec.key]: e.target.checked }).patch)}
          />
          <span>{spec.label}</span>
        </label>
        {/* Alineada con el texto del label: casilla de 24 px + 12 px de separación. */}
        {help("pl-9")}
      </div>
    );
  }
  return (
    <fieldset aria-describedby={describedBy}>
      <legend className="mb-2 text-lg font-bold">{spec.label}</legend>
      {help("mb-2")}
      <div className="flex flex-wrap gap-3">
        {spec.options.map((o) => (
          <label key={o.value} className="flex min-h-12 cursor-pointer items-center gap-2 text-lg font-bold">
            <input
              type="radio"
              name={`ctl-${spec.key}`}
              className="h-6 w-6"
              style={{ accentColor: "var(--accent)" }}
              value={o.value}
              checked={settings[spec.key] === o.value}
              onChange={() => updateSettings(sanitizePatch({ [spec.key]: o.value }).patch)}
            />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * Dibuja los controles de `CONTROLS`, un `fieldset` por grupo. En el lector, solo los marcados `inReader`.
 * `controls` permite pasar otro registro (los tests no dependen de lo que tenga hoy `CONTROLS`).
 */
export function SettingsControls({
  placement,
  controls = CONTROLS,
}: {
  placement: ControlPlacement;
  controls?: readonly ControlSpec[];
}): ReactNode {
  const visible = controlsFor(placement, controls);
  return (
    <>
      {CONTROL_GROUPS.map((g) => {
        const specs = visible.filter((c) => c.group === g.id);
        if (specs.length === 0) return null;
        return (
          <fieldset key={g.id} className="space-y-3">
            <legend className="mb-1 text-base font-bold tracking-wide text-[var(--muted)] uppercase">
              {g.title}
            </legend>
            {specs.map((c) => (
              <Control key={c.key} spec={c} />
            ))}
          </fieldset>
        );
      })}
    </>
  );
}
