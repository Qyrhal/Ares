import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { launchApp, closeApp, type LaunchedApp } from './helpers'

const MERMAID_SOURCE = 'graph TD; Client-->Server; Server-->DB;'

function seedMermaidSession(userData: string): void {
  const now = Date.now()
  fs.writeFileSync(path.join(userData, 'ares-db.json'), JSON.stringify({
    sessions: [{
      id: 'seed-1', title: 'Diagram session', model: '',
      created_at: now, updated_at: now, message_count: 2, is_side_chat: false,
    }],
    messages: [
      {
        id: 'msg-1', session_id: 'seed-1', role: 'user', content: 'draw the architecture',
        attachments: null, tool_name: null, tool_status: null, tool_input: null,
        tool_output: null, thinking: null, reply_to: null, reactions: null, created_at: now - 1000,
      },
      {
        id: 'msg-2', session_id: 'seed-1', role: 'assistant',
        content: 'Here it is:\n\n```mermaid\n' + MERMAID_SOURCE + '\n```',
        attachments: null, tool_name: null, tool_status: null, tool_input: null,
        tool_output: null, thinking: null, reply_to: null, reactions: null, created_at: now,
      },
    ],
    todos: [], teamNotes: [],
    settings: { apiKey: '', apiBaseUrl: '', defaultModel: '', themeId: 'steel', colorMode: 'dark', systemPrompt: '', permissionMode: 'ask' },
    workspacePath: null, recentProjects: [], agentConfig: { skills: [], extensions: [], mcpServers: [], commands: [] },
  }))
}

let ctx: LaunchedApp

test.beforeEach(async () => { ctx = await launchApp(seedMermaidSession) })
test.afterEach(async () => { await closeApp(ctx) })

test('mermaid block renders as a live diagram with a preview/code toggle', async () => {
  const { page } = ctx

  // The real mermaid library renders the seeded block into an SVG
  const diagram = page.locator('svg[id^="mermaid-"]').first()
  await expect(diagram).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText('Client')).toBeVisible()

  // Toggle to raw source
  await page.getByRole('button', { name: 'Show mermaid source' }).click()
  await expect(page.getByText(MERMAID_SOURCE)).toBeVisible()
  await expect(diagram).toBeHidden()

  // And back to the rendered preview
  await page.getByRole('button', { name: 'Show rendered diagram' }).click()
  await expect(diagram).toBeVisible()
  await expect(page.getByText(MERMAID_SOURCE)).toBeHidden()
})
