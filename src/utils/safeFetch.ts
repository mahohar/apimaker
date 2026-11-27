export async function safeParseJson<T = unknown>(res: Response): Promise<T> {
  const raw = await res.text();
  const trimmed = raw.trimStart();
  if (!trimmed) {
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} (${res.statusText || 'Empty response'})`);
    }
    return {} as T;
  }
  if (trimmed.startsWith('<')) {
    throw new Error(
      `Server returned HTML instead of JSON (HTTP ${res.status}). Check that the API route URL is correct.`
    );
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(`Invalid JSON response (HTTP ${res.status}): ${trimmed.slice(0, 120)}`);
  }
}
