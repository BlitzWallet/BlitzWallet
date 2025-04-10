import {
  createContext,
  useState,
  useContext,
  useEffect,
  useMemo,
  useCallback,
} from 'react';
import {getLocalStorageItem, setLocalStorageItem} from '../app/functions';

// Initiate context
const ThemeContextManager = createContext(null);

const GlobalThemeProvider = ({children}) => {
  const [theme, setTheme] = useState(null);
  const [darkModeType, setDarkModeType] = useState(null);

  const toggleDarkModeType = useCallback(param => {
    const mode = param ? 'dim' : 'lights-out';
    setLocalStorageItem('darkModeType', mode);
    setDarkModeType(param);
  }, []);

  const toggleTheme = useCallback(async param => {
    const mode = param ? 'light' : 'dark';
    setLocalStorageItem('colorScheme', mode);
    setTheme(param);
  }, []);

  useEffect(() => {
    (async () => {
      const [storedTheme, savedDarkMode] = await Promise.all([
        getLocalStorageItem('colorScheme'),
        getLocalStorageItem('darkModeType'),
      ]);
      const darkModeType =
        savedDarkMode === null ? true : savedDarkMode === 'dim';
      const theme = storedTheme === null ? false : storedTheme !== 'dark';

      toggleTheme(theme);
      toggleDarkModeType(darkModeType);
    })();
  }, []);

  const contextValue = useMemo(
    () => ({
      theme,
      toggleTheme,
      darkModeType,
      toggleDarkModeType,
    }),
    [theme, toggleTheme, darkModeType, toggleDarkModeType],
  );

  return (
    <ThemeContextManager.Provider value={contextValue}>
      {children}
    </ThemeContextManager.Provider>
  );
};

function useGlobalThemeContext() {
  const context = useContext(ThemeContextManager);
  if (!context) {
    throw new Error(
      'useGlobalThemeContext must be used within a GlobalThemeProvider',
    );
  }
  return context;
}

export {ThemeContextManager, GlobalThemeProvider, useGlobalThemeContext};
