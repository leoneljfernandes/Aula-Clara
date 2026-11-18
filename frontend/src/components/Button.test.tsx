import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import { Button } from "./Button";

it("el botón crece con la interfaz grande sin depender de las preferencias", () => {
  render(<Button>Leer</Button>);
  expect(screen.getByRole("button", { name: "Leer" })).toHaveClass("large-ui:min-h-16");
});
