/** Nombre de archivo seguro: minúsculas, sin tildes, solo `[a-z0-9]` y guiones, de hasta `max` caracteres. */
export function slugify(text: string, max = 60): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/g, "");
}
