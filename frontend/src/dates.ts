import {
  addDays,
  differenceInCalendarDays,
  endOfMonth,
  endOfWeek,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { pl } from "date-fns/locale";

export const WEEKDAYS_SHORT = ["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"];
export const WEEKDAYS_LONG = ["poniedziałek", "wtorek", "środa", "czwartek", "piątek", "sobota", "niedziela"];

export const toISO = (d: Date) => format(d, "yyyy-MM-dd");
export const fromISO = (s: string) => parseISO(s);
export const todayISO = () => toISO(new Date());
export const fmt = (d: Date | string, pattern: string) =>
  format(typeof d === "string" ? parseISO(d) : d, pattern, { locale: pl });
export const fmtLong = (s: string) => {
  const d = parseISO(s);
  if (isNaN(d.getTime())) return "";
  const out = format(d, "EEEE, d MMMM yyyy", { locale: pl });
  return out.charAt(0).toUpperCase() + out.slice(1);
};
export const daysFromToday = (s: string) => differenceInCalendarDays(parseISO(s), new Date());
export const weekdayIndex = (d: Date) => (d.getDay() + 6) % 7;

export const toMin = (t: string | null) => {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

export type CalMode = "month" | "week";

export function rangeFor(mode: CalMode, anchor: Date): { start: string; end: string; days: Date[] } {
  const start =
    mode === "month"
      ? startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 })
      : startOfWeek(anchor, { weekStartsOn: 1 });
  const end =
    mode === "month" ? endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 }) : endOfWeek(anchor, { weekStartsOn: 1 });
  const days: Date[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
  return { start: toISO(start), end: toISO(end), days };
}

export function relativeLabel(s: string) {
  const n = daysFromToday(s);
  if (n === 0) return "dziś";
  if (n === 1) return "jutro";
  if (n < 0) return `${-n} dni temu`;
  return `za ${n} dni`;
}
