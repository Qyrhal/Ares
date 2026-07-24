import { describe, it, expect } from 'vitest'

/**
 * Standalone SSE parser — mirrors the exact logic in useAI.ts streamChatCompletion.
 * Extracted for unit testing the parsing algorithm without fetch/mock complexity.
 */
async function parseSseStream(
  chunks: string[],
): Promise<{ accumulated: string; usage?: { promptTokens?: number; completionTokens?: number } }> {
  const { ReadableStream } = globalThis as unknown as { ReadableStream: typeof globalThis.ReadableStream }
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk))
      }
      controller.close()
    },
  })

  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let accumulated = ''
  let buffer = ''
  let usage: { promptTokens?: number; completionTokens?: number } | undefined

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6).trim()
        if (data === '[DONE]') continue
        try {
          const json = JSON.parse(data)
          const content = json.choices?.[0]?.delta?.content ?? json.choices?.[0]?.text ?? ''
          if (content) {
            accumulated += content
          }
          if (json.usage) {
            usage = {
              promptTokens: json.usage.prompt_tokens ?? json.usage.promptTokens,
              completionTokens: json.usage.completion_tokens ?? json.usage.completionTokens,
            }
          }
        } catch {
          // Skip malformed SSE lines
        }
      }
    }
  }

  // Process remaining buffer (exact same logic as useAI.ts lines 177-193)
  if (buffer.startsWith('data: ')) {
    const data = buffer.slice(6).trim()
    if (data !== '[DONE]') {
      try {
        const json = JSON.parse(data)
        const content = json.choices?.[0]?.delta?.content ?? json.choices?.[0]?.text ?? ''
        if (content) accumulated += content
        if (json.usage) {
          usage = {
            promptTokens: json.usage.prompt_tokens ?? json.usage.promptTokens,
            completionTokens: json.usage.completion_tokens ?? json.usage.completionTokens,
          }
        }
      } catch { /* skip */ }
    }
  }

  return { accumulated, usage }
}

