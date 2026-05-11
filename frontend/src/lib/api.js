import axios from "axios";
import { useEffect } from "react";
import { useAuth } from "@clerk/clerk-react";

const API_URL = import.meta.env.VITE_API_URL || "https://slopit-api.fly.dev";


export const api = axios.create({
  baseURL: `${API_URL}/api/v1`,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});


function getCookie(name) {
  const match = document.cookie.match(
    new RegExp("(?:^|; )" + name + "=([^;]*)"),
  );
  return match ? decodeURIComponent(match[1]) : null;
}


api.interceptors.request.use((config) => {
  const safeMethods = ["get", "head", "options", "trace"];
  if (!safeMethods.includes((config.method ?? "get").toLowerCase())) {
    const csrf = getCookie("csrftoken");
    if (csrf) config.headers["X-CSRFToken"] = csrf;
  }
  return config;
});


export function useClerkInterceptor() {
  const { getToken } = useAuth();

  useEffect(() => {
    const id = api.interceptors.request.use(async (config) => {
      const token = await getToken();
      if (token) {
        config.headers["Authorization"] = `Bearer ${token}`;
      }
      return config;
    });
    return () => api.interceptors.request.eject(id);
  }, [getToken]);
}


export async function apiFetchWithToken(path, token, init = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  if (!res.ok) throw await res.json().catch(() => ({ error: res.statusText }));
  return res.json();
}
