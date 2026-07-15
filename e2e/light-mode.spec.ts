import { test, expect } from '@playwright/test'
import { launchApp, closeApp, createSession, readDb, type LaunchedApp } from './helpers'

let ctx: LaunchedApp

test.beforeEach(async () => { ctx = await launchApp() })
test.afterEach(async () => { await closeApp(ctx) })

test('input bar toggle flips light mode on and off', async () => {
  const { page, userData } = ctx
  await createSession(page)

  await page.getByLabel('Switch to light mode').click()
  await expect(page.locator('html')).toHaveClass(/light/)

  await expect(() => {
    const db = readDb(userData) as { settings: { colorMode: string } }
    expect(db.settings.colorMode).toBe('light')
  }).toPass()

  await page.getByLabel('Switch to dark mode').click()
  await expect(page.locator('html')).not.toHaveClass(/light/)
})

test('app starts in dark mode by default', async () => {
  const { page } = ctx
  await expect(page.locator('html')).not.toHaveClass(/light/)
})
