import { useCallback } from 'react';
import { api } from '../lib/api';

/**
 * Returns thin wrappers around the shared axios instance.
 * Auth headers (Clerk Bearer + CSRF) are already attached by
 * useClerkInterceptor() which is mounted once in App.jsx.
 */
export function useProtectedApi() {
  const get = useCallback(
    (url, config = {}) => api.get(url, config).then((r) => r.data),
    [],
  );
  const post = useCallback(
    (url, data = {}, config = {}) =>
      api.post(url, data, config).then((r) => r.data),
    [],
  );
  const patch = useCallback(
    (url, data = {}, config = {}) =>
      api.patch(url, data, config).then((r) => r.data),
    [],
  );
  const del = useCallback(
    (url, config = {}) => api.delete(url, config).then((r) => r.data),
    [],
  );

  return { get, post, patch, del };
}
