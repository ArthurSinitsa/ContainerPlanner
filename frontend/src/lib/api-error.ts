export function extractApiErrorMessage(err: unknown, fallback: string) {
  if (!err) return fallback;
  const raw = err instanceof Error ? err.message : typeof err === "string" ? err : fallback;

  // Our api client formats: "API <status>: <body>"
  const match = raw.match(/^API\s+\d+:\s*(.*)$/s);
  const bodyText = match?.[1] ?? raw;

  try {
    const parsed = JSON.parse(bodyText) as unknown;
    if (parsed && typeof parsed === "object") {
      const anyParsed = parsed as Record<string, unknown>;
      const candidate =
        (typeof anyParsed.error === "string" && anyParsed.error) ||
        (typeof anyParsed.message === "string" && anyParsed.message) ||
        (typeof anyParsed.detail === "string" && anyParsed.detail) ||
        (typeof anyParsed.non_field_errors === "string" && anyParsed.non_field_errors);
      if (candidate) return candidate;
    }
  } catch {
    // ignore - body may not be JSON
  }

  return bodyText || fallback;
}

