import { test, expect } from '@playwright/test'
import { launchApp, closeApp, createSession, type LaunchedApp } from './helpers'

let ctx: LaunchedApp

test.beforeEach(async () => { ctx = await launchApp() })
test.afterEach(async () => { await closeApp(ctx) })

test('launches with the ARES title bar and empty state', async () => {
  const { page } = ctx
  await expect(page.getByText('ARES', { exact: true })).toBeVisible()
  await expect(page.getByText('Nothing open yet.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'New session', exact: true }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Open folder', exact: true }).first()).toBeVisible()
})

test('creates a new session and shows the chat input', async () => {
  const { page } = ctx
  await createSession(page)
  await expect(page.getByLabel('Send message')).toBeVisible()
  // Compact toolbar: chat/agent toggle, permission mode, and theme toggle all live in the input bar
  await expect(page.getByTitle('Chat mode — no tool execution, just Q&A')).toBeVisible()
  await expect(page.getByTitle('Agent mode — full autonomous execution with tools')).toBeVisible()
  await expect(page.getByLabel('Switch to light mode')).toBeVisible()
})

test('sends a chat message and receives the no-endpoint fallback reply', async () => {
  const { page } = ctx
  await createSession(page)

  const input = page.locator('textarea').first()
  await input.fill('hello ares')
  await input.press('Enter')

  await expect(page.getByText('hello ares').first()).toBeVisible()
  // With no API endpoint configured the app streams a built-in fallback message
  await expect(page.getByText(/No API endpoint configured/).first()).toBeVisible({ timeout: 20_000 })
})
