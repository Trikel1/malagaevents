import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

type AppMode = 'eventos' | 'deportes';

interface AppModeContextType {
  appMode: AppMode;
  setAppMode: (mode: AppMode) => void;
}

const AppModeContext = createContext<AppModeContextType | undefined>(undefined);

export const AppModeProvider = ({ children }: { children: ReactNode }) => {
  const [appMode, setAppMode] = useState<AppMode>(() => {
    try {
      const stored = localStorage.getItem('appMode');
      return (stored === 'deportes' ? 'deportes' : 'eventos') as AppMode;
    } catch {
      return 'eventos';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('appMode', appMode);
    } catch {}
  }, [appMode]);

  return (
    <AppModeContext.Provider value={{ appMode, setAppMode }}>
      {children}
    </AppModeContext.Provider>
  );
};

export const useAppMode = () => {
  const ctx = useContext(AppModeContext);
  if (!ctx) throw new Error('useAppMode must be used within AppModeProvider');
  return ctx;
};
