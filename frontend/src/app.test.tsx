import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { routes } from "@/router";

// jsdom no rasteriza SVG: se simula la imagen que saldría del gráfico.
vi.mock("@/lib/extractors", async (original) => ({
  ...(await original<typeof import("@/lib/extractors")>()),
  svgToJpeg: vi.fn().mockResolvedValue(new Blob(["jpeg"], { type: "image/jpeg" })),
}));

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

const withProfile = (id = "custom"): void => {
  window.localStorage.setItem("aulaclara.profile", JSON.stringify(id));
};

const h1 = async () => screen.findByRole("heading", { level: 1 });

describe("onboarding", () => {
  it("sin perfil, la raíz lleva al wizard con el enlace «Saltar al contenido»", async () => {
    const router = renderAt("/");
    expect(await h1()).toHaveTextContent(/Personalizá tu experiencia/);
    expect(router.state.location.pathname).toBe("/perfil");
    expect(screen.getByRole("link", { name: "Saltar al contenido" })).toHaveAttribute("href", "#contenido");
    expect(screen.getByRole("button", { name: /Siguiente/ })).toBeDisabled();
  });

  it("elegir un perfil aplica su preset, se ajusta en el paso 2 y se guarda", async () => {
    const user = userEvent.setup();
    const router = renderAt("/perfil");
    await user.click(await screen.findByRole("radio", { name: /Perfil Dislexia/ }));
    await user.click(screen.getByRole("button", { name: /Siguiente/ }));

    expect(await h1()).toHaveTextContent("Ajustá los detalles");
    expect(screen.getByLabelText("Tipografía")).toHaveValue("dyslexic");
    expect(screen.getByLabelText(/Tamaño de fuente/)).toHaveValue("21");
    expect(screen.getByRole("button", { name: /Sepia/ })).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: "Guardar y continuar" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/biblioteca"));
    expect(JSON.parse(window.localStorage.getItem("aulaclara.profile") ?? "null")).toBe("dislexia");
    expect(JSON.parse(window.localStorage.getItem("aulaclara.settings") ?? "{}")).toMatchObject({
      font: "dyslexic",
      theme: "sepia",
    });
  });

  it("entrar a una ruta protegida sin perfil pasa por el wizard y vuelve a donde iba", async () => {
    const user = userEvent.setup();
    const router = renderAt("/leer/d1");
    await h1();
    expect(router.state.location.pathname).toBe("/perfil");
    expect(router.state.location.search).toBe("?next=%2Fleer%2Fd1");

    await user.click(await screen.findByRole("radio", { name: /Perfil Visión reducida/ }));
    await user.click(screen.getByRole("button", { name: /Siguiente/ }));
    await user.click(await screen.findByRole("button", { name: "Guardar y continuar" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/leer/d1"));
  });

  it("ignora un ?next= que apunta a otro sitio (open redirect)", async () => {
    const user = userEvent.setup();
    const router = renderAt("/perfil?next=//sitio-malo.com");
    await user.click(await screen.findByRole("radio", { name: /Personalizado/ }));
    await user.click(screen.getByRole("button", { name: /Siguiente/ }));
    await user.click(await screen.findByRole("button", { name: "Guardar y continuar" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/biblioteca"));
  });
});

describe("biblioteca", () => {
  beforeEach(() => withProfile());

  it("con perfil, la raíz muestra la biblioteca con los 3 documentos semilla y el aviso de privacidad", async () => {
    const router = renderAt("/");
    expect(await h1()).toHaveTextContent("Hola");
    expect(router.state.location.pathname).toBe("/biblioteca");
    expect(screen.getAllByRole("listitem").filter((li) => li.querySelector("h3"))).toHaveLength(3);
    expect(screen.getByText(/no subas documentos con datos personales/i)).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: /Accesibilidad digital/ })).toHaveAttribute(
      "aria-valuenow",
      "42",
    );
  });

  it("busca por título o materia y avisa cuando no hay resultados", async () => {
    const user = userEvent.setup();
    renderAt("/biblioteca");
    await user.type(await screen.findByRole("searchbox", { name: "Buscar documentos" }), "epidemio");
    expect(screen.getByText("1 documento")).toBeInTheDocument();
    await user.clear(screen.getByRole("searchbox"));
    await user.type(screen.getByRole("searchbox"), "zzz");
    expect(screen.getByText(/No hay documentos que coincidan con «zzz»/)).toBeInTheDocument();
  });

  it("un PowerPoint se rechaza con un mensaje claro y ofrece el documento de ejemplo", async () => {
    const user = userEvent.setup({ applyAccept: false });
    renderAt("/biblioteca");
    await user.upload(await screen.findByLabelText(/Elegir un archivo/), new File(["x"], "clase.pptx"));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/PowerPoint/);
    expect(within(alert).getByRole("button", { name: "Abrir el documento de ejemplo" })).toBeInTheDocument();
  });

  it("el archivo de ejemplo se procesa por pasos y abre el lector con el documento nuevo", async () => {
    const user = userEvent.setup();
    const router = renderAt("/biblioteca");
    await user.click(await screen.findByRole("button", { name: "Probar con un archivo de ejemplo" }));
    expect(await screen.findByText(/Extrayendo texto/)).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/leer\/u/), { timeout: 5_000 });
    expect(await h1()).toHaveTextContent("Accesibilidad digital en la educación superior");
  }, 10_000);
});

