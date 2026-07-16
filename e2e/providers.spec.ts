import { test, expect } from '@playwright/test'
import { launchApp, closeApp, readDb, type LaunchedApp } from './helpers'

let ctx: LaunchedApp

test.beforeEach(async () => {
  ctx = await launchApp()
  await ctx.page.getByTitle('Settings').click()
  await expect(ctx.page.getByRole('heading', { name: 'Settings' })).toBeVisible()
})
test.afterEach(async () => { await closeApp(ctx) })

test('adds two providers and both autosave to disk', async () => {
  const { page, userData } = ctx

  await page.getByRole('button', { name: 'Ollama', exact: true }).click()
  await page.getByRole('button', { name: 'Groq', exact: true }).click()

  await expect(page.getByDisplayValue('http://localhost:11434/v1')).toBeVisible()
  await expect(page.getByDisplayValue('https://api.groq.com/openai/v1')).toBeVisible()
  await expect(page.getByText('Saved', { exact: true })).toBeVisible()

  await expect(() => {
    const db = readDb(userData) as { settings: { providers: { id: string; baseUrl: string }[] } }
    expect(db.settings.providers).toHaveLength(2)
    expect(db.settings.providers[0].id).toBe('ollama')
    expect(db.settings.providers[1].id).toBe('groq')
  }).toPass()
})

test('removing a provider persists', async () => {
  const { page, userData } = ctx

  await page.getByRole('button', { name: 'Ollama', exact: true }).click()
  await page.getByRole('button', { name: 'Groq', exact: true }).click()
  await expect(page.getByText('Saved', { exact: true })).toBeVisible()

  await page.getByLabel('Remove Ollama').click()
  await expect(page.getByDisplayValue('http://localhost:11434/v1')).toHaveCount(0)

  await expect(() => {
    const db = readDb(userData) as { settings: { providers: { id: string }[] } }
    expect(db.settings.providers).toHaveLength(1)
    expect(db.settings.providers[0].id).toBe('groq')
  }).toPass()
})

test('provider survives app restart', async () => {
  const { page, userData } = ctx

  await page.getByRole('button', { name: 'LM Studio', exact: true }).click()
  await expect(page.getByText('Saved', { exact: true })).toBeVisible()
  await expect(() => {
    const db = readDb(userData) as { settings: { providers: { id: string }[] } }
    expect(db.settings.providers).toHaveLength(1)
  }).toPass()

  // Relaunch against the same userData
  await ctx.app.close()
  const { _electron } = await import('playwright')
  ctx.app = await _electron.launch({ args: ['.'], env: { ...process.env, ARES_USER_DATA: userData } })
  ctx.page = await ctx.app.firstWindow()
  await ctx.page.waitForLoadState('domcontentloaded')

  await ctx.page.getByTitle('Settings').click()
  await expect(ctx.page.getByDisplayValue('LM Studio')).toBeVisible()
  await expect(ctx.page.getByDisplayValue('http://localhost:1234/v1')).toBeVisible()
})
