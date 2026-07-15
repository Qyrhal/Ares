import { test, expect } from '@playwright/test'
import { launchApp, closeApp, readDb, type LaunchedApp } from './helpers'

let ctx: LaunchedApp

test.beforeEach(async () => {
  ctx = await launchApp()
  await ctx.page.getByTitle('Settings').click()
  await expect(ctx.page.getByRole('heading', { name: 'Settings' })).toBeVisible()
})
test.afterEach(async () => { await closeApp(ctx) })

test('settings page has no manual save button', async () => {
  const { page } = ctx
  await expect(page.getByText('Changes are saved automatically.')).toBeVisible()
  await expect(page.getByRole('button', { name: /Save settings/i })).toHaveCount(0)
})

test('editing the system prompt autosaves to disk', async () => {
  const { page, userData } = ctx
  const prompt = page.getByPlaceholder('You are a helpful coding assistant...')
  await prompt.fill('You are terse.')

  await expect(page.getByText('Saved', { exact: true })).toBeVisible()

  await expect(() => {
    const db = readDb(userData) as { settings: { systemPrompt: string } }
    expect(db.settings.systemPrompt).toBe('You are terse.')
  }).toPass()
})

test('changing the accent colour autosaves', async () => {
  const { page, userData } = ctx
  await page.getByTitle('Blue', { exact: true }).click()
  await expect(page.getByText('Saved', { exact: true })).toBeVisible()

  await expect(() => {
    const db = readDb(userData) as { settings: { themeId: string } }
    expect(db.settings.themeId).toBe('blue')
  }).toPass()
})

test('permission mode change autosaves', async () => {
  const { page, userData } = ctx
  await page.getByRole('button', { name: /YOLO/ }).click()
  await expect(page.getByText('Saved', { exact: true })).toBeVisible()

  await expect(() => {
    const db = readDb(userData) as { settings: { permissionMode: string } }
    expect(db.settings.permissionMode).toBe('yolo')
  }).toPass()
})

test('colour mode toggle switches to light and persists across restart', async () => {
  const { page, userData } = ctx
  await page.getByRole('button', { name: 'Light', exact: true }).click()

  await expect(page.locator('html')).toHaveClass(/light/)
  await expect(page.getByText('Saved', { exact: true })).toBeVisible()

  await expect(() => {
    const db = readDb(userData) as { settings: { colorMode: string } }
    expect(db.settings.colorMode).toBe('light')
  }).toPass()
})
