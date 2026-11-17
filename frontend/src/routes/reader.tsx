import type { ReactNode } from "react";
import { data, type LoaderFunctionArgs, useLoaderData } from "react-router";

import { type Article, libraryApi, type LibraryDocument } from "@/features/library";
import { ReaderScreen } from "@/features/reader";

export async function loader({
  params,
}: LoaderFunctionArgs): Promise<{ doc: LibraryDocument; article: Article }> {
  const doc = params.documentId ? libraryApi.get(params.documentId) : undefined;
  if (!doc) throw data("Documento no encontrado", { status: 404 });
  return { doc, article: await libraryApi.loadArticle(doc.id) };
}

export function Component(): ReactNode {
  const { doc, article } = useLoaderData<typeof loader>();
  // key: al cambiar de documento se remonta el lector entero (progreso, chat y voz arrancan limpios)
  return <ReaderScreen key={doc.id} doc={doc} article={article} />;
}
