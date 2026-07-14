import { createContext, useContext, useState, type ReactNode } from 'react';

type AppMode = 'eventos' | 'deportes';

interface AppModeContextType {
  appMode: AppMode;
  setAppMode: (mode: AppMode) => void;
}

const AppModeContext = createContext<AppModeContextType | undefined>(undefined);

/**
 * AppMode is intentionally NOT persisted. It only scopes the Home page content
 * selector (Eventos/Deportes) and helper flags. It must never silently morph
 * routes like /events into sports content across sessions — dedicated routes
 * (/events, /sports, /venues) are the source of truth.
 */
export const AppModeProvider = ({ children }: { children: ReactNode }) => {
  const [appMode, setAppMode] = useState<AppMode>('eventos');

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
