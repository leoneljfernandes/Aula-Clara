const INTERACTIVE = "button, a[href], [role=button], input[type=checkbox], input[type=radio], summary";

/**
 * Ignora un segundo clic del puntero sobre el mismo control interactivo si llega antes de `ms` milisegundos del
 * último clic aceptado: un temblor de la mano no debe activar un botón dos veces. Es un listener del documento en
 * fase de captura, así que no toca ningún componente. El teclado (Enter, Espacio: `detail === 0`) nunca se filtra.
 * Devuelve la función que lo quita.
 */
export function installClickGuard(root: Document, ms: number): () => void {
  let last: { el: Element; at: number } | null = null;
  const onClick = (event: Event): void => {
    const click = event as MouseEvent;
    if (click.detail === 0) return;
    const el = (click.target as Element | null)?.closest?.(INTERACTIVE) ?? null;
    if (!el) return;
    const at = performance.now();
    if (last && last.el === el && at - last.at < ms) {
      click.preventDefault();
      click.stopImmediatePropagation();
      return;
    }
    last = { el, at };
  };
  root.addEventListener("click", onClick, true);
  return () => root.removeEventListener("click", onClick, true);
}
