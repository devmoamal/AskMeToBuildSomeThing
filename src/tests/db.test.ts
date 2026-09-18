import { describe, it, expect, beforeEach } from 'bun:test'
import { initializeDatabase } from '../main/db/client'
import { dbQueries } from '../main/db/queries'

describe('Database Queries and Schema', () => {
  beforeEach(() => {
    initializeDatabase(':memory:')
  })

  it('should save and retrieve providers', async () => {
    await dbQueries.saveProvider({
      id: 'prov_test_1',
      name: 'OpenAI Test',
      type: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-test-key',
      models: ['gpt-4o', 'gpt-4o-mini'],
      defaultModel: 'gpt-4o',
      isDefault: true,
      createdAt: Date.now()
    })

    const providers = await dbQueries.getProviders()
    expect(providers.length).toBe(1)
    expect(providers[0].name).toBe('OpenAI Test')
    expect(providers[0].models).toEqual(['gpt-4o', 'gpt-4o-mini'])
    expect(providers[0].isDefault).toBe(true)

    const defaultProv = await dbQueries.getDefaultProvider()
    expect(defaultProv?.id).toBe('prov_test_1')
  })

  it('should manage settings with Zod validation', async () => {
    const settings = await dbQueries.getSettings()
    expect(settings.theme).toBe('dark')
    expect(settings.defaultShell).toBe('powershell')
    expect(settings.autoApproveTerminal).toBe(false)

    const updated = await dbQueries.saveSettings({
      theme: 'light',
      autoApproveTerminal: true
    })
    expect(updated.theme).toBe('light')
    expect(updated.autoApproveTerminal).toBe(true)

    const reloaded = await dbQueries.getSettings()
    expect(reloaded.theme).toBe('light')
  })

  it('should handle chats and collapsible folder groups', async () => {
    await dbQueries.saveChatGroup({
      id: 'group_work',
      name: 'Work Tasks',
      orderIndex: 0,
      isCollapsed: false
    })

    await dbQueries.saveChat({
      id: 'chat_1',
      title: 'Brainstorm Project',
      groupId: 'group_work'
    })

    const groups = await dbQueries.getChatGroups()
    expect(groups.length).toBe(1)
    expect(groups[0].name).toBe('Work Tasks')

    const chats = await dbQueries.getChats()
    expect(chats.length).toBe(1)
    expect(chats[0].groupId).toBe('group_work')
  })

  it('should manage projects and multi-sessions', async () => {
    await dbQueries.saveProject({
      id: 'proj_1',
      name: 'My Cool App',
      folderPath: 'c:/projects/cool-app'
    })

    await dbQueries.saveProjectSession({
      id: 'session_1',
      projectId: 'proj_1',
      title: 'Feature Planning'
    })

    const projects = await dbQueries.getProjects()
    expect(projects.length).toBe(1)
    expect(projects[0].name).toBe('My Cool App')

    const sessions = await dbQueries.getProjectSessions('proj_1')
    expect(sessions.length).toBe(1)
    expect(sessions[0].title).toBe('Feature Planning')
  })

  it('should create and increment versions of canvases', async () => {
    await dbQueries.saveChat({
      id: 'chat_canvas_parent',
      title: 'Canvas Chat'
    })

    const v1 = await dbQueries.saveCanvas({
      id: 'canvas_arch',
      chatId: 'chat_canvas_parent',
      title: 'System Architecture',
      language: 'markdown',
      content: '# Architecture Overview\nMicroservices and queues.'
    })
    expect(v1.version).toBe(1)

    const v2 = await dbQueries.saveCanvas({
      id: 'canvas_arch',
      title: 'System Architecture v2',
      content: '# Architecture Overview v2\nEvent-driven architecture.'
    })
    expect(v2.version).toBe(2)
    expect(v2.content).toContain('Event-driven')
  })

  it('should rollback messages and subsequent canvases to a target message', async () => {
    await dbQueries.saveChat({ id: 'chat_rb', title: 'Rollback Test' })

    // Message 1 (user)
    await dbQueries.saveMessage({
      id: 'msg_1',
      chatId: 'chat_rb',
      role: 'user',
      content: 'Initial prompt',
      createdAt: 1000
    })

    // Message 2 (assistant)
    await dbQueries.saveMessage({
      id: 'msg_2',
      chatId: 'chat_rb',
      role: 'assistant',
      content: 'Assistant reply 1',
      createdAt: 2000
    })

    // Message 3 (user)
    await dbQueries.saveMessage({
      id: 'msg_3',
      chatId: 'chat_rb',
      role: 'user',
      content: 'Second prompt',
      createdAt: 3000
    })

    // Message 4 (assistant)
    await dbQueries.saveMessage({
      id: 'msg_4',
      chatId: 'chat_rb',
      role: 'assistant',
      content: 'Assistant reply 2',
      createdAt: 4000
    })

    // Canvas created during message 4
    await dbQueries.saveCanvas({
      id: 'canvas_rb_1',
      chatId: 'chat_rb',
      messageId: 'msg_4',
      title: 'Generated Canvas',
      content: 'Some canvas data'
    })

    // Test 1: Rollback to msg_3 without deleting target (rollback to here)
    const rb1 = await dbQueries.rollbackToMessage({
      targetId: 'chat_rb',
      messageId: 'msg_3',
      deleteTargetMessage: false
    })

    expect(rb1.deletedMessageIds).toEqual(['msg_4'])
    expect(rb1.remainingMessages.map(m => m.id)).toEqual(['msg_1', 'msg_2', 'msg_3'])

    // Canvas tied to msg_4 should be gone
    const canvasesRemaining = await dbQueries.getCanvases('chat_rb')
    expect(canvasesRemaining.length).toBe(0)

    // Test 2: Rollback and delete target message (rollback & edit)
    const rb2 = await dbQueries.rollbackToMessage({
      targetId: 'chat_rb',
      messageId: 'msg_3',
      deleteTargetMessage: true
    })

    expect(rb2.deletedMessageIds).toEqual(['msg_3'])
    expect(rb2.remainingMessages.map(m => m.id)).toEqual(['msg_1', 'msg_2'])
  })
})
