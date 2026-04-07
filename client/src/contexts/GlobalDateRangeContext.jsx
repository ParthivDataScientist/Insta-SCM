import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const GlobalDateRangeContext = createContext(null);
const STORAGE_KEY = 'insta_global_date_range';

const EMPTY_RANGE = {
  start: '',
  end: '',
};

const normalizeDateRange = (value) => ({
  start: typeof value?.start === 'string' ? value.start : '',
  end: typeof value?.end === 'string' ? value.end : '',
});

const readStoredDateRange = () => {
  if (typeof window === 'undefined') {
    return EMPTY_RANGE;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return EMPTY_RANGE;
    }

    return normalizeDateRange(JSON.parse(raw));
  } catch {
    return EMPTY_RANGE;
  }
};

export function GlobalDateRangeProvider({ children }) {
  const [dateRange, setDateRangeState] = useState(readStoredDateRange);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(dateRange));
  }, [dateRange]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handleStorage = (event) => {
      if (event.key !== STORAGE_KEY) {
        return;
      }

      if (!event.newValue) {
        setDateRangeState(EMPTY_RANGE);
        return;
      }

      try {
        setDateRangeState(normalizeDateRange(JSON.parse(event.newValue)));
      } catch {
        setDateRangeState(EMPTY_RANGE);
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const setDateRange = useCallback((nextValue) => {
    setDateRangeState((current) =>
      normalizeDateRange(typeof nextValue === 'function' ? nextValue(current) : nextValue)
    );
  }, []);

  const clearDateRange = useCallback(() => {
    setDateRange(EMPTY_RANGE);
  }, [setDateRange]);

  const value = useMemo(
    () => ({
      dateRange,
      setDateRange,
      clearDateRange,
    }),
    [clearDateRange, dateRange, setDateRange]
  );

  return (
    <GlobalDateRangeContext.Provider value={value}>
      {children}
    </GlobalDateRangeContext.Provider>
  );
}

export function useGlobalDateRange() {
  const context = useContext(GlobalDateRangeContext);
  if (!context) {
    throw new Error('useGlobalDateRange must be used inside GlobalDateRangeProvider');
  }
  return context;
}
