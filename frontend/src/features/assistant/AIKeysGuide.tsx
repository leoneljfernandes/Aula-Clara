import { type ReactNode, useEffect } from "react";
import { Link, useLocation } from "react-router";

import { PROVIDERS } from "./providers";

const TROUBLESHOOTING: ReadonlyArray<readonly [string, string]> = [
  [
    "«El proveedor rechazó tu API key»",
    "Revisá que copiaste la key completa, sin espacios, y que elegiste el proveedor correcto. En Mistral, esperá unos minutos: a veces tarda en activarse. Si no aparece, creá una key nueva.",
  ],
  [
    "«Se agotó la cuota gratuita»",
    "Cada proveedor limita las consultas gratuitas por minuto o por día. Esperá un rato, elegí otro modelo o cargá la key de otro proveedor.",
  ],
  [
    "«Llegaste al límite diario» o «por minuto»",
    "Es la cuota gratuita de tu proveedor. Si es por minuto, esperá lo que indica el mensaje. Si es por día, probá mañana o elegí otro modelo o proveedor en «Configurar IA».",
  ],
  [
    "«Tu cuenta no tiene saldo para este modelo»",
    "En OpenRouter, solo los modelos marcados como gratuitos no cobran. Elegí uno de esos, o cargá crédito en el proveedor.",
  ],
  [
    "«Lo que mandaste es demasiado grande para este modelo»",
    "El texto o la imagen superan lo que el modelo acepta. Seleccioná solo el párrafo que te interesa, usá una imagen más chica o elegí un modelo con más capacidad.",
  ],
  [
    "«El modelo no existe, fue dado de baja o tu cuenta no tiene acceso»",
    "Los proveedores renuevan sus modelos seguido. Abrí «Configurar IA», tocá «Probar key y ver modelos» y elegí uno de la lista actualizada.",
  ],
  [
    "«Este modelo no pudo leer la imagen»",
    "Para «Interpretar con IA» hace falta un modelo que lea imágenes (en la lista dicen «lee imágenes»). Los de Gemini la leen todos.",
  ],
  [
    "«El filtro de seguridad bloqueó esta consulta»",
    "El proveedor frenó el pedido o la respuesta por sus reglas de contenido. Probá con otra pregunta, otro fragmento u otro modelo.",
  ],
  [
    "«El modelo gastó todo su límite de respuesta pensando»",
    "Algunos modelos «razonan» antes de contestar y se quedan sin espacio. Probá con una pregunta más simple o elegí un modelo que no sea de razonamiento.",
  ],
  [
    "«El proveedor está saturado» o «tardó demasiado»",
    "Es un problema temporal del proveedor, no de tu key. Probá de nuevo en unos minutos, con un fragmento más corto o con un modelo más rápido.",
  ],
  [
    "«No encontramos el servidor de la IA»",
    "Si usás la versión de GitHub Pages, quien la publicó tiene que configurar la dirección del backend (VITE_API_URL).",
  ],
  [
    "Perdí la key",
    "Por seguridad, la mayoría de los proveedores no vuelve a mostrarla. Borrala en la página del proveedor y creá una nueva.",
  ],
];

