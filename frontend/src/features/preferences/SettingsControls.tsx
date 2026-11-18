import { type ReactNode, useId } from "react";

import { CONTROL_GROUPS, CONTROLS, type ControlSpec } from "./controls";
import { usePreferences } from "./PreferencesProvider";
import { sanitizePatch } from "./settings";

function Control({ spec }: { spec: ControlSpec }): ReactNode {
  const { settings, updateSettings } = usePreferences();
  const helpId = useId();
  const help = spec.help && (
    <span id={helpId} className="block text-base font-normal text-[var(--muted)]">
      {spec.help}
    </span>
  );

  if (spec.kind === "toggle") {
    return (
      <label className="flex min-h-12 cursor-pointer items-start gap-3 text-lg font-bold">
        <input
          type="checkbox"
          className="mt-1 h-6 w-6 shrink-0"
          style={{ accentColor: "var(--accent)" }}
          checked={settings[spec.key]}
          aria-describedby={spec.help ? helpId : undefined}
          onChange={(e) => updateSettings(sanitizePatch({ [spec.key]: e.target.checked }).patch)}
        />
        <span>
          {spec.label}
          {help}
        </span>
      </label>
    );
  }
  return (
    <fieldset aria-describedby={spec.help ? helpId : undefined}>
      <legend className="mb-2 text-lg font-bold">{spec.label}</legend>
      {help}
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

/** Dibuja los controles de `CONTROLS`, un `fieldset` por grupo. En el lector, solo los marcados `inReader`. */
export function SettingsControls({ placement }: { placement: "onboarding" | "reader" }): ReactNode {
  const visible = CONTROLS.filter((c) => placement === "onboarding" || c.inReader);
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
