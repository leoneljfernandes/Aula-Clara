import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { VoiceConsentDialog } from "./VoiceConsentDialog";

it("explica adónde va la voz y deja aceptar o decir «Ahora no»", async () => {
  const user = userEvent.setup();
  const onAccept = vi.fn();
  const onCancel = vi.fn();
  render(<VoiceConsentDialog kind="commands" onAccept={onAccept} onCancel={onCancel} />);
  expect(screen.getByRole("dialog", { name: "Antes de usar el micrófono" })).toBeInTheDocument();
  expect(screen.getByText(/Aula\s+Clara no graba ni guarda el audio/)).toBeInTheDocument();
  expect(screen.queryByText(/Vas a transcribir lo que dicen otras personas/)).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Ahora no" }));
  expect(onCancel).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole("button", { name: "Usar el micrófono" }));
  expect(onAccept).toHaveBeenCalledTimes(1);
});

it("para la transcripción suma el aviso sobre transcribir a otras personas", () => {
  render(<VoiceConsentDialog kind="captions" onAccept={vi.fn()} onCancel={vi.fn()} />);
  expect(screen.getByText(/Pedile permiso al docente y avisá a tus compañeros/)).toBeInTheDocument();
  expect(screen.getByText(/se borra al salir del lector/)).toBeInTheDocument();
});

it("en manos libres avisa que el micrófono abierto puede oír a otras personas, y solo ahí", () => {
  const aviso = /En modo manos libres el micrófono queda abierto: también puede oír a otras personas/;
  const { rerender } = render(
    <VoiceConsentDialog kind="commands" continuous onAccept={vi.fn()} onCancel={vi.fn()} />,
  );
  expect(screen.getByText(aviso)).toBeInTheDocument();
  rerender(<VoiceConsentDialog kind="commands" onAccept={vi.fn()} onCancel={vi.fn()} />);
  expect(screen.queryByText(aviso)).not.toBeInTheDocument();
});
