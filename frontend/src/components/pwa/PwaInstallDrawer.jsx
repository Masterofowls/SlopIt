import { useEffect, useState } from "react";
import "./PwaInstallDrawer.css";

export default function PwaInstallDrawer({
  forcedOpen = false,
  onForcedClose,
  installState,
}) {
  const {
    canInstall,
    install,
    dismiss,
    installed,
    isIosSafari,
    hasNativePrompt,
  } = installState;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (forcedOpen && canInstall) {
      setOpen(true);
      return undefined;
    }
    if (canInstall) {
      const timer = window.setTimeout(() => setOpen(true), 1200);
      return () => window.clearTimeout(timer);
    }
    setOpen(false);
    return undefined;
  }, [canInstall, forcedOpen]);

  if (!open || installed) {
    return null;
  }

  const close = () => {
    setOpen(false);
    onForcedClose?.();
  };

  const handleInstall = async () => {
    const started = await install();
    if (started || isIosSafari) {
      close();
    }
  };

  const handleDismiss = () => {
    dismiss();
    close();
  };

  return (
    <div className="pwa-drawer" role="dialog" aria-labelledby="pwa-drawer-title">
      <button
        type="button"
        className="pwa-drawer__backdrop"
        aria-label="Dismiss install prompt"
        onClick={handleDismiss}
      />
      <div className="pwa-drawer__sheet">
        <div className="pwa-drawer__handle" aria-hidden="true" />
        <div className="pwa-drawer__icon-wrap">
          <img
            src="/icons/icon-192.png"
            alt=""
            className="pwa-drawer__icon"
            width={72}
            height={72}
          />
        </div>
        <h2 id="pwa-drawer-title" className="pwa-drawer__title">
          Install SlopIt
        </h2>
        <p className="pwa-drawer__body">
          Add SlopIt to your home screen for faster access, full-screen feed
          browsing, and one-tap sharing.
        </p>

        {isIosSafari && !hasNativePrompt ? (
          <ol className="pwa-drawer__steps">
            <li>Tap the Share button in Safari</li>
            <li>
              Select <strong>Add to Home Screen</strong>
            </li>
            <li>
              Tap <strong>Add</strong>
            </li>
          </ol>
        ) : null}

        <div className="pwa-drawer__actions">
          <button
            type="button"
            className="pwa-drawer__btn pwa-drawer__btn--primary"
            onClick={handleInstall}
          >
            {hasNativePrompt ? "Install app" : "Got it"}
          </button>
          <button
            type="button"
            className="pwa-drawer__btn pwa-drawer__btn--ghost"
            onClick={handleDismiss}
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
