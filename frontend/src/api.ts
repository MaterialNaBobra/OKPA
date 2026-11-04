const BASE = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api`;

export const TOKEN_KEY = "auth_token";

let token: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setApiToken(t: string | null) {
  token = t;
}
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(BASE + path, {
      method: opts.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new Error("Brak połączenia z internetem");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && token) onUnauthorized?.();
    const d = data?.detail;
    throw new Error(typeof d === "string" ? d : Array.isArray(d) ? "Sprawdź poprawność pól" : "Coś poszło nie tak");
  }
  return data as T;
}

export type User = { id: string; username: string; role: "user" | "admin"; active_group_id: string | null };
export type Group = { id: string; name: string; code: string; owner_id: string; member_ids: string[]; member_count: number };
export type Member = { id: string; username: string; role: string; color_index: number; is_owner: boolean };
export type Plan = {
  id: string;
  user_id: string;
  title: string;
  kind: "once" | "weekly";
  start_time: string;
  end_time: string;
  date: string | null;
  weekdays: number[];
  start_date: string | null;
  end_date: string | null;
  interval_weeks: number;
  note: string | null;
};
export type Occurrence = {
  source_id: string;
  user_id: string;
  title: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  type: "plan" | "meeting";
  kind: "once" | "weekly";
  all_day: boolean;
};
export type Meeting = {
  id: string;
  group_id: string;
  created_by: string;
  created_by_name: string;
  date: string;
  title: string;
  start_time: string | null;
  end_time: string | null;
  place: string | null;
  notes: string | null;
  rsvps: Record<string, "yes" | "no">;
};
export type FreeDay = { date: string; meeting: { id: string; title: string } | null };