/** Guía paso a paso para conseguir una API key gratuita en cada proveedor. */
export function AIKeysGuide(): ReactNode {
  const { hash } = useLocation();

  // La guía se abre en otra pestaña con #proveedor: al terminar de renderizar, se lleva el foco ahí.
  useEffect(() => {
    if (!hash) return;
    const target = document.getElementById(hash.slice(1));
    target?.scrollIntoView();
    target?.focus();
  }, [hash]);

  return (
    <main id="contenido" tabIndex={-1} className="mx-auto max-w-3xl px-5 py-10 text-lg leading-relaxed">
      <p className="mb-4">
        <Link to="/biblioteca" className="font-bold underline">
          Volver a mi biblioteca
        </Link>
      </p>
      <h1 className="mb-4 text-3xl font-bold">Cómo conseguir tu API key gratuita</h1>

      <section aria-labelledby="que-es" className="mb-8 space-y-3">
        <h2 id="que-es" className="text-2xl font-bold">
          Qué es y por qué la necesitás
        </h2>
        <p>
          Una <strong>API key</strong> es una contraseña larga que te da un proveedor de inteligencia
          artificial para que una aplicación use sus modelos en tu nombre. Aula Clara no tiene una key propia:
          así el servicio no depende de la cuota de nadie y cada persona usa la suya.
        </p>
        <p>
          Los cinco proveedores de esta guía tienen un <strong>uso gratuito</strong> y ninguno pide tarjeta
          para empezar. Solo hace falta crear una cuenta, generar la key y pegarla en «Configurar IA», en el
          panel del asistente.
        </p>
        <p>
          Tu key viaja a nuestro servidor solo para hacer cada consulta, y no la guardamos ni la registramos.
          No la compartas con nadie: quien la tenga puede usar tu cuota.
        </p>
      </section>

      <section aria-labelledby="cuida-tu-key" className="mb-8 space-y-3">
        <h2 id="cuida-tu-key" tabIndex={-1} className="text-2xl font-bold">
          Cuidá tu key
        </h2>
        <p>
          Una key es como una contraseña. Aula Clara la protege, pero ninguna protección es perfecta, así que
          conviene que, si alguna vez se pierde, no pueda hacer daño:
        </p>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <strong>Usá una key solo para Aula Clara.</strong> Así, si querés revocarla, no se rompe nada más.
          </li>
          <li>
            <strong>Quedate en el plan gratuito, sin tarjeta ni saldo.</strong> Con eso, lo máximo que alguien
            podría hacer con tu key es gastar tu cuota gratuita. Cada proveedor de abajo indica qué cuidar.
          </li>
          <li>
            <strong>Borrala en el proveedor si ya no la usás</strong>, si la compartiste sin querer o si ves
            consumo que no reconocés. Desde Aula Clara, «Borrar mi key» la saca de este navegador y del
            servidor, pero la key en sí solo se anula en la página del proveedor.
          </li>
          <li>
            <strong>No marques «Recordar en este dispositivo» en una computadora compartida.</strong>
          </li>
          <li>
            <strong>No la pegues en chats, mails ni capturas de pantalla.</strong>
          </li>
        </ul>
        <p>
          <strong>Cómo la guardamos.</strong> Si el servidor lo permite, tu key queda en una cookie cifrada
          que ni la página puede leer: solo el servidor la abre, y únicamente para hacer tus consultas. Eso
          protege la key aunque la página sufriera un ataque. Si el servidor no lo permite, o tu navegador no
          acepta la cookie, la key se guarda en este navegador y la app te lo avisa al guardar.
        </p>
      </section>

      <section aria-labelledby="comparacion" className="mb-8">
        <h2 id="comparacion" className="mb-3 text-2xl font-bold">
          ¿Cuál elijo?
        </h2>
        <p className="mb-3">
          Si no sabés cuál elegir, empezá por <strong>Google Gemini</strong>: con una cuenta de Google se
          resuelve en dos minutos y sirve también para describir imágenes.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-base">
            <caption className="sr-only">Comparación de proveedores de IA</caption>
            <thead>
              <tr className="border-b-2 border-[var(--border)] text-left">
                <th scope="col" className="p-2">
                  Proveedor
                </th>
                <th scope="col" className="p-2">
                  Qué necesitás
                </th>
                <th scope="col" className="p-2">
                  Uso gratuito
                </th>
              </tr>
            </thead>
            <tbody>
              {PROVIDERS.map((p) => (
                <tr key={p.id} className="border-b border-[var(--border)] align-top">
                  <th scope="row" className="p-2 text-left">
                    <a href={`#${p.id}`} className="underline">
                      {p.label}
                    </a>
                  </th>
                  <td className="p-2">{p.needs}</td>
                  <td className="p-2">{p.free}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {PROVIDERS.map((p) => (
        <section key={p.id} aria-labelledby={`${p.id}-titulo`} className="mb-8">
          <h2 id={p.id} tabIndex={-1} className="mb-2 text-2xl font-bold">
            <span id={`${p.id}-titulo`}>{p.label}</span>
          </h2>
          <p className="mb-2">{p.note}</p>
          <ul className="mb-3 list-disc space-y-1 pl-6">
            <li>
              <strong>Qué necesitás:</strong> {p.needs}
            </li>
            <li>
              <strong>Uso gratuito:</strong> {p.free}
            </li>
            <li>
              <strong>Cómo reconocer la key:</strong> {p.keyHint}
            </li>
          </ul>
          <h3 className="mb-2 text-xl font-bold">Paso a paso</h3>
          <ol className="mb-3 list-decimal space-y-2 pl-6">
            {p.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          {p.warnings.length > 0 && (
            <div className="mb-3 rounded-xl border-2 border-[var(--accent)] p-3">
              <p className="font-bold">Tené en cuenta</p>
              <ul className="list-disc space-y-1 pl-6">
                {p.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          )}
          <p className="flex flex-wrap gap-x-6 gap-y-2">
            <a href={p.signupUrl} target="_blank" rel="noreferrer noopener" className="font-bold underline">
              Crear cuenta o iniciar sesión en {p.label}{" "}
              <span className="sr-only">(se abre en una pestaña nueva)</span>
            </a>
            <a href={p.keyUrl} target="_blank" rel="noreferrer noopener" className="font-bold underline">
              Ir a crear la key <span className="sr-only">de {p.label} (se abre en una pestaña nueva)</span>
            </a>
          </p>
        </section>
      ))}

      <section aria-labelledby="problemas" className="mb-8">
        <h2 id="problemas" className="mb-3 text-2xl font-bold">
          Si algo no funciona
        </h2>
        <dl className="space-y-3">
          {TROUBLESHOOTING.map(([problem, fix]) => (
            <div key={problem}>
              <dt className="font-bold">{problem}</dt>
              <dd>{fix}</dd>
            </div>
          ))}
        </dl>
      </section>

      <p className="text-base text-[var(--muted)]">
        Los nombres de los botones y los límites gratuitos los define cada proveedor y pueden cambiar. Si algo
        no coincide con esta guía, buscá la sección «API keys» en el menú de tu cuenta.
      </p>
    </main>
  );
}
