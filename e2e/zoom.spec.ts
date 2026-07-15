import { test, expect } from '@playwright/test'
import { launchApp, closeApp, createSession, type LaunchedApp } from './helpers'

let ctx: LaunchedApp

test.beforeEach(async () => { ctx = await launchApp() })
test.afterEach(async () => { await closeApp(ctx) })

async function setZoom(factor: number): Promise<void> {
  await ctx.app.evaluate(({ BrowserWindow }, f) => {
    BrowserWindow.getAllWindows()[0].webContents.setZoomFactor(f)
  }, factor)
  await ctx.page.waitForTimeout(300)
}

/** Asserts the element is rendered inside the visible viewport, not clipped below it. */
async function expectOnScreen(label: string): Promise<void> {
  const el = ctx.page.getByLabel(label)
  await expect(el).toBeVisible()
  const box = await el.boundingBox()
  const viewportH = await ctx.page.evaluate(() => window.innerHeight)
  expect(box, `${label} should have a bounding box`).not.toBeNull()
  expect(box!.y + box!.height, `${label} should be within the ${viewportH}px viewport`).toBeLessThanOrEqual(viewportH + 1)
}

test('chat input stays on screen at 3x zoom on the empty state', async () => {
  await createSession(ctx.page)
  await setZoom(3)
  await expectOnScreen('Send message')
})

test('chat input stays on screen at 3x zoom with messages', async () => {
  const { page } = ctx
  await createSession(page)
  const input = page.locator('textarea').first()
  await input.fill('zoom test')
  await input.press('Enter')
  await expect(page.getByText(/No API endpoint configured/).first()).toBeVisible({ timeout: 20_000 })

  await setZoom(3)
  await expectOnScreen('Send message')
})

test('side chat input stays on screen at high zoom', async () => {
  const { page } = ctx
  await createSession(page)
  await page.getByLabel('New side chat').click()
  await expect(page.getByRole('textbox', { name: 'Side chat message' })).toBeVisible()

  await setZoom(2.5)
  await expectOnScreen('Send side chat message')
})

test('input returns to normal when zooming back out', async () => {
  await createSession(ctx.page)
  await setZoom(3)
  await setZoom(1)
  await expectOnScreen('Send message')
})
