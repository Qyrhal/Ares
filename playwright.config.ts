import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  // Electron apps can't share a display sanely — run serially
  workers: 1,
  fullyParallel: false,
  reporter: [['list']],
  expect: { timeout: 10_000 },
})
