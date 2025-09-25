import { useState, useCallback, type Dispatch, type SetStateAction } from 'react';

function useLocalStorage<T>(key: string, initialValue: T): [T, Dispatch<SetStateAction<T>>] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(error);
      return initialValue;
    }
  });

  const setValue: Dispatch<SetStateAction<T>> = useCallback((value) => {
    try {
      const valueToStore = value instanceof Function ? (value as (prev: T) => T)(storedValue) : value;
      // Avoid unnecessary state updates and storage writes if nothing changed
      const prevStr = (() => { try { return JSON.stringify(storedValue); } catch { return undefined; } })();
      const nextStr = (() => { try { return JSON.stringify(valueToStore as any); } catch { return undefined; } })();
      if (prevStr === nextStr) return;

      setStoredValue(valueToStore);
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(key, nextStr ?? JSON.stringify(valueToStore as any));
        } catch (e) {
          console.error(e);
        }
      }
    } catch (error) {
      console.error(error);
    }
  }, [key, storedValue]);
  
  return [storedValue, setValue];
}

export default useLocalStorage;