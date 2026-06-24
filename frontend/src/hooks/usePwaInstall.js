import { useCallback, useEffect, useMemo, useState } from "react";

const DISMISS_KEY = "slopit_pwa_install_dismissed";

function isStandaloneMode() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

function isIosSafari() {
  const ua = window.navigator.userAgent;
  return /iPhone|iPad|iPod/i.test(ua) && /Safari/i.test(ua) && !/CriOS|FxiOS/i.test(ua);
}

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(DISMISS_KEY) === "1",
  );
  const [installed, setInstalled] = useState(isStandaloneMode);

  useEffect(() => {
    const onBeforeInstall = (event) => {
      event.preventDefault();
      setDeferredPrompt(event);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };
    const onDisplayMode = () => setInstalled(isStandaloneMode());

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    window.matchMedia("(display-mode: standalone)").addEventListener("change", onDisplayMode);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
      window.matchMedia("(display-mode: standalone)").removeEventListener("change", onDisplayMode);
    };
  }, []);

  const canInstall = useMemo(() => {
    if (installed || dismissed) return false;
    if (deferredPrompt) return true;
    return isIosSafari() && !installed;
  }, [deferredPrompt, dismissed, installed]);

  const install = useCallback(async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      return true;
    }
    return false;
  }, [deferredPrompt]);

  const dismiss = useCallback(() => {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }, []);

  const resetDismiss = useCallback(() => {
    localStorage.removeItem(DISMISS_KEY);
    setDismissed(false);
  }, []);

  return {
    canInstall,
    install,
    dismiss,
    resetDismiss,
    installed,
    isIosSafari: isIosSafari(),
    hasNativePrompt: Boolean(deferredPrompt),
  };
}
