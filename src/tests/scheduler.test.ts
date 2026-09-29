import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { dbQueries } from '../main/db/queries'
import { SchedulerManager } from '../main/scheduler/scheduler'
import type { ScheduledTask, ProjectMemory } from '../shared/types'

describe('Scheduler and Memory System', () => {
  it('should schedule and persist a background task', async () => {
    const task = await SchedulerManager.scheduleTask({
      targetId: 'test_session_123',
      mode: 'project',
      type: 'command',
      command: 'echo "hello from scheduler"',
      description: 'Test echo command',
      delaySeconds: 100
    })

    expect(task).toBeDefined()
    expect(task.id).toContain('task_')
    expect(task.description).toBe('Test echo command')
    expect(task.status).toBe('pending')
    expect(task.delaySeconds).toBe(100)

    const allTasks = await dbQueries.getScheduledTasks('test_session_123')
    const found = allTasks.find(t => t.id === task.id)
    expect(found).toBeDefined()
    expect(found?.command).toBe('echo "hello from scheduler"')

    // Clean up
    await SchedulerManager.cancelTask(task.id)
    const afterCancel = (await dbQueries.getScheduledTasks('test_session_123')).find(t => t.id === task.id)
    expect(afterCancel?.status).toBe('cancelled')
  })

  it('should immediately execute an expired or zero-delay command task', async () => {
    await dbQueries.saveChat({ id: 'test_session_immediate', title: 'Test Chat' })

    const task = await SchedulerManager.scheduleTask({
      targetId: 'test_session_immediate',
      mode: 'chat',
      type: 'command',
      command: 'echo "immediate execution"',
      description: 'Immediate echo',
      delaySeconds: 0
    })

    await SchedulerManager.executeTask(task.id)

    const updated = (await dbQueries.getScheduledTasks('test_session_immediate')).find(t => t.id === task.id)
    expect(updated?.status).toBe('completed')
    expect(updated?.result).toContain('immediate execution')
  }, 15000)

  it('should save, retrieve and delete project memories', async () => {
    const memory: ProjectMemory = {
      id: `mem_test_${Date.now()}`,
      projectId: 'proj_alpha',
      key: 'CodingConvention',
      content: 'Always prefer strict TypeScript and functional components.',
      category: 'architecture',
      updatedAt: Date.now()
    }

    await dbQueries.saveProjectMemory(memory)

    const retrieved = await dbQueries.getProjectMemories('proj_alpha')
    expect(retrieved.length).toBeGreaterThan(0)
    const found = retrieved.find(m => m.id === memory.id)
    expect(found).toBeDefined()
    expect(found?.key).toBe('CodingConvention')
    expect(found?.category).toBe('architecture')

    await dbQueries.deleteProjectMemory(memory.id)
    const afterDelete = await dbQueries.getProjectMemories('proj_alpha')
    expect(afterDelete.find(m => m.id === memory.id)).toBeUndefined()
  })
})
