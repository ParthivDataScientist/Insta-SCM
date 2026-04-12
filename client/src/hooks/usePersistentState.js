import { useEffect, useState } from 'react';

function readInitialValue(key, initialValue) {
    if (typeof window === 'undefined') {
        return typeof initialValue === 'function' ? initialValue() : initialValue;
    }

    try {
        const raw = window.localStorage.getItem(key);
        if (raw == null) {
            return typeof initialValue === 'function' ? initialValue() : initialValue;
        }
        return JSON.parse(raw);
    } catch {
        return typeof initialValue === 'function' ? initialValue() : initialValue;
    }
}

export function usePersistentState(key, initialValue) {
    const [value, setValue] = useState(() => readInitialValue(key, initialValue));

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        window.localStorage.setItem(key, JSON.stringify(value));
    }, [key, value]);

    return [value, setValue];
}
