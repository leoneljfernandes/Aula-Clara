import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { Stepper } from "./Stepper";

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
  expect(screen.getByRole("button", { name: "Subir Interlineado" })).toBeDisabled();
  expect(screen.getByRole("group", { name: "Interlineado" })).toHaveTextContent("2.4");
  rerender(
    <Stepper id="lh" label="Interlineado" value={1.3} min={1.3} max={2.4} step={0.1} onChange={onChange} />,
  );
  expect(screen.getByRole("button", { name: "Bajar Interlineado" })).toBeDisabled();
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
