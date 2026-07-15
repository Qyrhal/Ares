import { test, expect } from '@playwright/test'
import { launchApp, closeApp, createSession, type LaunchedApp } from './helpers'

let ctx: LaunchedApp

test.beforeEach(async () => {
  ctx = await launchApp()
  await createSession(ctx.page)
})
test.afterEach(async () => { await closeApp(ctx) })

test('opens a side chat pane with its own input', async () => {
  const { page } = ctx
  await page.getByLabel('New side chat').click()

  await expect(page.getByText('Side Chat', { exact: true })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Side chat message' })).toBeVisible()
  await expect(page.getByLabel('Send side chat message')).toBeVisible()
})

test('sends a message in the side chat and gets a streamed reply', async () => {
  const { page } = ctx
  await page.getByLabel('New side chat').click()

  const input = page.getByRole('textbox', { name: 'Side chat message' })
  await input.fill('side hello')
  await input.press('Enter')

  await expect(page.getByText('side hello').first()).toBeVisible()
  await expect(page.getByText(/No API endpoint configured/).first()).toBeVisible({ timeout: 20_000 })
})

test('side chat can be closed', async () => {
  const { page } = ctx
  await page.getByLabel('New side chat').click()
  await expect(page.getByRole('textbox', { name: 'Side chat message' })).toBeVisible()

  await page.getByLabel('Close side chat', { exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Side chat message' })).toHaveCount(0)
})
