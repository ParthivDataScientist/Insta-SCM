export const formatDateTime = (dateStr: string | null | undefined): string | { datePart: string; timePart: string } => {
    if (!dateStr || ['TBD', '-', 'Unknown', 'Pending'].includes(dateStr)) return '-';
    try {
        const date = new Date(dateStr);
        if (Number.isNaN(date.getTime())) return dateStr;
        return {
            datePart: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            timePart: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
        };
    } catch (_) {
        return dateStr;
    }
};

export const formatStatusDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '';
    try {
        const date = new Date(dateStr);
        if (Number.isNaN(date.getTime())) return String(dateStr).slice(0, 10);
        return date
            .toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
            .replace(/\//g, '.');
    } catch (_) {
        return String(dateStr).slice(0, 10);
    }
};

export const parseComparableDate = (dateValue: string | null | undefined): Date | null => {
    const raw = String(dateValue ?? '').trim();
    if (!raw) return null;
    if (['TBD', '-', 'Unknown', 'Pending', 'NA', 'N/A', 'null', 'undefined'].includes(raw)) return null;

    const direct = Date.parse(raw);
    if (!Number.isNaN(direct)) {
        const date = new Date(direct);
        return new Date(date.getFullYear(), date.getMonth(), date.getDate());
    }

    const normalized = raw.replace(/\./g, '/').replace(/-/g, '/');
    const ddmmyyyy = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (ddmmyyyy) {
        const day = Number(ddmmyyyy[1]);
        const month = Number(ddmmyyyy[2]) - 1;
        const year = Number(ddmmyyyy[3]);
        const date = new Date(year, month, day);
        if (!Number.isNaN(date.getTime())) return date;
    }

    const yyyymmdd = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (yyyymmdd) {
        const year = Number(yyyymmdd[1]);
        const month = Number(yyyymmdd[2]) - 1;
        const day = Number(yyyymmdd[3]);
        const date = new Date(year, month, day);
        if (!Number.isNaN(date.getTime())) return date;
    }

    return null;
};

export const isUpcomingDate = (dateValue: string | null | undefined, windowDays: number = 20): boolean => {
    const targetDate = parseComparableDate(dateValue);
    if (!targetDate) return false;
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const end = new Date(start);
    end.setDate(end.getDate() + windowDays);
    return targetDate >= start && targetDate <= end;
};

export const formatShowDateDisplay = (showDateValue: string | null | undefined): string => {
    const raw = String(showDateValue ?? '').trim();
    if (!raw || ['TBD', '-', 'Unknown', 'Pending'].includes(raw)) return '-';

    const parsed = parseComparableDate(raw);
    if (!parsed) return raw;

    const day = String(parsed.getDate()).padStart(2, '0');
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const year = parsed.getFullYear();
    return `${day}.${month}.${year}`;
};
