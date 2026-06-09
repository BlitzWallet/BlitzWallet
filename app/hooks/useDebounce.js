import {useCallback, useEffect, useRef} from 'react';

function useDebounce(func, wait) {
  const debounceTimeout = useRef(null);

  const debouncedFunction = useCallback(
    (...args) => {
      clearTimeout(debounceTimeout.current);
      debounceTimeout.current = setTimeout(() => func(...args), wait);
    },
    [func, wait],
  );

  useEffect(() => {
    return () => {
      clearTimeout(debounceTimeout.current);
      debounceTimeout.current = null;
    };
  }, []);

  return debouncedFunction;
}

export default useDebounce;
