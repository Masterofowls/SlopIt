const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default async function apiFetch(path, init) {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',          // sends/receives cookies for auth
    headers: {
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
  if (!res.ok) throw await res.json().catch(() => ({ error: res.statusText }));
  return res.json();

}