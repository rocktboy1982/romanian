export function unwrapSupabase<T>(res: any): { data: T | null; error: any } {
  if (!res) return { data: null, error: new Error('no response') };
  const data = res?.data ?? null;
  const error = res?.error ?? null;
  return { data, error };
}

export function safeParse<T>(v: unknown): T | null {
  try {
    return v as T;
  } catch (e) {
    return null;
  }
}

/** Check if the app is running against a local Supabase instance */
export function isLocalSupabase(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  return url.includes('127.0.0.1') || url.includes('localhost') || !url
}
