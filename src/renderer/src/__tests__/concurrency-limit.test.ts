import { describe, it, expect } from 'vitest'

// Replicate the runWithConcurrency helper from pi.ts for testing
async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  limit: number,
): Promise<T[]> {
  const results: T[] = new Array(tasks.length)
  let nextIdx = 0

  async function worker() {
    while (nextIdx < tasks.length) {
      const idx = nextIdx++
      results[idx] = await tasks[idx]()
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, () => worker()))
  return results
}

describe('runWithConcurrency', () => {
  it('runs all tasks and returns results in order', async () => {
    const tasks = [
      async () => 1,
      async () => 2,
      async () => 3,
    ]
    const results = await runWithConcurrency(tasks, 5)
    expect(results).toEqual([1, 2, 3])
  })

  it('respects concurrency limit', async () => {
    let maxRunning = 0
    let running = 0

    const tasks = Array.from({ length: 10 }, (_, i) => async () => {
      running++
      maxRunning = Math.max(maxRunning, running)
      await new Promise((r) => setTimeout(r, 10))
      running--
      return i
    })

    const results = await runWithConcurrency(tasks, 3)
    expect(results).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
    expect(maxRunning).toBeLessThanOrEqual(3)
  })

  it('handles empty task list', async () => {
    const results = await runWithConcurrency([], 5)
    expect(results).toEqual([])
  })

  it('handles limit greater than task count', async () => {
    const tasks = [async () => 'a', async () => 'b']
    const results = await runWithConcurrency(tasks, 100)
    expect(results).toEqual(['a', 'b'])
  })

  it('handles limit of 1 (sequential execution)', async () => {
    const order: number[] = []
    const tasks = [
      async () => { order.push(1); return 1 },
      async () => { order.push(2); return 2 },
      async () => { order.push(3); return 3 },
    ]
    const results = await runWithConcurrency(tasks, 1)
    expect(results).toEqual([1, 2, 3])
    // With limit=1, tasks should run sequentially
    expect(order).toEqual([1, 2, 3])
  })

  it('preserves result order even when tasks complete out of order', async () => {
    const tasks = [
      async () => { await new Promise((r) => setTimeout(r, 30)); return 'slow' },
      async () => { await new Promise((r) => setTimeout(r, 10)); return 'fast' },
      async () => { await new Promise((r) => setTimeout(r, 20)); return 'medium' },
    ]
    const results = await runWithConcurrency(tasks, 3)
    expect(results).toEqual(['slow', 'fast', 'medium'])
  })

  it('propagates task errors', async () => {
    const tasks = [
      async () => 'ok',
      async () => { throw new Error('task failed') },
      async () => 'also ok',
    ]
    await expect(runWithConcurrency(tasks, 2)).rejects.toThrow('task failed')
  })
})
