// Debug configuration for development

export const DEBUG_MODE = import.meta.env.DEV;

export const MOCK_USER = {
  id: 1,
  username: 'debug_user',
  email: 'debug@frogger.com',
  avatar: '/frog.png',
  createdAt: new Date().toISOString()
};

export const DEBUG_OPTIONS = {
  // Enable debug logging
  enableLogging: true,

  // Show component boundaries
  showComponentBoundaries: false,

  // Enable mock authentication
  useMockAuth: false,

  // Show performance metrics
  showPerformanceMetrics: false,

  // Enable debug toolbar
  showDebugToolbar: true
};

// Debug logger utility
export const debugLog = (category, ...args) => {
  if (DEBUG_MODE && DEBUG_OPTIONS.enableLogging) {
    console.log(`[DEBUG - ${category}]`, ...args);
  }
};

// Mock session for debugging
export const getMockSession = () => {
  return {
    user: MOCK_USER,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  };
};
