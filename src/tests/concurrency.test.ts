import { describe, it, expect } from 'bun:test'
import type { AgentStreamEvent } from '../shared/types'
import { AgentRunner } from '../main/agent/runner'
import { initializeDatabase } from '../main/db/client'
import { dbQueries } from '../main/db/queries'

describe('Session Isolation and Multi-Thread Streaming Sandboxing', () => {
  it('should enforce targetId on all AgentStreamEvent variants', () => {
    const chunkEv: AgentStreamEvent = { type: 'chunk', text: 'hello', targetId: 'sess_1' }
    expect(chunkEv.targetId).toBe('sess_1')

    const doneEv: AgentStreamEvent = {
      type: 'done',
      targetId: 'sess_2',
      finalMessage: {
        id: 'msg_1',
        role: 'assistant',
        content: 'done',
        createdAt: Date.now()
      }
    }
    expect(doneEv.targetId).toBe('sess_2')

    const errorEv: AgentStreamEvent = { type: 'error', error: 'failed', targetId: 'sess_3' }
    expect(errorEv.targetId).toBe('sess_3')
  })

  it('should isolate error events with the exact targetId when no provider exists', async () => {
    initializeDatabase(':memory:')
    // Delete all providers in memory DB
    const existing = await dbQueries.getProviders()
    for (const p of existing) {
      await dbQueries.deleteProvider(p.id)
    }

    const collectedEvents: AgentStreamEvent[] = []

    const generator = AgentRunner.run(
      {
        mode: 'chat',
        targetId: 'session_target_alpha',
        prompt: 'test prompt',
        providerId: 'prov_nonexistent',
        model: 'default'
      },
      (ev) => {
        collectedEvents.push(ev)
      }
    )

    for await (const ev of generator) {
      expect(ev.targetId).toBe('session_target_alpha')
    }

    expect(collectedEvents.length).toBeGreaterThan(0)
    expect(collectedEvents[0].targetId).toBe('session_target_alpha')
    expect(collectedEvents[0].type).toBe('error')
  })

  it('should route concurrent event streams for different sessions without cross-contamination', () => {
    const sessionBuffers = new Map<string, string[]>()

    const routeEvent = (event: AgentStreamEvent) => {
      const target = event.targetId
      if (!sessionBuffers.has(target)) {
        sessionBuffers.set(target, [])
      }
      if (event.type === 'chunk') {
        sessionBuffers.get(target)!.push(event.text)
      }
    }

    // Simulate 5 simultaneous sessions firing interleaved chunks
    const sessionIds = ['sess_alpha', 'sess_beta', 'sess_gamma', 'sess_delta', 'sess_epsilon']

    for (let i = 0; i < 20; i++) {
      for (const id of sessionIds) {
        routeEvent({
          type: 'chunk',
          text: `[${id}:${i}]`,
          targetId: id
        })
      }
    }

    // Verify all 5 sessions maintained pure isolation
    for (const id of sessionIds) {
      const buffer = sessionBuffers.get(id)!
      expect(buffer.length).toBe(20)
      for (let i = 0; i < 20; i++) {
        expect(buffer[i]).toBe(`[${id}:${i}]`)
      }
    }
  })
})
