import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ReactNode, useState } from "react";
import { expect, it, vi } from "vitest";

import { Stepper } from "./Stepper";

/** Un Stepper controlado, como lo usan el wizard y el lector. */
function Interlineado({ initial, onChange }: { initial: number; onChange: (v: number) => void }): ReactNode {
  const [value, setValue] = useState(initial);
  return (
    <Stepper
      id="lh"
      label="Interlineado"
      value={value}
      min={1.3}
      max={2.4}
      step={0.1}
      onChange={(v) => {
        onChange(v);
        setValue(v);
      }}
    />
  );
}

it("suma y resta de a un paso, redondea y se frena en los extremos", async () => {
  const onChange = vi.fn();
  const { rerender } = render(
    <Stepper id="lh" label="Interlineado" value={1.7} min={1.3} max={2.4} step={0.1} onChange={onChange} />,
  );
  await userEvent.click(screen.getByRole("button", { name: "Subir Interlineado" }));
  expect(onChange).toHaveBeenCalledWith(1.8);
  await userEvent.click(screen.getByRole("button", { name: "Bajar Interlineado" }));
  expect(onChange).toHaveBeenLastCalledWith(1.6);
  rerender(
    <Stepper id="lh" label="Interlineado" value={2.4} min={1.3} max={2.4} step={0.1} onChange={onChange} />,
  );
  expect(screen.getByRole("button", { name: "Subir Interlineado" })).toHaveAttribute("aria-disabled", "true");
  expect(screen.getByRole("button", { name: "Bajar Interlineado" })).toHaveAttribute(
    "aria-disabled",
    "false",
  );
  expect(screen.getByRole("group", { name: "Interlineado" })).toHaveTextContent("2.4");
  rerender(
    <Stepper id="lh" label="Interlineado" value={1.3} min={1.3} max={2.4} step={0.1} onChange={onChange} />,
  );
  expect(screen.getByRole("button", { name: "Bajar Interlineado" })).toHaveAttribute("aria-disabled", "true");
});

// aria-disabled y no disabled: un botón deshabilitado pierde el foco (se va a <body>) y quien navega con
// teclado queda perdido justo al llegar al extremo.
it.each([
  ["Subir Interlineado", 2.3, 2.4],
  ["Bajar Interlineado", 1.4, 1.3],
])("al llegar al extremo, «%s» conserva el foco y ya no hace nada", async (name, initial, extreme) => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<Interlineado initial={initial} onChange={onChange} />);
  const button = screen.getByRole("button", { name });

  await user.click(button);
  expect(onChange).toHaveBeenCalledExactlyOnceWith(extreme);
  expect(button).toHaveAttribute("aria-disabled", "true");
  expect(button).toBeEnabled(); // sigue en el orden de tabulación
  expect(button).toHaveFocus();

  await user.click(button);
  await user.keyboard("{Enter}");
  expect(onChange).toHaveBeenCalledOnce();
  expect(button).toHaveFocus();
});

it("usa format para mostrar el valor", () => {
  render(
    <Stepper
      id="fs"
      label="Tamaño de fuente"
      value={21}
      min={16}
      max={32}
      step={1}
      format={(v) => `${v} px`}
      onChange={() => undefined}
    />,
  );
  expect(screen.getByRole("group", { name: "Tamaño de fuente" })).toHaveTextContent("21 px");
});