describe("lector", () => {
  beforeEach(() => withProfile());

  it("muestra las 3 columnas: accesibilidad, documento y asistente", async () => {
    renderAt("/leer/d1");
    expect(await h1()).toHaveTextContent("Accesibilidad digital en la educación superior");
    expect(screen.getByRole("complementary", { name: "Barra de accesibilidad" })).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "Panel de asistencia IA" })).toBeInTheDocument();
    expect(screen.getByRole("log", { name: "Conversación con el asistente" })).toHaveTextContent(
      "Hola, soy tu asistente de estudio",
    );
  });

  it("un documento inexistente es un 404 dentro del layout", async () => {
    renderAt("/leer/nope");
    expect(await h1()).toHaveTextContent("No encontramos esta página");
  });

  it("«Resumir esta página» responde con el mock y lo indica", async () => {
    const user = userEvent.setup();
    renderAt("/leer/d1");
    await user.click(await screen.findByRole("button", { name: "Resumir esta página" }));
    const log = screen.getByRole("log");
    await waitFor(() => expect(log).toHaveTextContent("Resumen de esta página"));
    expect(log).toHaveTextContent("Respuesta simulada");
  });

  it("una pregunta libre se contesta con el texto del documento", async () => {
    const user = userEvent.setup();
    renderAt("/leer/d1");
    await user.type(await screen.findByLabelText("Escribí tu pregunta"), "¿Qué dice la ley?{Enter}");
    await waitFor(() => expect(screen.getByRole("log")).toHaveTextContent(/Ley 26\.653 obliga/));
  });

  it("«Interpretar con IA» abre un diálogo con la descripción, y Esc lo cierra devolviendo el foco", async () => {
    const user = userEvent.setup();
    renderAt("/leer/d1");
    const trigger = await screen.findByRole("button", { name: /Interpretar con IA/ });
    await user.click(trigger);
    const dialog = await screen.findByRole("dialog", { name: "Interpretación de la imagen" });
    expect(dialog).toHaveTextContent(/gráfico de barras/i);
    expect(dialog).toHaveTextContent("Respuesta simulada");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("Alt+T cambia el tema y Alt+= agranda el texto", async () => {
    const user = userEvent.setup();
    renderAt("/leer/d1");
    await h1();
    await user.keyboard("{Alt>}t{/Alt}");
    expect(screen.getByRole("button", { name: /Sepia/ })).toHaveAttribute("aria-pressed", "true");
    await user.keyboard("{Alt>}[Equal]{/Alt}");
    expect(
      screen.getByText((_, el) => el?.tagName === "SPAN" && el.textContent === "22px"),
    ).toBeInTheDocument();
  });

  it("la lectura en voz alta resalta el párrafo actual y se puede detener", async () => {
    const user = userEvent.setup();
    renderAt("/leer/d1");
    await user.click(await screen.findByRole("button", { name: "Reproducir lectura" }));
    expect(await screen.findByText(/Leyendo · bloque 1 de/)).toBeInTheDocument();
    expect(document.querySelector("[id^=blk-][aria-current=true], h2[id^=blk-]")).not.toBeNull();
    await user.click(screen.getByRole("button", { name: "Detener lectura" }));
    expect(screen.getByText("Listo para leer.")).toBeInTheDocument();
  });

  it("con «destacar audio» aparece el botón grande «Escuchar este documento»", async () => {
    window.localStorage.setItem("aulaclara.settings", JSON.stringify({ audioFocus: true }));
    renderAt("/leer/d1");
    expect(await screen.findByRole("button", { name: /Escuchar este documento/ })).toBeInTheDocument();
  });
});
