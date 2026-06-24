import { createContext, useCallback, useContext, useMemo, useState } from "react";
import PwaInstallDrawer from "./PwaInstallDrawer.jsx";
import { usePwaInstall } from "../../hooks/usePwaInstall.js";

const PwaInstallContext = createContext({
  canInstall: false,
  openDrawer: () => {},
});

export function PwaInstallProvider({ children }) {
  const installState = usePwaInstall();
  const [forcedOpen, setForcedOpen] = useState(false);

  const openDrawer = useCallback(() => {
    installState.resetDismiss();
    setForcedOpen(true);
  }, [installState]);

  const value = useMemo(
    () => ({
      canInstall: installState.canInstall,
      openDrawer,
    }),
    [installState.canInstall, openDrawer],
  );

  return (
    <PwaInstallContext.Provider value={value}>
      {children}
      <PwaInstallDrawer
        forcedOpen={forcedOpen}
        onForcedClose={() => setForcedOpen(false)}
        installState={installState}
      />
    </PwaInstallContext.Provider>
  );
}

export function usePwaInstallDrawer() {
  return useContext(PwaInstallContext);
}
