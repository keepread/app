import { mutate as globalMutate } from "swr";

function keyContainsDocumentsListPath(key: unknown): boolean {
  if (typeof key === "string") {
    return key.startsWith("/api/documents?") ||
      (key.startsWith("$inf$") && key.includes("/api/documents?"));
  }

  if (Array.isArray(key)) {
    return key.some((part) => keyContainsDocumentsListPath(part));
  }

  return false;
}

export async function invalidateDocumentLists(): Promise<void> {
  await globalMutate(
    (key) => keyContainsDocumentsListPath(key),
    undefined,
    { revalidate: true }
  );
}
