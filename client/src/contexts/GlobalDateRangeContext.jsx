import React, { createContext, useCallback, useContext, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const GlobalDateRangeContext = createContext(null);

const parseDateRangeFromSearch = (search) => {
  const params = new URLSearchParams(search);
  return {
    start: params.get('startDate') || '',
    end: params.get('endDate') || '',
  };
};

export function GlobalDateRangeProvider({ children }) {
  const location = useLocation();
  const navigate = useNavigate();

  const dateRange = useMemo(
    () => parseDateRangeFromSearch(location.search),
    [location.search]
  );

  const setDateRange = useCallback((nextValue) => {
    const baseRange = parseDateRangeFromSearch(location.search);
    const nextRange = typeof nextValue === 'function' ? nextValue(baseRange) : nextValue;
    const params = new URLSearchParams(location.search);

    if (nextRange?.start) {
      params.set('startDate', nextRange.start);
    } else {
      params.delete('startDate');
    }

    if (nextRange?.end) {
      params.set('endDate', nextRange.end);
    } else {
      params.delete('endDate');
    }

    const search = params.toString();
    navigate(
      {
        pathname: location.pathname,
        search: search ? `?${search}` : '',
      },
      { replace: true }
    );
  }, [location.pathname, location.search, navigate]);

  const clearDateRange = useCallback(() => {
    setDateRange({ start: '', end: '' });
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
