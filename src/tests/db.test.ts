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
})
