import { act, render, screen, waitFor, type waitForOptions, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_SETTINGS, type ReadingSettings } from "@/features/preferences";
import { routes } from "@/router";

// Sin backend en los tests: el cliente HTTP devuelve respuestas fijas de "Gemini".
const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("@/lib/http", async (original) => ({
  ...(await original<typeof import("@/lib/http")>()),
  request,
}));

const MODEL = "gemini-3.5-flash-lite";
// Los mismos 3 presets del seed del backend.
const PRESETS = [
  {
    id: "dislexia",
    title: "Dislexia",
    icon: "Aa",
    description: "Fuente especializada…",
    tags: ["OpenDyslexic"],
    settings: { font: "dyslexic", font_size: 21, line_height: 1.9, theme: "sepia", audio_focus: false },
  },
  {
    id: "vision",
    title: "Visión reducida",
    icon: "A+",
    description: "Alto contraste…",
    tags: ["Texto 28 px"],
    settings: { font: "atkinson", font_size: 28, line_height: 1.7, theme: "contraste", audio_focus: false },
  },
  {
    id: "fatiga",
    title: "Fatiga visual",
    icon: "☾",
    description: "Modo oscuro…",
    tags: ["Audio destacado"],
    settings: { font: "verdana", font_size: 20, line_height: 1.8, theme: "oscuro", audio_focus: true },
  },
];
function fakeBackend({
  url,
  method,
  data,
}: {
  url: string;
  method?: string;
  data?: { action?: string; message?: string };
}) {
  if (url === "/presets") return Promise.resolve(PRESETS);
  if (url === "/ai/session")
    return Promise.resolve(
      method === "DELETE" ? undefined : { provider: "gemini", remember: false, expires_in_seconds: 43_200 },
    );
  if (url === "/ai/models")
    return Promise.resolve({
      provider: "gemini",
      key_verified: true,
      models: [{ id: MODEL, name: "Gemini 3.5 Flash Lite", supports_images: true, free: null }],
    });
  if (!data) return Promise.reject(new Error(`pedido inesperado: ${method} ${url}`));
  if (url === "/ai/describe-image")
    return Promise.resolve({
      description: "Un gráfico de barras de prueba.",
      provider: "gemini",
      model: MODEL,
    });
  if (data.action === "summarize")
    return Promise.resolve({ answer: "Resumen de esta página (prueba)", provider: "gemini", model: MODEL });
  return Promise.resolve({ answer: `Respuesta a: ${data.message ?? ""}`, provider: "gemini", model: MODEL });
}

beforeEach(() => {
  request.mockReset();
  request.mockImplementation(fakeBackend);
});

const withAI = (): void => {
  window.sessionStorage.setItem(
    "aulaclara.ai",
    JSON.stringify({ provider: "gemini", apiKey: "key-de-prueba-123", model: MODEL, remember: false }),
  );
};

/** Una key ya sellada en la cookie: acá solo quedan proveedor y modelo. */
const withSealedAI = (provider = "gemini"): void => {
  window.sessionStorage.setItem(
    "aulaclara.ai",
    JSON.stringify({ provider, model: MODEL, remember: false, sealed: true }),
  );
};

const calls = (url: string, method?: string) =>
  request.mock.calls
    .map(([c]) => c as { url: string; method?: string; headers?: Record<string, string>; data?: unknown })
    .filter((c) => c.url === url && (method === undefined || c.method === method));

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

const withOnboarding = (): void => window.localStorage.setItem("aulaclara.onboarded", "true");

const h1 = async (options?: waitForOptions) => screen.findByRole("heading", { level: 1 }, options);

