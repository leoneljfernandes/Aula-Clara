import type { ReactNode } from "react";
import { useLoaderData } from "react-router";

import { LibraryScreen, libraryApi, type LibraryDocument } from "@/features/library";

export function loader(): LibraryDocument[] {
  return libraryApi.list();
}

export function Component(): ReactNode {
  const documents = useLoaderData<typeof loader>();
  return (
    <>
      <title>Mi biblioteca · Aula Clara</title>
      <LibraryScreen documents={documents} />
    </>
  );
}
