import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import fs from 'fs'
import os from 'os'
import path from 'path'

export interface LaunchedApp {
  app: ElectronApplication
  page: Page
  userData: string
}

/** Launch the built app with an isolated temp userData dir. */
export async function launchApp(): Promise<LaunchedApp> {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'ares-e2e-'))
  const app = await electron.launch({
    args: ['.'],
    env: { ...process.env, ARES_USER_DATA: userData },
  })
  const page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  return { app, page, userData }
}

export async function closeApp({ app, userData }: LaunchedApp): Promise<void> {
  await app.close()
  fs.rmSync(userData, { recursive: true, force: true })
}

/** Read the JSON db the app persists to, from the isolated userData dir. */
export function readDb(userData: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.join(userData, 'ares-db.json'), 'utf8'))
}

/** Click "New session" from the empty state so the chat UI (InputBar etc.) mounts. */
export async function createSession(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'New session', exact: true }).first().click()
  await page.getByLabel('Send message').waitFor()
}