describe('SSE parsing algorithm — matches useAI.ts streamChatCompletion', () => {
  it('assembles multi-chunk streaming correctly', async () => {
    const result = await parseSseStream([
      'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":" world"}}]}\n\n',
      'data: [DONE]\n\n',
    ])
    expect(result.accumulated).toBe('Hello world')
    expect(result.usage).toBeUndefined()
  })

  it('[DONE] sentinel is skipped without crashing', async () => {
    const result = await parseSseStream([
      'data: {"choices":[{"delta":{"content":"first"}}]}\n\n',
      'data: [DONE]\n\n',
    ])
    expect(result.accumulated).toBe('first')
  })

  it('[DONE] does not stop processing in the same chunk', async () => {
    // [DONE] on its own line just does `continue`, lines after it in the same split ARE processed
    const result = await parseSseStream([
      'data: {"choices":[{"delta":{"content":"a"}}]}\n\ndata: [DONE]\n\ndata: {"choices":[{"delta":{"content":"b"}}]}\n\n',
    ])
    expect(result.accumulated).toBe('ab')
  })

  it('malformed JSON lines are skipped without crashing', async () => {
    const result = await parseSseStream([
      'data: {not valid json\n\n',
      'data: {"choices":[{"delta":{"content":"valid"}}]}\n\n',
      'data: [DONE]\n\n',
    ])
    expect(result.accumulated).toBe('valid')
  })

  it('usage tokens with snake_case keys are extracted', async () => {
    const result = await parseSseStream([
      'data: {"choices":[{"delta":{"content":"reply"}}],"usage":{"prompt_tokens":10,"completion_tokens":5}}\n\n',
      'data: [DONE]\n\n',
    ])
    expect(result.accumulated).toBe('reply')
    expect(result.usage).toEqual({ promptTokens: 10, completionTokens: 5 })
  })

  it('usage tokens with camelCase keys are extracted', async () => {
    const result = await parseSseStream([
      'data: {"choices":[{"delta":{"content":"ok"}}],"usage":{"promptTokens":3,"completionTokens":2}}\n\n',
      'data: [DONE]\n\n',
    ])
    expect(result.accumulated).toBe('ok')
    expect(result.usage).toEqual({ promptTokens: 3, completionTokens: 2 })
  })

  it('buffer split across chunks still produces correct text', async () => {
    // First chunk: incomplete JSON (split mid-content)
    // Second chunk: rest of JSON + newline + DONE
    const result = await parseSseStream([
      'data: {"choices":[{"delta":{"content":"hel',
      'lo"}}]}\n\ndata: [DONE]\n\n',
    ])
    expect(result.accumulated).toBe('hello')
  })

  it('remaining buffer without trailing newline is processed', async () => {
    // No trailing \n after last data line — stays in buffer after the loop
    const result = await parseSseStream([
      'data: {"choices":[{"delta":{"content":"final"}}]}\ndata: [DONE]',
    ])
    expect(result.accumulated).toBe('final')
  })

  it('remaining buffer [DONE] does not add content', async () => {
    const result = await parseSseStream([
      'data: {"choices":[{"delta":{"content":"real"}}]}\ndata: [DONE]',
    ])
    expect(result.accumulated).toBe('real')
  })

  it('empty content chunks do not affect accumulated text', async () => {
    const result = await parseSseStream([
      'data: {"choices":[{"delta":{"content":""}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"actual"}}]}\n\n',
      'data: [DONE]\n\n',
    ])
    expect(result.accumulated).toBe('actual')
  })

  it('non-data lines are ignored (SSE comments, events)', async () => {
    const result = await parseSseStream([
      ': ping\n\n',
      'data: {"choices":[{"delta":{"content":"ok"}}]}\n\n',
      'event: message\n\n',
      'id: 123\n\n',
      'data: [DONE]\n\n',
    ])
    expect(result.accumulated).toBe('ok')
  })

  it('legacy text field fallback (non-streaming API)', async () => {
    const result = await parseSseStream([
      'data: {"choices":[{"text":"legacy text"}]}\n\n',
      'data: [DONE]\n\n',
    ])
    expect(result.accumulated).toBe('legacy text')
  })

  it('no trailing [DONE] is handled gracefully', async () => {
    const result = await parseSseStream([
      'data: {"choices":[{"delta":{"content":"done"}}]}\n\n',
    ])
    expect(result.accumulated).toBe('done')
  })

  it('multiple usage chunks — last one wins', async () => {
    const result = await parseSseStream([
      'data: {"choices":[{"delta":{"content":"x"}}],"usage":{"prompt_tokens":1,"completion_tokens":1}}\n\n',
      'data: {"choices":[{"delta":{"content":"y"}}],"usage":{"prompt_tokens":2,"completion_tokens":2}}\n\n',
      'data: [DONE]\n\n',
    ])
    expect(result.accumulated).toBe('xy')
    expect(result.usage).toEqual({ promptTokens: 2, completionTokens: 2 })
  })

  it('empty stream returns empty string', async () => {
    const result = await parseSseStream([
      'data: [DONE]\n\n',
    ])
    expect(result.accumulated).toBe('')
    expect(result.usage).toBeUndefined()
  })

  it('multiple chunks in single read — partial line handling', async () => {
    // Two data lines arrive in a single read, split by the newline
    const result = await parseSseStream([
      'data: {"choices":[{"delta":{"content":"A"}}]}\n\ndata: {"choices":[{"delta":{"content":"B"}}]}\n\n',
    ])
    expect(result.accumulated).toBe('AB')
  })

  it('line without data: prefix is ignored', async () => {
    const result = await parseSseStream([
      'event: message\n',
      'data: {"choices":[{"delta":{"content":"ok"}}]}\n\n',
    ])
    expect(result.accumulated).toBe('ok')
  })

  it('data: with only whitespace after prefix is skipped', async () => {
    const result = await parseSseStream([
      'data:   \n\n',
      'data: {"choices":[{"delta":{"content":"ok"}}]}\n\n',
    ])
    expect(result.accumulated).toBe('ok')
  })

  it('real-world OpenAI-style streaming response', async () => {
    const result = await parseSseStream([
      'data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652288,"model":"gpt-4","choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null}]}\n\n',
      'data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652288,"model":"gpt-4","choices":[{"index":0,"delta":{"content":"The "},"finish_reason":null}]}\n\n',
      'data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652288,"model":"gpt-4","choices":[{"index":0,"delta":{"content":"answer "},"finish_reason":null}]}\n\n',
      'data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652288,"model":"gpt-4","choices":[{"index":0,"delta":{"content":"is "},"finish_reason":null}]}\n\n',
      'data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652288,"model":"gpt-4","choices":[{"index":0,"delta":{"content":"42."},"finish_reason":null}]}\n\n',
      'data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652288,"model":"gpt-4","choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":13,"completion_tokens":7}}\n\n',
      'data: [DONE]\n\n',
    ])
    expect(result.accumulated).toBe('The answer is 42.')
    expect(result.usage).toEqual({ promptTokens: 13, completionTokens: 7 })
  })
})
