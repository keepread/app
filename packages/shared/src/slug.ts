export function normalizeSlugInput(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function slugToDisplayName(slug: string): string {
  return slug
    .split(/[-_+]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function emailToSubscriptionKey(
  email: string,
  collapsePlus: boolean
): string {
  const localPart = email.split("@")[0].toLowerCase();
  if (collapsePlus && localPart.includes("+")) {
    return localPart.split("+")[0];
  }
  return localPart;
}

export function parseToAddressRoute(
  toAddress: string,
  emailDomain: string,
  authMode: string
): { userSlug: string; aliasTag: string | null } {
  const [localPart, domain] = toAddress.toLowerCase().split("@");
  if (authMode === "multi-user") {
    const lastPlus = localPart.lastIndexOf("+");
    if (lastPlus !== -1) {
      return {
        userSlug: localPart.slice(lastPlus + 1),
        aliasTag: localPart.slice(0, lastPlus) || null,
      };
    }
    return { userSlug: localPart, aliasTag: null };
  }
  // single-user: slug = SLD of domain (e.g. "annjose" from "annjose.com")
  const parts = domain.split(".");
  return {
    userSlug: parts[parts.length - 2] ?? parts[0],
    aliasTag: null,
  };
}
