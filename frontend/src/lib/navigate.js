/** Thin wrapper around window.location.assign — mockable in tests. */
export const navigateToUrl = (url) => window.location.assign(url);
