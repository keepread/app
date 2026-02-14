const UNITS: [string, number][] = [
  ["y", 365 * 24 * 60 * 60 * 1000],
  ["mo", 30 * 24 * 60 * 60 * 1000],
  ["w", 7 * 24 * 60 * 60 * 1000],
  ["d", 24 * 60 * 60 * 1000],
  ["h", 60 * 60 * 1000],
  ["m", 60 * 1000],
];

export function formatRelativeDate(dateStr: string, now?: Date): string {
  const date = new Date(dateStr);
  const ref = now ?? new Date();
  const diff = ref.getTime() - date.getTime();

  if (diff < 60 * 1000) return "just now";

  for (const [unit, ms] of UNITS) {
    const value = Math.floor(diff / ms);
    if (value >= 1) return `${value}${unit} ago`;
  }

  return "just now";
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + "\u2026";
}

export function generateExcerpt(
  text: string,
  maxLength: number = 200
): string {
  // Strip markdown-like formatting
  const plain = text
    .replace(/[#*_~`>]/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\n+/g, " ")
    .trim();
  return truncateText(plain, maxLength);
}
