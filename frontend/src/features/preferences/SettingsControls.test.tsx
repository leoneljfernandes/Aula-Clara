import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { expect, it } from "vitest";

import type { ControlPlacement, ControlSpec } from "./controls";
import { PreferencesProvider, usePreferences } from "./PreferencesProvider";
import { SettingsControls } from "./SettingsControls";

// Controles de prueba: no dependen de lo que tenga hoy el registro real (CONTROLS).
const THEME: ControlSpec = {
  key: "theme",
  kind: "choice",
  label: "Tema del documento",
  group: "colores",
  inReader: true,
  options: [
    { value: "claro", label: "Claro" },
    { value: "sepia", label: "Sepia" },
  ],
};
const AUDIO: ControlSpec = {
  key: "audioFocus",
  kind: "toggle",
  label: "Destacar la lectura en voz alta",
  group: "lectura",
  inReader: false,
};

/** Muestra los ajustes en uso: así se ve que el control los cambió. */
function Probe(): ReactNode {
  const { settings } = usePreferences();
  return <pre data-testid="settings">{JSON.stringify(settings)}</pre>;
}

function renderControls(placement: ControlPlacement, controls: readonly ControlSpec[]): void {
  render(
    <PreferencesProvider>
      <SettingsControls placement={placement} controls={controls} />
      <Probe />
    </PreferencesProvider>,
  );
}

const current = (): unknown => JSON.parse(screen.getByTestId("settings").textContent ?? "null");

it("un control de opciones marca el valor actual y elegir otra opción cambia el ajuste", async () => {
  renderControls("onboarding", [THEME]);
  expect(screen.getByRole("group", { name: "Tema del documento" })).toBeInTheDocument();
  expect(screen.getByRole("radio", { name: "Claro" })).toBeChecked();

  await userEvent.click(screen.getByRole("radio", { name: "Sepia" }));
  expect(screen.getByRole("radio", { name: "Sepia" })).toBeChecked();
  expect(current()).toMatchObject({ theme: "sepia" });
});

it("un interruptor cambia el ajuste booleano", async () => {
  renderControls("onboarding", [AUDIO]);
  const toggle = screen.getByRole("checkbox", { name: "Destacar la lectura en voz alta" });
  expect(toggle).not.toBeChecked();

  await userEvent.click(toggle);
  expect(toggle).toBeChecked();
  expect(current()).toMatchObject({ audioFocus: true });
});

it("en el lector solo aparecen los controles inReader; en el onboarding, todos", () => {
  renderControls("reader", [THEME, AUDIO]);
  expect(screen.getByRole("radio", { name: "Claro" })).toBeInTheDocument();
  expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  // Un grupo sin controles visibles no deja un fieldset vacío.
  expect(screen.queryByRole("group", { name: "Lectura" })).not.toBeInTheDocument();
});

it("en el onboarding aparecen todos los controles, agrupados", () => {
  renderControls("onboarding", [THEME, AUDIO]);
  expect(screen.getByRole("group", { name: "Lectura" })).toContainElement(screen.getByRole("checkbox"));
  expect(screen.getByRole("group", { name: "Colores" })).toContainElement(
    screen.getByRole("radio", { name: "Claro" }),
  );
});
