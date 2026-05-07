/** @type {import('jest').Config} */
const config = {
  testEnvironment: "jest-environment-jsdom",
  setupFilesAfterEnv: ["<rootDir>/__tests__/setup/jest.setup.js"],
  moduleNameMapper: {
    "\\.(css|less|scss|sass)$": "identity-obj-proxy",
    "\\.(png|jpg|jpeg|gif|svg|webp)$": "<rootDir>/__tests__/setup/fileMock.cjs",
  },
  transform: {
    "^.+\\.[jt]sx?$": "babel-jest",
  },
  testMatch: ["<rootDir>/__tests__/**/*.test.[jt]s?(x)"],
  collectCoverageFrom: ["src/**/*.{js,jsx}", "!src/main.jsx"],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
};

module.exports = config;