describe("onboarding", () => {
  it("sin perfil, la raíz lleva al wizard con el enlace «Saltar al contenido»", async () => {
    const router = renderAt("/");
    // Primera carga del chunk lazy de /perfil: con toda la suite en paralelo puede pasar de 1 s.
    expect(await h1({ timeout: 5_000 })).toHaveTextContent(/Personalizá tu experiencia/);
    expect(router.state.location.pathname).toBe("/perfil");
    expect(screen.getByRole("link", { name: "Saltar al contenido" })).toHaveAttribute("href", "#contenido");
    expect(screen.getByRole("button", { name: /Siguiente/ })).toBeDisabled();
  }, 10_000);

  it("elegir un perfil aplica su preset, se ajusta en el paso 2 y se guarda", async () => {
    const user = userEvent.setup();
    const router = renderAt("/perfil");
    await user.click(await screen.findByRole("radio", { name: /Perfil Dislexia/ }));
    await user.click(screen.getByRole("button", { name: /Siguiente/ }));

    expect(await h1()).toHaveTextContent("Ajustá los detalles");
    expect(screen.getByLabelText("Tipografía")).toHaveValue("dyslexic");
    expect(screen.getByRole("group", { name: "Tamaño de fuente" })).toHaveTextContent("21 px");
    expect(screen.getByRole("button", { name: /Sepia/ })).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: "Guardar y continuar" }));
    // Primera carga de la ruta lazy de la biblioteca: con toda la suite en paralelo puede pasar de 1 s.
    await waitFor(() => expect(router.state.location.pathname).toBe("/biblioteca"), { timeout: 5_000 });
    expect(window.localStorage.getItem("aulaclara.profile")).toBeNull(); // no se guarda la etiqueta (Ley 25.326)
    expect(window.localStorage.getItem("aulaclara.onboarded")).toBe("true");
    expect(JSON.parse(window.localStorage.getItem("aulaclara.settings") ?? "{}")).toMatchObject({
      schemaVersion: 2,
      settings: { font: "dyslexic", theme: "sepia" },
    });
  }, 10_000);

  it("entrar a una ruta protegida sin perfil pasa por el wizard y vuelve a donde iba", async () => {
    const user = userEvent.setup();
    const router = renderAt("/leer/d1");
    await h1();
    expect(router.state.location.pathname).toBe("/perfil");
    expect(router.state.location.search).toBe("?next=%2Fleer%2Fd1");

    await user.click(await screen.findByRole("radio", { name: /Perfil Visión reducida/ }));
    await user.click(screen.getByRole("button", { name: /Siguiente/ }));
    await user.click(await screen.findByRole("button", { name: "Guardar y continuar" }));
    // Primera carga de la ruta lazy del lector (pdf.js y compañía): con toda la suite en paralelo puede pasar de 1 s.
    await waitFor(() => expect(router.state.location.pathname).toBe("/leer/d1"), { timeout: 5_000 });
  }, 10_000);

  it("ignora un ?next= que apunta a otro sitio (open redirect)", async () => {
    const user = userEvent.setup();
    const router = renderAt("/perfil?next=//sitio-malo.com");
    await user.click(await screen.findByRole("radio", { name: /Personalizado/ }));
    await user.click(screen.getByRole("button", { name: /Siguiente/ }));
    await user.click(await screen.findByRole("button", { name: "Guardar y continuar" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/biblioteca"));
  });

  it("pasar de un preset a otro no arrastra ajustes del anterior", async () => {
    request.mockImplementation((c: { url: string }) =>
      c.url === "/presets"
        ? Promise.resolve([
            {
              id: "a",
              title: "A",
              icon: "A",
              description: "",
              tags: [],
              settings: { audio_focus: true, theme: "oscuro" },
            },
            { id: "b", title: "B", icon: "B", description: "", tags: [], settings: { font: "dyslexic" } },
          ])
        : fakeBackend(c),
    );
    const user = userEvent.setup();
    renderAt("/perfil");
    await user.click(await screen.findByRole("radio", { name: /Perfil A/ }));
    await user.click(screen.getByRole("radio", { name: /Perfil B/ }));
    await user.click(screen.getByRole("button", { name: /Siguiente/ }));
    expect(
      await screen.findByRole("checkbox", { name: /Destacar la lectura en voz alta/ }),
    ).not.toBeChecked();
    expect(screen.getByRole("button", { name: /Claro/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("sin backend ni caché ofrece solo «Personalizado» y lo explica", async () => {
    request.mockRejectedValue(new Error("caído"));
    renderAt("/perfil");
    // findByText y no findByRole("status"): el Announcer global también tiene role="status".
    expect(await screen.findByText(/No pudimos cargar los perfiles sugeridos/)).toHaveAttribute(
      "role",
      "status",
    );
    expect(screen.getAllByRole("radio").map((r) => r.getAttribute("value"))).toEqual(["custom"]);
  });

  it("un preset del catálogo con el id reservado «custom» se descarta", async () => {
    request.mockImplementation((c: { url: string }) =>
      c.url === "/presets"
        ? Promise.resolve([
            ...PRESETS,
            { id: "custom", title: "Impostor", icon: "X", description: "", tags: [], settings: {} },
          ])
        : fakeBackend(c),
    );
    renderAt("/perfil");
    await h1();
    expect(screen.getAllByRole("radio").map((r) => r.getAttribute("value"))).toEqual([
      "dislexia",
      "vision",
      "fatiga",
      "custom",
    ]);
    expect(screen.getByRole("radio", { name: /Perfil Personalizado/ })).toHaveAttribute("value", "custom");
    expect(screen.queryByText(/Impostor/)).not.toBeInTheDocument();
  });

  // Durante una redirección React Router sigue mostrando la ruta de origen: cada entrada tiene su aviso.
  it.each([
    ["/perfil", "Cargando tu perfil de lectura…"],
    ["/", "Cargando…"],
    ["/leer/d1", "Cargando…"],
  ])("al entrar por %s, mientras llega el catálogo avisa «%s»", async (path, message) => {
    let respond: (presets: unknown) => void = () => undefined;
    request.mockImplementation((c: { url: string }) =>
      c.url === "/presets"
        ? new Promise((resolve) => {
            respond = resolve;
          })
        : fakeBackend(c),
    );
    renderAt(path);
    expect(await screen.findByText(message)).toHaveAttribute("role", "status");
    // El aviso aparece antes de que se pida el catálogo: se contesta recién cuando el pedido salió.
    await waitFor(() => expect(calls("/presets")).toHaveLength(1));
    respond(PRESETS);
    expect(await h1()).toHaveTextContent(/Personalizá tu experiencia/);
    expect(screen.queryByText(message)).not.toBeInTheDocument();
  });

  describe("con el onboarding hecho y ajustes propios", () => {
    // Ajustes afinados a mano: no coinciden con ningún preset, así que el wizard marca «Personalizado».
    const TUNED: ReadingSettings = {
      theme: "sepia",
      font: "verdana",
      fontSize: 26,
      lineHeight: 2,
      rate: 1.5,
      audioFocus: true,
      singleKeyShortcuts: false,
    };
    const stored = (): unknown => JSON.parse(window.localStorage.getItem("aulaclara.settings") ?? "null");

    beforeEach(() => {
      withOnboarding();
      window.localStorage.setItem(
        "aulaclara.settings",
        JSON.stringify({ schemaVersion: 2, settings: TUNED }),
      );
    });

    it("recorrer los perfiles con las flechas y salir sin terminar no pisa los ajustes", async () => {
      const user = userEvent.setup();
      const router = renderAt("/perfil");
      const custom = await screen.findByRole("radio", { name: /Perfil Personalizado/ });
      expect(custom).toBeChecked();
      custom.focus();
      // Las flechas dan la vuelta: Dislexia, Visión reducida, Fatiga visual. Cada una aplica su preset en vivo.
      await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}");
      expect(screen.getByRole("radio", { name: /Perfil Fatiga visual/ })).toBeChecked();

      await act(() => router.navigate("/biblioteca"));
      expect(
        await screen.findByRole("heading", { level: 1, name: /Hola/ }, { timeout: 5_000 }),
      ).toBeInTheDocument();
      expect(stored()).toEqual({ schemaVersion: 2, settings: TUNED });
      // También en memoria: al volver al wizard, los ajustes siguen siendo los propios.
      await act(() => router.navigate("/perfil"));
      expect(await screen.findByRole("radio", { name: /Perfil Personalizado/ })).toBeChecked();
    }, 10_000);

    it("los ajustes del perfil elegido se guardan recién al terminar", async () => {
      const user = userEvent.setup();
      const router = renderAt("/perfil");
      await user.click(await screen.findByRole("radio", { name: /Perfil Visión reducida/ }));
      await user.click(screen.getByRole("button", { name: /Siguiente/ }));
      expect(
        await screen.findByRole("heading", { level: 1, name: "Ajustá los detalles" }),
      ).toBeInTheDocument();
      expect(stored()).toEqual({ schemaVersion: 2, settings: TUNED }); // la vista previa no guarda nada

      await user.click(screen.getByRole("button", { name: "Guardar y continuar" }));
      await waitFor(() => expect(router.state.location.pathname).toBe("/biblioteca"), { timeout: 5_000 });
      expect(stored()).toEqual({
        schemaVersion: 2,
        settings: {
          ...DEFAULT_SETTINGS,
          font: "atkinson",
          fontSize: 28,
          lineHeight: 1.7,
          theme: "contraste",
        },
      });
    }, 10_000);
  });

  it("con el perfil guardado por la versión anterior entra directo a la biblioteca", async () => {
    window.localStorage.setItem("aulaclara.profile", JSON.stringify("dislexia"));
    const router = renderAt("/");
    await h1();
    expect(router.state.location.pathname).toBe("/biblioteca");
    expect(window.localStorage.getItem("aulaclara.profile")).toBeNull();
  });
});

describe("biblioteca", () => {
  beforeEach(() => withOnboarding());

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
    // Se espera el título del lector por nombre: h1() podría devolver todavía el de la biblioteca
    // mientras carga la ruta lazy del lector (carrera que hacía intermitente este test).
    expect(
      await screen.findByRole(
        "heading",
        { level: 1, name: /Accesibilidad digital en la educación superior/ },
        { timeout: 5_000 },
      ),
    ).toBeInTheDocument();
  }, 10_000);
});

describe("lector", () => {
  beforeEach(() => {
    withOnboarding();
    withAI();
  });

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

  it("«Resumir esta página» muestra la respuesta del modelo y su nombre", async () => {
    const user = userEvent.setup();
    renderAt("/leer/d1");
    await user.click(await screen.findByRole("button", { name: "Resumir esta página" }));
    const log = screen.getByRole("log");
    await waitFor(() => expect(log).toHaveTextContent("Resumen de esta página (prueba)"));
    expect(log).toHaveTextContent(`Respuesta de IA (Google Gemini · ${MODEL})`);
  });

  it("una pregunta libre se envía al asistente y se muestra su respuesta", async () => {
    const user = userEvent.setup();
    renderAt("/leer/d1");
    await user.type(await screen.findByLabelText("Escribí tu pregunta"), "¿Qué dice la ley?{Enter}");
    await waitFor(() => expect(screen.getByRole("log")).toHaveTextContent("Respuesta a: ¿Qué dice la ley?"));
  });

  it("«Interpretar con IA» abre un diálogo con la descripción, y Esc lo cierra devolviendo el foco", async () => {
    const user = userEvent.setup();
    renderAt("/leer/d1");
    const trigger = await screen.findByRole("button", { name: /Interpretar con IA/ });
    await user.click(trigger);
    const dialog = await screen.findByRole("dialog", { name: "Interpretación de la imagen" });
    expect(dialog).toHaveTextContent(/gráfico de barras/i);
    expect(dialog).toHaveTextContent(`Respuesta de IA (Google Gemini · ${MODEL})`);
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

  it("con atajos de una tecla, «1» resume pero escribir «1» en el chat no", async () => {
    window.localStorage.setItem(
      "aulaclara.settings",
      JSON.stringify({ schemaVersion: 2, settings: { singleKeyShortcuts: true } }),
    );
    const user = userEvent.setup();
    renderAt("/leer/d1");
    await user.type(await screen.findByLabelText("Escribí tu pregunta"), "1");
    expect(calls("/ai/chat")).toHaveLength(0);
    await user.click(screen.getByRole("heading", { level: 1 }));
    await user.keyboard("1");
    await waitFor(() => expect(calls("/ai/chat")[0]?.data).toMatchObject({ action: "summarize" }));
  });

  it("sin el ajuste, «1» no resume", async () => {
    const user = userEvent.setup();
    renderAt("/leer/d1");
    await h1();
    await user.keyboard("1");
    expect(calls("/ai/chat")).toHaveLength(0);
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

describe("IA con la key de cada persona", () => {
  beforeEach(() => withOnboarding());

  it("sin key, el panel pide configurarla y una consulta no llega al servidor", async () => {
    const user = userEvent.setup();
    renderAt("/leer/d1");
    await user.click(await screen.findByRole("button", { name: "Resumir esta página" }));
    const log = screen.getByRole("log");
    await waitFor(() => expect(log).toHaveTextContent("cargá tu API key"));
    expect(within(log).getByRole("button", { name: "Configurar IA" })).toBeInTheDocument();
    expect(request).not.toHaveBeenCalled();
  });

  it("«Configurar IA» prueba la key, la sella en una cookie y la página no se queda con ella", async () => {
    const user = userEvent.setup();
    renderAt("/leer/d1");
    await user.click(await screen.findByRole("button", { name: "Configurar IA" }));
    const dialog = await screen.findByRole("dialog", { name: "Configurar IA" });
    await user.click(within(dialog).getByRole("radio", { name: /Groq/ }));
    await user.type(within(dialog).getByLabelText(/Tu API key de Groq/), "gsk_key-de-prueba");
    await user.click(within(dialog).getByRole("button", { name: "Probar key y ver modelos" }));
    await waitFor(() => expect(within(dialog).getByRole("status")).toHaveTextContent("Key válida"));
    // La prueba usa el modo de headers: la key viaja una vez, antes de guardarla.
    expect(calls("/ai/models")[0]?.headers).toEqual({
      "X-AI-Provider": "groq",
      "X-AI-Key": "gsk_key-de-prueba",
    });
    expect(within(dialog).getByLabelText("3. Modelo")).toHaveValue(MODEL);
    await user.click(within(dialog).getByRole("button", { name: "Guardar" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText(`Groq · ${MODEL}`)).toBeInTheDocument();
    // Se selló: POST con la key y GET para comprobar que la cookie vuelve.
    expect(calls("/ai/session", "POST")[0]?.data).toEqual({
      provider: "groq",
      api_key: "gsk_key-de-prueba",
      remember: false,
    });
    expect(calls("/ai/session", "GET")).toHaveLength(1);
    // Lo guardado en el navegador no tiene la key.
    const stored = window.sessionStorage.getItem("aulaclara.ai") ?? "";
    expect(JSON.parse(stored)).toEqual({ provider: "groq", model: MODEL, remember: false, sealed: true });
    expect(stored).not.toContain("gsk_key-de-prueba");
    expect(window.localStorage.getItem("aulaclara.ai")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Resumir esta página" }));
    await waitFor(() => expect(screen.getByRole("log")).toHaveTextContent("Resumen de esta página (prueba)"));
    // La consulta no lleva la key: la pone el servidor al abrir la cookie.
    expect(calls("/ai/chat")[0]?.headers).toEqual({ "X-Aula-Clara": "1", "X-AI-Model": MODEL });
  });

  it("una key rechazada se explica sin guardar nada", async () => {
    const { ApiRequestError } = await import("@/lib/http");
    request.mockRejectedValueOnce(
      new ApiRequestError({
        kind: "unauthorized",
        problem: { title: "x", status: 401, code: "ai_key_invalid" },
      }),
    );
    const user = userEvent.setup();
    renderAt("/leer/d1");
    await user.click(await screen.findByRole("button", { name: "Configurar IA" }));
    const dialog = await screen.findByRole("dialog", { name: "Configurar IA" });
    await user.type(within(dialog).getByLabelText(/Tu API key de Google Gemini/), "key-mala-123");
    await user.click(within(dialog).getByRole("button", { name: "Probar key y ver modelos" }));
    await waitFor(() => expect(within(dialog).getByRole("status")).toHaveTextContent("rechazó tu API key"));
    expect(within(dialog).getByRole("button", { name: "Guardar" })).toBeDisabled();
    expect(window.sessionStorage.getItem("aulaclara.ai")).toBeNull();
  });

  it("NVIDIA no permite verificar la key: se avisa que el error aparecería en la primera consulta", async () => {
    request.mockImplementation(({ url }: { url: string }) =>
      url === "/ai/models"
        ? Promise.resolve({
            provider: "nvidia",
            key_verified: false,
            models: [
              { id: "openai/gpt-oss-20b", name: "openai/gpt-oss-20b", supports_images: null, free: null },
            ],
          })
        : Promise.reject(new Error("no esperado")),
    );
    const user = userEvent.setup();
    renderAt("/leer/d1");
    await user.click(await screen.findByRole("button", { name: "Configurar IA" }));
    const dialog = await screen.findByRole("dialog", { name: "Configurar IA" });
    await user.click(within(dialog).getByRole("radio", { name: /NVIDIA Build/ }));
    await user.type(within(dialog).getByLabelText(/Tu API key de NVIDIA Build/), "nvapi-prueba-123");
    await user.click(within(dialog).getByRole("button", { name: "Probar key y ver modelos" }));
    await waitFor(() =>
      expect(within(dialog).getByRole("status")).toHaveTextContent("no permite comprobar la key"),
    );
    expect(within(dialog).getByRole("button", { name: "Guardar" })).toBeEnabled();
  });

  it("el diálogo explica paso a paso cómo conseguir la key del proveedor elegido y enlaza la guía", async () => {
    const user = userEvent.setup();
    renderAt("/leer/d1");
    await user.click(await screen.findByRole("button", { name: "Configurar IA" }));
    const dialog = await screen.findByRole("dialog", { name: "Configurar IA" });
    await user.click(within(dialog).getByRole("radio", { name: /Mistral AI/ }));
    await user.click(within(dialog).getByText(/Cómo conseguir tu key de Mistral AI, paso a paso/));
    expect(within(dialog).getByText(/Verificá tu número de teléfono/)).toBeVisible();
    expect(within(dialog).getByRole("link", { name: /Ver la guía completa/ })).toHaveAttribute(
      "href",
      "/ayuda/ia#mistral",
    );
  });
});

describe("Configurar IA: respuestas tardías y filtro de gratuitos", () => {
  beforeEach(() => withOnboarding());

  it("una respuesta que llega después de cambiar de proveedor se descarta", async () => {
    let resolveGemini: (value: unknown) => void = () => undefined;
    request.mockImplementation(({ headers }: { headers: Record<string, string> }) =>
      headers["X-AI-Provider"] === "gemini"
        ? new Promise((resolve) => {
            resolveGemini = resolve;
          })
        : Promise.reject(new Error("no esperado")),
    );
    const user = userEvent.setup();
    renderAt("/leer/d1");
    await user.click(await screen.findByRole("button", { name: "Configurar IA" }));
    const dialog = await screen.findByRole("dialog", { name: "Configurar IA" });
    await user.type(within(dialog).getByLabelText(/Tu API key de Google Gemini/), "AIza-prueba-123");
    await user.click(within(dialog).getByRole("button", { name: "Probar key y ver modelos" }));
    await user.click(within(dialog).getByRole("radio", { name: /Groq/ }));
    await user.type(within(dialog).getByLabelText(/Tu API key de Groq/), "gsk_prueba-123");

    resolveGemini({
      provider: "gemini",
      key_verified: true,
      models: [{ id: MODEL, name: "Gemini", supports_images: true, free: null }],
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(within(dialog).queryByLabelText("3. Modelo")).not.toBeInTheDocument();
    expect(within(dialog).getByRole("status")).not.toHaveTextContent("Key válida");
    expect(within(dialog).getByRole("button", { name: "Guardar" })).toBeDisabled();
  });

  it("con «solo gratuitos» se elige un modelo visible, nunca uno oculto por el filtro", async () => {
    request.mockResolvedValue({
      provider: "openrouter",
      key_verified: true,
      models: [
        { id: "sin-precio", name: "Sin precio", supports_images: null, free: null },
        { id: "pago", name: "Pago", supports_images: null, free: false },
        { id: "gratis:free", name: "Gratis", supports_images: null, free: true },
      ],
    });
    const user = userEvent.setup();
    renderAt("/leer/d1");
    await user.click(await screen.findByRole("button", { name: "Configurar IA" }));
    const dialog = await screen.findByRole("dialog", { name: "Configurar IA" });
    await user.click(within(dialog).getByRole("radio", { name: /OpenRouter/ }));
    await user.type(within(dialog).getByLabelText(/Tu API key de OpenRouter/), "sk-or-prueba-123");
    await user.click(within(dialog).getByRole("button", { name: "Probar key y ver modelos" }));
    const select = await within(dialog).findByLabelText("3. Modelo");
    expect(select).toHaveValue("gratis:free");

    // Sin el filtro aparece todo; al volver a filtrar, un modelo pago elegido queda oculto y no se puede guardar.
    await user.click(within(dialog).getByRole("checkbox", { name: "Mostrar solo modelos gratuitos" }));
    await user.selectOptions(select, "pago");
    await user.click(within(dialog).getByRole("checkbox", { name: "Mostrar solo modelos gratuitos" }));
    expect(within(dialog).getByRole("button", { name: "Guardar" })).toBeDisabled();
  });
});

describe("key sellada en cookie: respaldo, reemplazo y borrado", () => {
  beforeEach(() => withOnboarding());

  const openDialog = async (user: ReturnType<typeof userEvent.setup>) => {
    renderAt("/leer/d1");
    await user.click(await screen.findByRole("button", { name: /Configurar IA|Cambiar/ }));
    return screen.findByRole("dialog", { name: "Configurar IA" });
  };
  const typeKeyAndTest = async (
    user: ReturnType<typeof userEvent.setup>,
    dialog: HTMLElement,
    key = "AIza-key-de-prueba",
  ) => {
    await user.type(within(dialog).getByLabelText(/Tu API key de Google Gemini/), key);
    await user.click(within(dialog).getByRole("button", { name: "Probar key y ver modelos" }));
    await waitFor(() => expect(within(dialog).getByRole("status")).toHaveTextContent("Key válida"));
  };

  it("si el servidor no tiene la key sellada activada, guarda la key en el navegador y lo explica", async () => {
    const { ApiRequestError } = await import("@/lib/http");
    request.mockImplementation((c: Parameters<typeof fakeBackend>[0]) =>
      c.url === "/ai/session"
        ? Promise.reject(
            new ApiRequestError({
              kind: "server",
              status: 503,
              problem: { title: "x", status: 503, code: "ai_sessions_disabled" },
            }),
          )
        : fakeBackend(c),
    );
    const user = userEvent.setup();
    const dialog = await openDialog(user);
    await typeKeyAndTest(user, dialog);
    await user.click(within(dialog).getByRole("button", { name: "Guardar" }));

    // El diálogo queda abierto para explicar dónde quedó la key.
    await waitFor(() =>
      expect(within(dialog).getByRole("status")).toHaveTextContent("guardada en este navegador"),
    );
    expect(JSON.parse(window.sessionStorage.getItem("aulaclara.ai") ?? "{}")).toEqual({
      provider: "gemini",
      model: MODEL,
      remember: false,
      apiKey: "AIza-key-de-prueba",
    });
    await user.click(within(dialog).getByRole("button", { name: "Listo" }));
    await user.click(screen.getByRole("button", { name: "Resumir esta página" }));
    await waitFor(() => expect(screen.getByRole("log")).toHaveTextContent("Resumen de esta página (prueba)"));
    expect(calls("/ai/chat")[0]?.headers).toMatchObject({ "X-AI-Key": "AIza-key-de-prueba" });
  });

  it("si el navegador no devuelve la cookie (GET falla), no se queda con una key que no puede usar", async () => {
    const { ApiRequestError } = await import("@/lib/http");
    request.mockImplementation((c: Parameters<typeof fakeBackend>[0]) =>
      c.url === "/ai/session" && c.method === "GET"
        ? Promise.reject(
            new ApiRequestError({
              kind: "unauthorized",
              problem: { title: "x", status: 401, code: "ai_credentials_required" },
            }),
          )
        : fakeBackend(c),
    );
    const user = userEvent.setup();
    const dialog = await openDialog(user);
    await typeKeyAndTest(user, dialog);
    await user.click(within(dialog).getByRole("button", { name: "Guardar" }));
    await waitFor(() =>
      expect(within(dialog).getByRole("status")).toHaveTextContent("guardada en este navegador"),
    );
    expect(JSON.parse(window.sessionStorage.getItem("aulaclara.ai") ?? "{}").apiKey).toBe(
      "AIza-key-de-prueba",
    );
    expect(calls("/ai/session", "DELETE")).toHaveLength(1); // no deja una cookie a medias
  });

  it("«Recordar en este dispositivo» sella la cookie persistente y guarda el aviso en localStorage", async () => {
    const user = userEvent.setup();
    const dialog = await openDialog(user);
    await typeKeyAndTest(user, dialog);
    await user.click(within(dialog).getByRole("checkbox", { name: /Recordar en este dispositivo/ }));
    await user.click(within(dialog).getByRole("button", { name: "Guardar" }));
    expect(calls("/ai/session", "POST")[0]?.data).toMatchObject({ remember: true });
    expect(JSON.parse(window.localStorage.getItem("aulaclara.ai") ?? "{}")).toEqual({
      provider: "gemini",
      model: MODEL,
      remember: true,
      sealed: true,
    });
    expect(window.sessionStorage.getItem("aulaclara.ai")).toBeNull();
  });

  it("con una key ya sellada no se muestra nada secreto y los modelos se listan con la cookie", async () => {
    withSealedAI();
    const user = userEvent.setup();
    const dialog = await openDialog(user);
    expect(dialog).toHaveTextContent("guardada de forma segura y no se puede ver");
    expect(within(dialog).getByLabelText(/Tu API key de Google Gemini/)).toHaveValue("");
    expect(within(dialog).getByRole("checkbox", { name: /Recordar en este dispositivo/ })).toBeDisabled();

    await user.click(within(dialog).getByRole("button", { name: "Ver los modelos de mi key guardada" }));
    await waitFor(() => expect(within(dialog).getByLabelText("3. Modelo")).toBeInTheDocument());
    const [listing] = calls("/ai/models");
    expect(listing?.headers).toEqual({ "X-Aula-Clara": "1", "X-AI-Provider": "gemini" }); // sin key
    await user.click(within(dialog).getByRole("button", { name: "Guardar" }));
    expect(calls("/ai/session", "POST")).toHaveLength(0); // solo cambia el modelo: no se vuelve a sellar
    expect(JSON.parse(window.sessionStorage.getItem("aulaclara.ai") ?? "{}")).toMatchObject({ sealed: true });
  });

  it("pegar una key nueva reemplaza la sellada", async () => {
    withSealedAI();
    const user = userEvent.setup();
    const dialog = await openDialog(user);
    await typeKeyAndTest(user, dialog, "AIza-key-nueva-9999");
    await user.click(within(dialog).getByRole("button", { name: "Guardar" }));
    expect(calls("/ai/session", "POST")[0]?.data).toMatchObject({ api_key: "AIza-key-nueva-9999" });
  });

  it("«Borrar mi key» borra la cookie en el servidor y lo guardado acá", async () => {
    withSealedAI();
    const user = userEvent.setup();
    const dialog = await openDialog(user);
    await user.click(within(dialog).getByRole("button", { name: "Borrar mi key" }));
    await waitFor(() => expect(window.sessionStorage.getItem("aulaclara.ai")).toBeNull());
    expect(calls("/ai/session", "DELETE")).toHaveLength(1);
  });

  it("si la sesión de la cookie venció, el panel lo dice y vuelve a pedir la key", async () => {
    withSealedAI();
    const { ApiRequestError } = await import("@/lib/http");
    request.mockRejectedValue(
      new ApiRequestError({
        kind: "unauthorized",
        problem: { title: "x", status: 401, code: "ai_credentials_required", reason: "session_expired" },
      }),
    );
    const user = userEvent.setup();
    renderAt("/leer/d1");
    await user.click(await screen.findByRole("button", { name: "Resumir esta página" }));
    await waitFor(() => expect(screen.getByRole("log")).toHaveTextContent("Tu sesión de IA venció"));
    expect(window.sessionStorage.getItem("aulaclara.ai")).toBeNull(); // ya no aparece como configurada
    expect(screen.getAllByRole("button", { name: "Configurar IA" }).length).toBeGreaterThan(0);
  });
});

describe("errores y avisos de la IA en pantalla", () => {
  beforeEach(() => {
    withOnboarding();
    withAI();
  });

  const failWith = async (code: string, status: number, extra: Record<string, unknown> = {}) => {
    const { ApiRequestError } = await import("@/lib/http");
    const p = { title: "x", status, code, provider: "gemini", model: MODEL, ...extra };
    request.mockRejectedValue(
      status === 429
        ? new ApiRequestError({ kind: "rate_limited", retryAfterMs: null, problem: p })
        : new ApiRequestError({ kind: "server", status, problem: p }),
    );
  };

  it("cuota agotada: explica el motivo, cuánto esperar y ofrece «Configurar IA»", async () => {
    await failWith("ai_quota_exceeded", 429, {
      reason: "daily",
      retry_after_seconds: 7_200,
      provider_message: "Quota exceeded for requests per day",
    });
    const user = userEvent.setup();
    renderAt("/leer/d1");
    await user.click(await screen.findByRole("button", { name: "Resumir esta página" }));
    const log = screen.getByRole("log");
    await waitFor(() => expect(log).toHaveTextContent("límite diario de Google Gemini"));
    expect(log).toHaveTextContent("más de una hora");
    expect(log).toHaveTextContent("Detalle del proveedor: «Quota exceeded for requests per day»");
    expect(within(log).getByRole("button", { name: "Configurar IA" })).toBeInTheDocument();
  });

  it("una respuesta cortada por el límite de largo se muestra y se avisa", async () => {
    request.mockResolvedValue({
      answer: "1. Primera pregunta\n2. Segun",
      provider: "gemini",
      model: MODEL,
      truncated: true,
    });
    const user = userEvent.setup();
    renderAt("/leer/d1");
    await user.click(await screen.findByRole("button", { name: "Crear 3 preguntas de repaso" }));
    await waitFor(() => expect(screen.getByRole("log")).toHaveTextContent("2. Segun"));
    expect(screen.getByRole("log")).toHaveTextContent(
      "La respuesta se cortó porque el modelo llegó a su límite",
    );
  });

  it("la caja de la pregunta no deja escribir más de lo que acepta el servidor", async () => {
    renderAt("/leer/d1");
    expect(await screen.findByLabelText("Escribí tu pregunta")).toHaveAttribute("maxlength", "2000");
  });

  it("un error del servidor de Vercel sin cuerpo (504) también se explica", async () => {
    const { ApiRequestError } = await import("@/lib/http");
    request.mockRejectedValue(new ApiRequestError({ kind: "server", status: 504, problem: null }));
    const user = userEvent.setup();
    renderAt("/leer/d1");
    await user.click(await screen.findByRole("button", { name: "Resumir esta página" }));
    await waitFor(() => expect(screen.getByRole("log")).toHaveTextContent("30 segundos"));
  });

  it("«Interpretar con IA» con la imagen cortada por el límite avisa en el diálogo", async () => {
    request.mockResolvedValue({
      description: "Un gráfico de barras que crece",
      provider: "gemini",
      model: MODEL,
      truncated: true,
    });
    const user = userEvent.setup();
    renderAt("/leer/d1");
    await user.click(await screen.findByRole("button", { name: /Interpretar con IA/ }));
    const dialog = await screen.findByRole("dialog", { name: "Interpretación de la imagen" });
    expect(dialog).toHaveTextContent("La descripción se cortó");
  });

  it("«Interpretar con IA» con una imagen que no se puede armar lo dice y no culpa a la IA", async () => {
    const extractors = await import("@/lib/extractors");
    vi.mocked(extractors.svgToJpeg).mockRejectedValueOnce(new Error("canvas roto"));
    const user = userEvent.setup();
    renderAt("/leer/d1");
    await user.click(await screen.findByRole("button", { name: /Interpretar con IA/ }));
    const dialog = await screen.findByRole("dialog", { name: "Interpretación de la imagen" });
    expect(dialog).toHaveTextContent("No pudimos preparar la imagen");
    expect(request).not.toHaveBeenCalled();
  });
});

describe("guía de API keys", () => {
  it("es pública y explica cada proveedor con su paso a paso", async () => {
    renderAt("/ayuda/ia");
    expect(await h1()).toHaveTextContent("Cómo conseguir tu API key gratuita");
    for (const name of ["Google Gemini", "Groq", "OpenRouter", "Mistral AI", "NVIDIA Build"]) {
      expect(screen.getByRole("heading", { level: 2, name })).toBeInTheDocument();
    }
    expect(screen.getByRole("table", { name: "Comparación de proveedores de IA" })).toBeInTheDocument();
    // Recomendaciones para que una key perdida no pueda hacer daño.
    const care = screen.getByRole("heading", { level: 2, name: "Cuidá tu key" }).closest("section");
    expect(care).toHaveTextContent("Quedate en el plan gratuito, sin tarjeta ni saldo");
    expect(care).toHaveTextContent("cookie cifrada");
    expect(
      screen.getByRole("heading", { level: 2, name: "OpenRouter" }).closest("section"),
    ).toHaveTextContent("Credit limit) en 0");
    expect(
      screen.getByRole("heading", { level: 2, name: "Google Gemini" }).closest("section"),
    ).toHaveTextContent("No actives la facturación");
    expect(screen.getAllByRole("link", { name: /Ir a crear la key/ })).toHaveLength(5);
    expect(screen.getByRole("link", { name: /Ir a crear la key de NVIDIA Build/ })).toHaveAttribute(
      "href",
      "https://build.nvidia.com/settings/api-keys",
    );
  });
});
