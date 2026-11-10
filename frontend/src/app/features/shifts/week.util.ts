export const DAY_NAMES = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];

export interface WeekDay {
    date: string; // YYYY-MM-DD
    label: string;
    short: string; // dd/MM
}

export function parseDate(s: string): Date {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
}

export function formatDate(d: Date): string {
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
}

export function addDays(s: string, n: number): string {
    const d = parseDate(s);
    d.setDate(d.getDate() + n);
    return formatDate(d);
}

export function displayDate(s: string): string {
    const [y, m, d] = s.split('-');
    return `${d}/${m}/${y}`;
}

export function weekDays(start: string): WeekDay[] {
    return DAY_NAMES.map((label, i) => {
        const date = addDays(start, i);
        const [, m, d] = date.split('-');
        return { date, label, short: `${d}/${m}` };
    });
}

export const timeShort = (t: string) => (t ?? '').slice(0, 5);

export const slotKey = (date: string, ca: number) => `${date}|${ca}`;