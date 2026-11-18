import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { BrailleDialog } from "./BrailleDialog";

const article = {
  title: "Fórmulas",
  meta: "x",
  blocks: [{ type: "p" as const, text: "La suma ∑ y el correo a@b" }],
};

function renderDialog(overrides: Partial<Parameters<typeof BrailleDialog>[0]> = {}) {
  const props = { article, figureAlts: {}, onFigureDescribed: vi.fn(), onClose: vi.fn(), ...overrides };
  render(<BrailleDialog {...props} />);
  return props;
}

describe("BrailleDialog", () => {
  it("lista los símbolos que no se pudieron transcribir, sin repetirlos", () => {
    renderDialog();
    expect(screen.getByRole("dialog", { name: "Braille" })).toHaveTextContent(
      "No se transcribieron estos símbolos: ∑, @.",
    );
  });

  it("alterna entre la vista espejo y la plancha, y la plancha se pagina", async () => {
    const user = userEvent.setup();
    const long = {
      ...article,
      blocks: Array.from({ length: 60 }, (_, i) => ({
        type: "p" as const,
        text: `Párrafo ${i} con palabras que ocupan lugar en la hoja`,
      })),
    };
    renderDialog({ article: long });
    const dialog = screen.getByRole("dialog", { name: "Braille" });
    expect(within(dialog).getByRole("radio", { name: "Espejo (tinta y Braille)" })).toBeChecked();
    await user.click(within(dialog).getByRole("radio", { name: "Plancha" }));
    expect(dialog).toHaveTextContent(/Página 1 de \d+/);
    await user.click(within(dialog).getByRole("button", { name: "Siguiente" }));
    expect(dialog).toHaveTextContent(/Página 2 de \d+/);
    await user.click(within(dialog).getByRole("button", { name: "Anterior" }));
    expect(dialog).toHaveTextContent(/Página 1 de \d+/);
  });

  it("un error al describir un gráfico se muestra y corta la serie", async () => {
    const user = userEvent.setup();
    const withFigure = { ...article, blocks: [{ type: "figure" as const, id: "f1" }] };
    const props = renderDialog({ article: withFigure });
    await user.click(screen.getByRole("button", { name: "Describir 1 gráfico con IA" }));
    // Sin imagen en el DOM no hay qué describir: el error se informa y el botón sigue disponible.
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(props.onFigureDescribed).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Describir 1 gráfico con IA" })).toBeInTheDocument();
  });
});
