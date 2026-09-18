import { useState, useEffect, useCallback, useRef } from 'react'
import type {
  ProviderConfig,
  AppSettings,
  ChatGroup,
  Chat,
  Project,
  ProjectSession,
  Message,
  CanvasDocument,
  AgentStreamEvent
} from '../../shared/types'
import type { QuestionnairePayload } from '../../shared/schemas'

export function useAppStore() {
  const [activeTab, setActiveTab] = useState<'chats' | 'projects'>('chats')
  const [chats, setChats] = useState<Chat[]>([])
  const [chatGroups, setChatGroups] = useState<ChatGroup[]>([])
  const [activeChatId, setActiveChatId] = useState<string | null>(null)

  const [projects, setProjects] = useState<Project[]>([])
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  const [projectSessions, setProjectSessions] = useState<ProjectSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)

  const [messages, setMessages] = useState<Message[]>([])
  const [canvases, setCanvases] = useState<CanvasDocument[]>([])
  const [activeCanvas, setActiveCanvas] = useState<CanvasDocument | null>(null)

  const [providers, setProviders] = useState<ProviderConfig[]>([])
  const [settings, setSettings] = useState<AppSettings | null>(null)

  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false)
  const [activeCanvasModal, setActiveCanvasModal] = useState<CanvasDocument | null>(null)
  const [draftChatGroupId, setDraftChatGroupId] = useState<string | null>(null)

  const [isGenerating, setIsGenerating] = useState(false)
  const [selectedModels, setSelectedModels] = useState<Record<string, { providerId: string; model: string }>>({})
  const [activeQuestionnaire, setActiveQuestionnaire] = useState<{
    toolCallId: string
    payload: QuestionnairePayload
  } | null>(null)

  const isInitializedRef = useRef(false)

  const activeTargetId = activeTab === 'chats' ? activeChatId : activeSessionId
  const currentThreadModel = activeTargetId ? selectedModels[activeTargetId] : undefined

  const setSelectedModel = (providerId: string, model: string) => {
    const targetId = activeTab === 'chats' ? activeChatId : activeSessionId
    if (!targetId) return
    setSelectedModels(prev => ({
      ...prev,
      [targetId]: { providerId, model }
    }))
  }

  // Load all initial state
  const loadState = useCallback(async () => {
    if (!window.api) {
      console.warn('window.api is not defined')
      return
    }
    try {
      const [fetchedProviders, fetchedSettings, fetchedChats, fetchedGroups, fetchedProjects] = await Promise.all([
        window.api.providers.getAll(),
        window.api.settings.get(),
        window.api.chats.getAll(),
        window.api.chats.getGroups(),
        window.api.projects.getAll()
      ])

      setProviders(fetchedProviders)
      setSettings(fetchedSettings)
      setChats(fetchedChats)
      setChatGroups(fetchedGroups)
      setProjects(fetchedProjects)

      // Guard: If no providers exist, open onboarding modal!
      if (fetchedProviders.length === 0) {
        setIsOnboardingOpen(true)
      }

      // Default selection ONLY on very first boot (never overwrite activeChatId when in draft mode)
      if (!isInitializedRef.current) {
        isInitializedRef.current = true
        if (fetchedChats.length > 0) {
          setActiveChatId(fetchedChats[0].id)
        }
        if (fetchedProjects.length > 0) {
          setActiveProjectId(fetchedProjects[0].id)
        }
      }
    } catch (e) {
      console.error('Error loading initial app state:', e)
    }
  }, [])

  useEffect(() => {
    loadState()
  }, [loadState])

  // Load sessions when active project changes
  useEffect(() => {
    if (activeProjectId && window.api) {
      window.api.projects.getSessions(activeProjectId).then((sessions) => {
        setProjectSessions(sessions)
        if (sessions.length > 0) {
          setActiveSessionId(sessions[0].id)
        } else {
          setActiveSessionId(null)
        }
      })
    }
  }, [activeProjectId])

  // Load messages and canvases when active thread changes
  useEffect(() => {
    if (!window.api) return
    const targetId = activeTab === 'chats' ? activeChatId : activeSessionId
    if (!targetId) {
      setMessages([])
      setCanvases([])
      return
    }

    if (activeTab === 'chats') {
      window.api.chats.getMessages(targetId).then(setMessages)
      window.api.chats.getCanvases(targetId).then(setCanvases)
    } else {
      window.api.projects.getMessages(targetId).then(setMessages)
      window.api.projects.getCanvases(targetId).then(setCanvases)
    }
  }, [activeTab, activeChatId, activeSessionId])

  // Listen to streaming IPC events from AgentRunner
  useEffect(() => {
    if (!window.api) return
    const unsubscribe = window.api.agent.onStreamEvent((event: AgentStreamEvent) => {
      if (event.type === 'chunk') {
        setMessages(prev => {
          const last = prev[prev.length - 1]
          if (last && last.role === 'assistant') {
            return [
              ...prev.slice(0, -1),
              { ...last, content: last.content + event.text }
            ]
          } else {
            return [
              ...prev,
              {
                id: `streaming_${Date.now()}`,
                role: 'assistant',
                content: event.text,
                createdAt: Date.now()
              }
            ]
          }
        })
      } else if (event.type === 'tool_call_start') {
        setMessages(prev => {
          const last = prev[prev.length - 1]
          const existingTools = last?.toolCalls || []
          const updatedTools = existingTools.some(t => t.id === event.call.id)
            ? existingTools.map(t => t.id === event.call.id ? event.call : t)
            : [...existingTools, event.call]

          if (last && last.role === 'assistant') {
            return [...prev.slice(0, -1), { ...last, toolCalls: updatedTools }]
          } else {
            return [
              ...prev,
              {
                id: `streaming_${Date.now()}`,
                role: 'assistant',
                content: '',
                toolCalls: [event.call],
                createdAt: Date.now()
              }
            ]
          }
        })
      } else if (event.type === 'tool_call_stream') {
        setMessages(prev => {
          const last = prev[prev.length - 1]
          if (!last || !last.toolCalls) return prev
          return [
            ...prev.slice(0, -1),
            {
              ...last,
              toolCalls: last.toolCalls.map(tc => {
                if (tc.id === event.id) {
                  return {
                    ...tc,
                    result: {
                      ...(tc.result || {}),
                      stdout: ((tc.result?.stdout || '') + event.chunk)
                    }
                  }
                }
                return tc
              })
            }
          ]
        })
      } else if (event.type === 'tool_call_done') {
        setMessages(prev => {
          const last = prev[prev.length - 1]
          if (!last || !last.toolCalls) return prev
          return [
            ...prev.slice(0, -1),
            {
              ...last,
              toolCalls: last.toolCalls.map(tc =>
                tc.id === event.id ? { ...tc, status: event.status, result: event.result } : tc
              )
            }
          ]
        })
      } else if (event.type === 'pause_for_user') {
        setActiveQuestionnaire({
          toolCallId: event.toolCallId,
          payload: event.questionnaire
        })
      } else if (event.type === 'canvas_created') {
        setCanvases(prev => {
          const filtered = prev.filter(c => c.id !== event.canvas.id)
          return [event.canvas, ...filtered]
        })
      } else if (event.type === 'title_generated') {
        setChats(prev => prev.map(c => c.id === event.targetId ? { ...c, title: event.title } : c))
        setProjectSessions(prev => prev.map(s => s.id === event.targetId ? { ...s, title: event.title } : s))
      } else if (event.type === 'done') {
        setIsGenerating(false)
        setActiveQuestionnaire(null)
        // Refresh messages from db to ensure consistency
        const targetId = activeTab === 'chats' ? activeChatId : activeSessionId
        if (targetId) {
          if (activeTab === 'chats') {
            window.api.chats.getMessages(targetId).then(setMessages)
            window.api.chats.getCanvases(targetId).then(setCanvases)
          } else {
            window.api.projects.getMessages(targetId).then(setMessages)
            window.api.projects.getCanvases(targetId).then(setCanvases)
          }
        }
      } else if (event.type === 'error') {
        setIsGenerating(false)
        alert(`Agent error: ${event.error}`)
      }
    })

    return () => unsubscribe()
  }, [activeTab, activeChatId, activeSessionId])

  // Actions
  const createNewChat = (title = 'New Chat', groupId?: string | null) => {
    setActiveChatId(null)
    setDraftChatGroupId(groupId || null)
    setMessages([])
    setCanvases([])
  }

  const createChatGroup = async (name: string) => {
    const id = `group_${Date.now()}`
    await window.api.chats.saveGroup({ id, name })
    const updated = await window.api.chats.getGroups()
    setChatGroups(updated)
  }

  const toggleGroupCollapse = async (group: ChatGroup) => {
    await window.api.chats.saveGroup({ ...group, isCollapsed: !group.isCollapsed })
    const updated = await window.api.chats.getGroups()
    setChatGroups(updated)
  }

  const renameChat = async (chatId: string, newTitle: string) => {
    if (!newTitle.trim()) return
    const updated = await window.api.chats.save({ id: chatId, title: newTitle.trim() })
    setChats(prev => prev.map(c => c.id === chatId ? { ...c, title: updated.title } : c))
  }

  const renameSession = async (sessionId: string, newTitle: string) => {
    if (!newTitle.trim() || !activeProjectId) return
    const updated = await window.api.projects.saveSession({ id: sessionId, title: newTitle.trim(), projectId: activeProjectId })
    setProjectSessions(prev => prev.map(s => s.id === sessionId ? { ...s, title: updated.title } : s))
  }

  const selectProjectFolder = async () => {
    const folder = await window.api.projects.pickFolder()
    if (!folder) return
    const name = folder.split(/[\\/]/).filter(Boolean).pop() || 'Project'
    const id = `proj_${Date.now()}`
    const project = await window.api.projects.save({ id, name, folderPath: folder })

    // Create default session
    const sessionId = `sess_${Date.now()}`
    const session = await window.api.projects.saveSession({
      id: sessionId,
      projectId: project.id,
      title: 'General'
    })

    setProjects(prev => [project, ...prev.filter(p => p.id !== project.id)])
    setActiveProjectId(project.id)
    setProjectSessions([session])
    setActiveSessionId(session.id)
    setActiveTab('projects')
  }

  const createProjectSession = (title = 'New Chat') => {
    setActiveSessionId(null)
    setMessages([])
    setCanvases([])
  }

  const sendPrompt = async (
    text: string,
    attachments?: Array<{ name: string; path: string; isImage?: boolean }>
  ) => {
    let targetId = activeTab === 'chats' ? activeChatId : activeSessionId

    // Draft mode: initialize chat or project session on first send
    if (activeTab === 'chats' && !targetId) {
      const newChatId = `chat_${Date.now()}`
      const createdChat = await window.api.chats.save({ id: newChatId, title: 'New Chat', groupId: draftChatGroupId })
      setChats(prev => [createdChat, ...prev])
      setActiveChatId(createdChat.id)
      targetId = createdChat.id
    } else if (activeTab === 'projects' && !targetId && activeProjectId) {
      const newSessId = `sess_${Date.now()}`
      const createdSession = await window.api.projects.saveSession({
        id: newSessId,
        projectId: activeProjectId,
        title: 'New Chat'
      })
      setProjectSessions(prev => [createdSession, ...prev])
      setActiveSessionId(createdSession.id)
      targetId = createdSession.id
    }

    if (!targetId) return

    let finalProvider = providers.find(p => p.id === currentThreadModel?.providerId)
    let finalModel = currentThreadModel?.model

    if (!finalProvider) {
      finalProvider = providers.find(p => p.isDefault) || providers[0]
    }
    if (!finalProvider) {
      setIsOnboardingOpen(true)
      return
    }
    if (!finalModel) {
      finalModel = finalProvider.defaultModel || finalProvider.models[0] || 'default'
    }

    const activeProj = projects.find(p => p.id === activeProjectId)

    // If there are attachments, read them and append to the prompt context
    let fullPrompt = text
    if (attachments && attachments.length > 0) {
      const fileContexts: string[] = []
      for (const att of attachments) {
        if (!att.isImage && window.api?.projects?.readFile) {
          try {
            const content = await window.api.projects.readFile(att.path)
            fileContexts.push(`--- File: ${att.name} (${att.path}) ---\n${content}`)
          } catch {
            fileContexts.push(`--- Attached file: ${att.name} (${att.path}) ---`)
          }
        } else {
          fileContexts.push(`--- Attached image: ${att.name} (${att.path}) ---`)
        }
      }
      if (fileContexts.length > 0) {
        fullPrompt = `${text ? text + '\n\n' : ''}[Attached Context]:\n${fileContexts.join('\n\n')}`
      }
    }

    // Add user message optimistically to UI
    const optUserMsg: Message = {
      id: `msg_opt_${Date.now()}`,
      chatId: activeTab === 'chats' ? targetId : undefined,
      projectSessionId: activeTab === 'projects' ? targetId : undefined,
      role: 'user',
      content: text || (attachments ? `[Attached ${attachments.length} file(s)]` : ''),
      createdAt: Date.now()
    }
    setMessages(prev => [...prev, optUserMsg])
    setIsGenerating(true)

    await window.api.agent.sendPrompt({
      mode: activeTab === 'chats' ? 'chat' : 'project',
      targetId,
      projectFolder: activeTab === 'projects' ? activeProj?.folderPath : undefined,
      prompt: fullPrompt,
      providerId: finalProvider.id,
      model: finalModel
    })
  }

  const submitQuestionnaireAnswers = async (toolCallId: string, answers: Record<string, string | string[]>) => {
    await window.api.agent.submitUserResponse({ toolCallId, answers })
    setActiveQuestionnaire(null)
  }

  const approveTool = async (toolCallId: string, approved: boolean) => {
    await window.api.agent.approveTool({ toolCallId, approved })
  }

  const abortGeneration = async () => {
    const targetId = activeTab === 'chats' ? activeChatId : activeSessionId
    if (targetId) {
      await window.api.agent.abort(targetId)
      setIsGenerating(false)
    }
  }

  return {
    activeTab,
    setActiveTab,
    chats,
    chatGroups,
    activeChatId,
    setActiveChatId,
    projects,
    activeProjectId,
    setActiveProjectId,
    projectSessions,
    activeSessionId,
    setActiveSessionId,
    messages,
    canvases,
    activeCanvas,
    setActiveCanvas,
    providers,
    settings,
    isSettingsOpen,
    setIsSettingsOpen,
    isOnboardingOpen,
    setIsOnboardingOpen,
    activeCanvasModal,
    setActiveCanvasModal,
    isGenerating,
    activeQuestionnaire,
    createNewChat,
    createChatGroup,
    toggleGroupCollapse,
    renameChat,
    renameSession,
    selectProjectFolder,
    createProjectSession,
    sendPrompt,
    submitQuestionnaireAnswers,
    approveTool,
    abortGeneration,
    currentThreadModel,
    setSelectedModel,
    refreshState: loadState
  }
}
