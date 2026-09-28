import * as SecureStore from "expo-secure-store";
import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";

const DEMO_KEY = "seoully.mobile.demo-world.v1";

export function isDemoWorldAllowed() {
  return typeof __DEV__ !== "undefined" && __DEV__;
}

type DataModeContextValue = {
  demo: boolean;
  ready: boolean;
  setDemo: (next: boolean) => void;
};

const DataModeContext = createContext<DataModeContextValue | null>(null);

export function DataModeProvider({ children }: PropsWithChildren) {
  const allowed = isDemoWorldAllowed();
  const [demo, setDemoState] = useState(allowed);
  const [ready, setReady] = useState(!allowed);

  useEffect(() => {
    if (!allowed) return;
    let mounted = true;
    void SecureStore.getItemAsync(DEMO_KEY).then((stored) => {
      if (!mounted) return;
      setDemoState(stored !== "0");
      setReady(true);
    });
    return () => {
      mounted = false;
    };
  }, [allowed]);

  const value = useMemo<DataModeContextValue>(() => ({
    demo: allowed && demo,
    ready,
    setDemo: (next) => {
      if (!allowed) return;
      setDemoState(next);
      void SecureStore.setItemAsync(DEMO_KEY, next ? "1" : "0");
    },
  }), [allowed, demo, ready]);

  return <DataModeContext.Provider value={value}>{children}</DataModeContext.Provider>;
}

export function useDataMode() {
  const value = useContext(DataModeContext);
  if (!value) throw new Error("useDataMode must be used inside DataModeProvider");
  return value;
}
