import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import "./Toast.css";

const ToastContext = createContext(null);

let _idCounter = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const dismiss = useCallback((id) => {
    clearTimeout(timers.current[id]);
    delete timers.current[id];
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (message, type = "success", duration = 3500) => {
      const id = ++_idCounter;
      setToasts((prev) => [...prev, { id, message, type }]);
      timers.current[id] = setTimeout(() => dismiss(id), duration);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ addToast, dismiss }}>
      {children}
      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used inside <ToastProvider>");
  }
  return ctx;
}

function ToastContainer({ toasts, dismiss }) {
  if (!toasts.length) return null;

  return (
    <div className="toast-container" aria-live="polite" aria-atomic="false">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast toast--${t.type}`}
          role="alert"
          onClick={() => dismiss(t.id)}
        >
          <span className="toast-prefix">
            {t.type === "error"
              ? "[ERROR]"
              : t.type === "warn"
                ? "[WARN]"
                : "[OK]"}
          </span>{" "}
          <span className="toast-message">{t.message}</span>
          <span className="toast-cursor">█</span>
        </div>
      ))}
    </div>
  );
}
