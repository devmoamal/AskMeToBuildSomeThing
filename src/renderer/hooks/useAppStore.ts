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
  AgentStreamEvent,
  MessagePart
} from '../../shared/types'
import type { QuestionnairePayload } from '../../shared/schemas'

export function useAppStore() {
  const [activeTab, setActiveTab] = useState<'chats' | 'projects'>('projects')
  const [chats, setChats] = useState<Chat[]>([])
  const [chatGroups, setChatGroups] = useState<ChatGroup[]>([])
  const [activeChatId, setActiveChatId] = useState<string | null>(null)

  const [projects, setProjects] = useState<Project[]>([])
  const [activeProjectId, setActiveProjectId] = useState<string>('__no_project__')
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
  const [promptDraft, setPromptDraft] = useState<string | null>(null)

  const [generatingSessionIds, setGeneratingSessionIds] = useState<Set<string>>(new Set())
  const generatingSessionIdsRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    generatingSessionIdsRef.current = generatingSessionIds
  }, [generatingSessionIds])

  const [selectedModels, setSelectedModels] = useState<Record<string, { providerId: string; model: string }>>({})
  const [activeQuestionnaires, setActiveQuestionnaires] = useState<Record<string, {
    toolCallId: string
    payload: QuestionnairePayload
  }>>({})
  const [activeApprovals, setActiveApprovals] = useState<Record<string, {
    toolCallId: string
    toolName: string
    args: any
  }>>({})

  const isGenerating = Boolean(activeSessionId && generatingSessionIds.has(activeSessionId))
  const activeQuestionnaire = activeSessionId ? (activeQuestionnaires[activeSessionId] || null) : null
  const activeApproval = activeSessionId ? (activeApprovals[activeSessionId] || null) : null

  const activeSessionIdRef = useRef<string | null>(activeSessionId)
  useEffect(() => {
    activeSessionIdRef.current = activeSessionId
  }, [activeSessionId])

  const messagesRef = useRef<Message[]>(messages)
  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  const sessionBuffersRef = useRef<Map<string, Message[]>>(new Map())

  const isInitializedRef = useRef(false)

  const activeTargetId = activeSessionId
  const currentThreadModel = activeTargetId ? selectedModels[activeTargetId] : undefined

  const setSelectedModel = (providerId: string, model: string) => {
    if (!activeSessionId) return
    setSelectedModels(prev => ({
      ...prev,
      [activeSessionId]: { providerId, model }
    }))
  }

  // Load all initial state
  const loadState = useCallback(async () => {
    if (!window.api) {
      console.warn('window.api is not defined')
      return
    }
    try {
      const [fetchedProviders, fetchedSettings, fetchedProjects] = await Promise.all([
        window.api.providers.getAll(),
        window.api.settings.get(),
        window.api.projects.getAll()
      ])

      setProviders(fetchedProviders)
      setSettings(fetchedSettings)
      setProjects(fetchedProjects)

      // Guard: If no providers exist, open onboarding modal!
      if (fetchedProviders.length === 0) {
        setIsOnboardingOpen(true)
      }

      if (!isInitializedRef.current) {
        isInitializedRef.current = true
        setActiveProjectId('__no_project__')
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
    if (!activeSessionId) {
      setMessages([])
      setCanvases([])
      return
    }

    if (sessionBuffersRef.current.has(activeSessionId)) {
      setMessages(sessionBuffersRef.current.get(activeSessionId)!)
    } else {
      window.api.projects.getMessages(activeSessionId).then((msgs) => {
        if (activeSessionIdRef.current === activeSessionId) {
          setMessages(msgs)
          sessionBuffersRef.current.set(activeSessionId, msgs)
        }
      })
    }

    window.api.projects.getCanvases(activeSessionId).then((cvs) => {
      if (activeSessionIdRef.current === activeSessionId) {
        setCanvases(cvs)
      }
    })
  }, [activeSessionId])

  // Listen to streaming IPC events from AgentRunner
  useEffect(() => {
    if (!window.api) return
    const unsubscribe = window.api.agent.onStreamEvent((event: AgentStreamEvent) => {
      const targetId = event.targetId
      if (!targetId) return

      if (event.type === 'chunk') {
        const buffer = sessionBuffersRef.current.get(targetId) || (targetId === activeSessionIdRef.current ? [...messagesRef.current] : [])
        const last = buffer[buffer.length - 1]
        let updatedBuffer: Message[]

        if (last && last.role === 'assistant') {
          const existingParts: MessagePart[] = last.parts ? last.parts.map(p => ({ ...p })) : []
          const textPartIdx = existingParts.findIndex(p => p.type === 'text')
          if (textPartIdx !== -1) {
            const currentPart = existingParts[textPartIdx] as { type: 'text'; text: string }
            existingParts[textPartIdx] = { type: 'text', text: currentPart.text + event.text }
          } else {
            existingParts.push({ type: 'text', text: event.text })
          }
          updatedBuffer = [
            ...buffer.slice(0, -1),
            {
              ...last,
              content: last.content + event.text,
              parts: existingParts
            }
          ]
        } else {
          updatedBuffer = [
            ...buffer,
            {
              id: `streaming_${Date.now()}`,
              projectSessionId: targetId,
              role: 'assistant',
              content: event.text,
              parts: [{ type: 'text', text: event.text }],
              createdAt: Date.now()
            }
          ]
        }

        sessionBuffersRef.current.set(targetId, updatedBuffer)
        if (targetId === activeSessionIdRef.current) {
          setMessages(updatedBuffer)
        }
      } else if (event.type === 'tool_call_start') {
        if (event.call.status === 'requires_approval') {
          setActiveApprovals(prev => ({
            ...prev,
            [targetId]: {
              toolCallId: event.call.id,
              toolName: event.call.toolName,
              args: event.call.args
            }
          }))
        }

        const buffer = sessionBuffersRef.current.get(targetId) || (targetId === activeSessionIdRef.current ? [...messagesRef.current] : [])
        const last = buffer[buffer.length - 1]
        const existingTools = last?.toolCalls ? [...last.toolCalls] : []
        const updatedTools = existingTools.some(t => t.id === event.call.id)
          ? existingTools.map(t => t.id === event.call.id ? event.call : t)
          : [...existingTools, event.call]

        let updatedBuffer: Message[]
        if (last && last.role === 'assistant') {
          const existingParts: MessagePart[] = last.parts ? last.parts.map(p => ({ ...p })) : []
          const existingPartIdx = existingParts.findIndex(
            p => p.type === 'tool_call' && p.toolCall.id === event.call.id
          )
          if (existingPartIdx !== -1) {
            existingParts[existingPartIdx] = { type: 'tool_call', toolCall: event.call }
          } else {
            existingParts.push({ type: 'tool_call', toolCall: event.call })
          }
          updatedBuffer = [
            ...buffer.slice(0, -1),
            {
              ...last,
              toolCalls: updatedTools,
              parts: existingParts
            }
          ]
        } else {
          updatedBuffer = [
            ...buffer,
            {
              id: `streaming_${Date.now()}`,
              projectSessionId: targetId,
              role: 'assistant',
              content: '',
              toolCalls: [event.call],
              parts: [{ type: 'tool_call', toolCall: event.call }],
              createdAt: Date.now()
            }
          ]
        }

        sessionBuffersRef.current.set(targetId, updatedBuffer)
        if (targetId === activeSessionIdRef.current) {
          setMessages(updatedBuffer)
        }
      } else if (event.type === 'tool_call_stream') {
        const buffer = sessionBuffersRef.current.get(targetId) || (targetId === activeSessionIdRef.current ? [...messagesRef.current] : [])
        const last = buffer[buffer.length - 1]
        if (last) {
          const updatedTools = last.toolCalls?.map(tc => {
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
          const updatedParts = last.parts?.map(p => {
            if (p.type === 'tool_call' && p.toolCall.id === event.id) {
              return {
                ...p,
                toolCall: {
                  ...p.toolCall,
                  result: {
                    ...(p.toolCall.result || {}),
                    stdout: ((p.toolCall.result?.stdout || '') + event.chunk)
                  }
                }
              }
            }
            return p
          })
          const updatedBuffer = [
            ...buffer.slice(0, -1),
            { ...last, toolCalls: updatedTools, parts: updatedParts }
          ]
          sessionBuffersRef.current.set(targetId, updatedBuffer)
          if (targetId === activeSessionIdRef.current) {
            setMessages(updatedBuffer)
          }
        }
      } else if (event.type === 'tool_call_done') {
        setActiveApprovals(prev => {
          if (prev[targetId]?.toolCallId === event.id) {
            const next = { ...prev }
            delete next[targetId]
            return next
          }
          return prev
        })

        const buffer = sessionBuffersRef.current.get(targetId) || (targetId === activeSessionIdRef.current ? [...messagesRef.current] : [])
        const last = buffer[buffer.length - 1]
        if (last) {
          const updatedTools = last.toolCalls?.map(tc =>
            tc.id === event.id ? { ...tc, status: event.status, result: event.result } : tc
          )
          const updatedParts = last.parts?.map(p => {
            if (p.type === 'tool_call' && p.toolCall.id === event.id) {
              return {
                ...p,
                toolCall: {
                  ...p.toolCall,
                  status: event.status,
                  result: event.result
                }
              }
            }
            return p
          })
          const updatedBuffer = [
            ...buffer.slice(0, -1),
            { ...last, toolCalls: updatedTools, parts: updatedParts }
          ]
          sessionBuffersRef.current.set(targetId, updatedBuffer)
          if (targetId === activeSessionIdRef.current) {
            setMessages(updatedBuffer)
          }
        }
      } else if (event.type === 'pause_for_user') {
        setActiveQuestionnaires(prev => ({
          ...prev,
          [targetId]: {
            toolCallId: event.toolCallId,
            payload: event.questionnaire
          }
        }))
      } else if (event.type === 'canvas_created') {
        if (targetId === activeSessionIdRef.current) {
          setCanvases(prev => {
            const filtered = prev.filter(c => c.id !== event.canvas.id)
            return [event.canvas, ...filtered]
          })
          setActiveCanvas(event.canvas)
        }
      } else if (event.type === 'title_generated') {
        setProjectSessions(prev => prev.map(s => s.id === event.targetId ? { ...s, title: event.title } : s))
      } else if (event.type === 'done') {
        setGeneratingSessionIds(prev => {
          const next = new Set(prev)
          next.delete(targetId)
          return next
        })
        generatingSessionIdsRef.current.delete(targetId)

        setActiveQuestionnaires(prev => {
          if (!prev[targetId]) return prev
          const next = { ...prev }
          delete next[targetId]
          return next
        })
        setActiveApprovals(prev => {
          if (!prev[targetId]) return prev
          const next = { ...prev }
          delete next[targetId]
          return next
        })

        sessionBuffersRef.current.delete(targetId)

        if (targetId === activeSessionIdRef.current) {
          window.api.projects.getMessages(targetId).then(setMessages)
          window.api.projects.getCanvases(targetId).then((newCanvases) => {
            setCanvases(newCanvases)
            setActiveCanvas(curr => {
              if (!curr) return null
              const updated = newCanvases.find(c => c.id === curr.id)
              return updated || curr
            })
          })
        }
        // Always re-fetch settings so customize_app changes apply immediately
        window.api.settings.get().then(setSettings)
      } else if (event.type === 'error') {
        setGeneratingSessionIds(prev => {
          const next = new Set(prev)
          next.delete(targetId)
          return next
        })
        generatingSessionIdsRef.current.delete(targetId)

        setActiveQuestionnaires(prev => {
          if (!prev[targetId]) return prev
          const next = { ...prev }
          delete next[targetId]
          return next
        })
        setActiveApprovals(prev => {
          if (!prev[targetId]) return prev
          const next = { ...prev }
          delete next[targetId]
          return next
        })

        sessionBuffersRef.current.delete(targetId)

        if (targetId === activeSessionIdRef.current) {
          window.api.projects.getMessages(targetId).then(setMessages)
        }
      }
    })

    return () => {
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!window.api?.scheduler) return
    const unbind = window.api.scheduler.onTaskCompleted((task) => {
      if (activeSessionId && activeSessionId === task.targetId) {
        window.api.projects.getMessages(activeSessionId).then(setMessages)
      } else if (activeChatId && activeChatId === task.targetId) {
        window.api.chats.getMessages(activeChatId).then(setMessages)
      }
    })
    return unbind
  }, [activeSessionId, activeChatId])

  const selectProjectFolder = async () => {
    const folder = await window.api.projects.pickFolder()
    if (!folder) return
    const name = folder.split(/[/\\]/).filter(Boolean).pop() || 'Project'
    const newProject = await window.api.projects.save({
      id: `proj_${Date.now()}`,
      name,
      folderPath: folder
    })
    setProjects(prev => [newProject, ...prev])
    setActiveProjectId(newProject.id)
  }

  const createProjectSession = async (title = 'New Chat', targetProjId?: string) => {
    const projId = targetProjId || activeProjectId || '__no_project__'
    const newSession = await window.api.projects.saveSession({
      id: `sess_${Date.now()}`,
      projectId: projId,
      title
    })
    setProjectSessions(prev => [newSession, ...prev])
    setActiveProjectId(projId)
    setActiveSessionId(newSession.id)
    return newSession
  }

  const renameSession = async (sessionId: string, newTitle: string) => {
    const sess = projectSessions.find(s => s.id === sessionId)
    const pid = sess?.projectId || activeProjectId || '__no_project__'
    await window.api.projects.saveSession({ id: sessionId, projectId: pid, title: newTitle })
    setProjectSessions(prev => prev.map(s => s.id === sessionId ? { ...s, title: newTitle } : s))
  }

  const sendPrompt = async (
    text: string,
    attachments?: Array<{ name: string; path: string; isImage?: boolean }>
  ) => {
    let targetId = activeSessionId

    if (!targetId) {
      const projId = activeProjectId || '__no_project__'
      const newSessId = `sess_${Date.now()}`
      const createdSession = await window.api.projects.saveSession({
        id: newSessId,
        projectId: projId,
        title: 'New Chat'
      })
      setProjectSessions(prev => [createdSession, ...prev])
      setActiveSessionId(createdSession.id)
      targetId = createdSession.id
    }

    if (!targetId) return

    // Quick trigger: typing exactly /canvas creates starter canvas workspace immediately
    if (text.trim() === '/canvas' && (!attachments || attachments.length === 0)) {
      const starterContent = `# Canvas\n\n### Ideas\n- \n\n### Notes\n- \n\n### Tasks\n- [ ] \n\n### Code\n\`\`\`\n\n\`\`\`\n`
      const canvasId = `canvas_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
      const doc: CanvasDocument = {
        id: canvasId,
        projectSessionId: targetId,
        title: 'New Canvas',
        language: 'markdown',
        content: starterContent,
        version: 1,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
      const saved = await window.api.canvases.save(doc)
      setCanvases(prev => [saved, ...prev.filter(c => c.id !== saved.id)])
      setActiveCanvas(saved)
      return
    }

    let finalProvider = providers.find(p => p.id === currentThreadModel?.providerId)
    if (!finalProvider) {
      finalProvider = providers.find(p => p.isDefault) || providers[0]
    }
    if (!finalProvider) {
      setIsOnboardingOpen(true)
      return
    }

    const finalModel = currentThreadModel?.model || finalProvider.defaultModel || (finalProvider.models?.[0]) || 'default'

    let fullPrompt = text
    if (attachments && attachments.length > 0) {
      const fileContexts: string[] = []
      for (const att of attachments) {
        if (!att.isImage) {
          try {
            const content = await window.api.projects.readFile(att.path)
            fileContexts.push(`--- File: ${att.name} ---\n${content}\n--- End of File ---`)
          } catch {
            fileContexts.push(`--- File: ${att.name} (Binary or unreadable) ---`)
          }
        }
      }
      if (fileContexts.length > 0) {
        fullPrompt = `${text ? text + '\n\n' : ''}[Attached Context]:\n${fileContexts.join('\n\n')}`
      }
    }

    // Add user message optimistically to UI
    const optUserMsg: Message = {
      id: `msg_opt_${Date.now()}`,
      projectSessionId: targetId,
      role: 'user',
      content: text || (attachments ? `[Attached ${attachments.length} file(s)]` : ''),
      createdAt: Date.now()
    }

    const currentBuf = sessionBuffersRef.current.get(targetId) || (targetId === activeSessionIdRef.current ? messages : [])
    const nextBuf = [...currentBuf, optUserMsg]
    sessionBuffersRef.current.set(targetId, nextBuf)

    if (targetId === activeSessionIdRef.current) {
      setMessages(nextBuf)
    }

    setGeneratingSessionIds(prev => {
      const next = new Set(prev)
      next.add(targetId)
      return next
    })
    generatingSessionIdsRef.current.add(targetId)

    const isNoProj = !activeProjectId || activeProjectId === '__no_project__'
    const activeProj = isNoProj ? null : projects.find(p => p.id === activeProjectId)

    await window.api.agent.sendPrompt({
      mode: isNoProj ? 'chat' : 'project',
      targetId,
      projectFolder: activeProj?.folderPath,
      prompt: fullPrompt,
      providerId: finalProvider.id,
      model: finalModel
    })
  }

  const submitQuestionnaireAnswers = async (toolCallId: string, answers: Record<string, string | string[]>) => {
    await window.api.agent.submitUserResponse({ toolCallId, answers })
    setActiveQuestionnaires(prev => {
      const next = { ...prev }
      for (const [sessId, q] of Object.entries(next)) {
        if (q.toolCallId === toolCallId) delete next[sessId]
      }
      return next
    })
  }

  const approveTool = async (toolCallId: string, approved: boolean) => {
    setActiveApprovals(prev => {
      const next = { ...prev }
      for (const [sessId, a] of Object.entries(next)) {
        if (a.toolCallId === toolCallId) delete next[sessId]
      }
      return next
    })
    await window.api.agent.approveTool({ toolCallId, approved })
  }

  const abortGeneration = async (targetSessionId?: string) => {
    const targetId = targetSessionId || activeSessionId
    if (!targetId || !window.api) return
    await window.api.agent.abort(targetId)
    setGeneratingSessionIds(prev => {
      const next = new Set(prev)
      next.delete(targetId)
      return next
    })
    generatingSessionIdsRef.current.delete(targetId)
    setActiveQuestionnaires(prev => {
      const next = { ...prev }
      delete next[targetId]
      return next
    })
    setActiveApprovals(prev => {
      const next = { ...prev }
      delete next[targetId]
      return next
    })
    sessionBuffersRef.current.delete(targetId)
    if (targetId === activeSessionId) {
      window.api.projects.getMessages(targetId).then(setMessages)
    }
  }

  const createCanvasDocument = async (title = 'Untitled Canvas', content = '', language = 'markdown') => {
    if (!activeSessionId) return
    const doc: CanvasDocument = {
      id: `canvas_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      projectSessionId: activeSessionId,
      title,
      language,
      content,
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    const saved = await window.api.canvases.save(doc)
    setCanvases(prev => [saved, ...prev.filter(c => c.id !== saved.id)])
    setActiveCanvas(saved)
  }

  const applyCanvasAiAction = async (action: string, canvas: CanvasDocument) => {
    let promptText = ''
    switch (action) {
      case 'fix_grammar':
        promptText = `Please fix grammar and typos in canvas "${canvas.title}". Use make_canvas to update the canvas.`
        break
      case 'suggest_edits':
        promptText = `Please review and provide editorial improvements for canvas "${canvas.title}". Use make_canvas to update the canvas.`
        break
      case 'shorten':
        promptText = `Please make canvas "${canvas.title}" more concise and punchy without losing crucial details. Use make_canvas to update the canvas.`
        break
      case 'elaborate':
        promptText = `Please expand on canvas "${canvas.title}" with more comprehensive explanations, examples, and depth. Use make_canvas to update the canvas.`
        break
      case 'add_emojis':
        promptText = `Please enhance canvas "${canvas.title}" with clean visual structure, section emojis, and highlights. Use make_canvas to update the canvas.`
        break
      default:
        promptText = `Please improve canvas "${canvas.title}" based on: ${action}. Use make_canvas to update the canvas.`
    }
    await sendPrompt(promptText)
  }

  const rollbackToMessage = async (message: Message) => {
    const targetId = activeSessionId
    if (!targetId || !window.api) return

    if (generatingSessionIdsRef.current.has(targetId)) {
      await window.api.agent.abort(targetId)
      setGeneratingSessionIds(prev => {
        const next = new Set(prev)
        next.delete(targetId)
        return next
      })
      generatingSessionIdsRef.current.delete(targetId)
    }
    setActiveQuestionnaires(prev => {
      const next = { ...prev }
      delete next[targetId]
      return next
    })
    setActiveApprovals(prev => {
      const next = { ...prev }
      delete next[targetId]
      return next
    })
    sessionBuffersRef.current.delete(targetId)

    try {
      const result = await window.api.projects.rollback({ sessionId: targetId, messageId: message.id, deleteTargetMessage: true })
      setMessages(result.remainingMessages)
      sessionBuffersRef.current.set(targetId, result.remainingMessages)

      const updatedCanvases = await window.api.projects.getCanvases(targetId)
      setCanvases(updatedCanvases)
      setActiveCanvas(curr => {
        if (!curr) return null
        return updatedCanvases.find(c => c.id === curr.id) || null
      })

      setPromptDraft(message.content)
    } catch (err) {
      console.error('Failed to rollback message:', err)
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
    generatingSessionIds,
    activeQuestionnaire,
    activeApproval,
    createNewChat: (title?: string) => createProjectSession(title, '__no_project__'),
    createChatGroup: () => {},
    toggleGroupCollapse: () => {},
    renameChat: renameSession,
    renameSession,
    selectProjectFolder,
    createProjectSession,
    sendPrompt,
    submitQuestionnaireAnswers,
    approveTool,
    abortGeneration,
    createCanvasDocument,
    applyCanvasAiAction,
    currentThreadModel,
    setSelectedModel,
    promptDraft,
    setPromptDraft,
    rollbackToMessage,
    refreshState: loadState
  }
}
