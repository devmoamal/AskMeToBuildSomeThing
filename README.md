# AskMeToBuildSomeThing

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Runtime: Bun](https://img.shields.io/badge/Runtime-Bun-black?logo=bun)](https://bun.sh)
[![Electron: 44.x](https://img.shields.io/badge/Electron-44.x-47848F?logo=electron)](https://www.electronjs.org/)
[![React: 19.x](https://img.shields.io/badge/React-19.x-61DAFB?logo=react)](https://react.dev/)
[![Tailwind CSS: v4](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?logo=tailwindcss)](https://tailwindcss.com/)
[![ORM: Drizzle](https://img.shields.io/badge/ORM-Drizzle-C5F74F?logo=drizzle)](https://orm.drizzle.team/)
[![Validation: Zod v4](https://img.shields.io/badge/Validation-Zod_v4-3E67B1?logo=zod)](https://zod.dev/)

An agentic desktop environment combining natural language conversation, filesystem awareness, an interactive typeset canvas, human-in-the-loop questionnaires, and terminal automation.

---

## Overview

**AskMeToBuildSomeThing** provides a dual-workspace architecture tailored for both rapid conversational queries and deep, project-level agentic code execution:

1. **Chats Workspace**: Lightweight conversational threads organized into collapsible folder groups. Tools are restricted to interactive questionnaires (sk_user) and typeset markdown canvases (make_canvas).
2. **Projects Workspace**: Contextual filesystem agents mounted directly to local directories on your computer. Equipped with full agentic capabilities: filesystem reading/writing (
ead_file, create_file), terminal execution (use_terminal), canvas rendering, and questionnaires.

---

## Architectural Design

The application follows a strictly partitioned Electron architecture with context isolation and typed IPC channels:

`mermaid
flowchart TD
    subgraph Renderer ["Renderer Process (React 19 + Tailwind v4 + shadcn)"]
        UI[App Layout]
        ST[useAppStore]
        SB[Slide Tabs: Chats & Projects]
        CV[ChatView & Tool Cards]
        CM[Canvas Modal / Raw Editor]
        TD[Terminal Drawer]
        OD[Onboarding & Settings Modals]
    end

    subgraph Preload ["Preload Bridge (CommonJS / contextBridge)"]
        API[window.api]
    end

    subgraph Main ["Main Process (Electron + Node.js)"]
        IPC[IPC Dispatchers]
        AR[Agent Runner / Stream Orchestrator]
        TR[Tool Registry & Scope Validator]
        PR[Provider Adapters: OpenAI & Claude]
        SH[Cross-Platform Shell Runner]
        DB[(Local SQLite + Drizzle ORM)]
    end

    UI --> ST
    ST --> API
    API --> IPC
    IPC --> AR
    IPC --> DB
    AR --> TR
    AR --> PR
    TR --> SH
    TR --> DB
`

---

## Key Features

### 1. Dual-Scope Sidebar (Chats vs. Projects)
- **Chats Slide Tab**: Create, organize, and collapse chats into user-defined folder groups. Safe conversational sandbox without filesystem or shell access.
- **Projects Slide Tab**: Connect any folder on your device via native OS folder picker. Creates persistent multi-session threads tied directly to that directory.

### 2. Typeset Markdown Canvas (/canvas)
- Type /canvas into the chat input to invoke autocomplete.
- Interactive inline preview cards with instant copy, version tracking, and quick-expand actions.
- Full-screen modal with split view: Raw Markdown Editor with live edits and synchronized Typeset Preview.

### 3. Human-in-the-Loop Questionnaires (sk_user)
- The AI agent dynamically interrupts execution to solicit user feedback when facing architectural ambiguities or design trade-offs.
- Supports single-choice, multiple-choice, and open-ended text inputs.
- Agent generation pauses cleanly and automatically resumes once the user submits answers.

### 4. Interactive Terminal & Safety Guardrails
- Streaming stdout and stderr output cards directly within the chat message history.
- Collapsible bottom terminal drawer with persistent shell sessions.
- Shell configuration: supports PowerShell 7 / Windows PowerShell, CMD, Git Bash, and WSL on Windows, plus zsh/bash on macOS and Linux.
- Tool Safety Approvals: granular approval switches for terminal execution and file writing.

### 5. Multi-Provider LLM Engine
- **OpenAI-Compatible Adapter**: Connects to OpenAI, DeepSeek, OpenRouter, Groq, Ollama, LM Studio, or any OpenAI-format REST endpoint.
- **Anthropic Claude Adapter**: Direct SSE streaming with tool calling and prompt caching support.
- **Dynamic Model Fetching**: Query available models from providers on demand.
- **Mandatory Onboarding Wizard**: Guides initial configuration on first launch, preventing dead-ends.

---

## Tech Stack

| Component | Technology | Version | Rationale |
| :--- | :--- | :--- | :--- |
| **Runtime & PM** | [Bun](https://bun.sh/) | v1.4+ | Fast installs, zero-dependency testing, and script execution |
| **Shell Framework** | [Electron](https://www.electronjs.org/) | v44.4+ | Chromium + Node.js desktop shell with native OS integration |
| **Bundler** | [Vite](https://vite.dev/) | v8.3+ | Sub-second HMR with ite-plugin-electron |
| **UI Framework** | [React](https://react.dev/) | 19.x | Component state and reactive interface primitives |
| **Styling** | [Tailwind CSS](https://tailwindcss.com/) | v4.x | Next-gen engine using CSS theme variables and @import |
| **UI Primitives** | [Radix UI](https://www.radix-ui.com/) | Latest | Accessible dialog, popover, tabs, tooltip, and dropdown primitives |
| **Database** | 
ode:sqlite + [Drizzle ORM](https://orm.drizzle.team/) | v0.45+ | Zero-rebuild native SQLite with proxy adapter and WAL mode |
| **Schema Validation** | [Zod](https://zod.dev/) | v4.x | Type-safe runtime schemas across IPC and tool calls |

---

## Getting Started

### Prerequisites
- **Bun**: Install via powershell -c "irm bun.sh/install.ps1 | iex" (Windows) or curl -fsSL https://bun.sh/install | bash (macOS/Linux).
- Git.

### Installation
`ash
# Clone the repository
git clone https://github.com/your-username/AskMeToBuildSomeThing.git
cd AskMeToBuildSomeThing

# Install dependencies using Bun
bun install
`

### Running in Development Mode
`ash
# Starts Vite dev server and launches Electron with live reload
bun run dev
`

### Running Test Suites
`ash
# Runs all 16 automated unit test suites
bun test
`

---

## Production Builds & Packaging

The application uses electron-builder to package native installers and portable binaries.

### 1. Build Windows Release (Local)
```bash
# Generates Windows NSIS Installer in dist-release/
bun run build:release
```

### 2. Inspect Unpacked Release Directory
```bash
# Creates the unpacked executable without packaging for instant testing
bun run build:release:dir
```

### 3. First-Run Notes (SmartScreen & Gatekeeper)
Releases are built unsigned by default for open-source distribution:
- **Windows**: If Microsoft Defender SmartScreen displays a blue prompt, click **"More info" → "Run anyway"**.
- **macOS**: If Gatekeeper shows "unidentified developer", right-click the application and select **Open**, or run `xattr -cr /Applications/AskMeToBuildSomeThing.app` in Terminal.

### 4. Automated Multi-Platform Releases (GitHub Actions)
The included [`.github/workflows/release.yml`](.github/workflows/release.yml) automatically builds and attaches binaries to GitHub Releases when a version tag is pushed:

```bash
git tag v1.0.1
git push origin v1.0.1
```

GitHub Actions executes across a build matrix:
- **Windows**: `AskMeToBuildSomeThing-v1.0.1-win-x64.exe` (NSIS Installer)
- **macOS**: `AskMeToBuildSomeThing-v1.0.1-mac-arm64.dmg`, `.dmg` (x64), and `.zip`
- **Linux**: `AskMeToBuildSomeThing-v1.0.1-linux-x64.AppImage` & `.deb`

---

## Data & Security Architecture

1. **Local-First Storage**: All chat histories, project sessions, provider API keys, and settings are stored locally in SQLite (skmetobuildsomething.sqlite) in the OS user data folder:
   - Windows: %APPDATA%\askmetobuildsomething\
   - macOS: ~/Library/Application Support/askmetobuildsomething/
   - Linux: ~/.config/askmetobuildsomething/
2. **Context Isolation**: Renderer execution has zero direct Node.js API access. All interactions are typed through the window.api preload boundary.
3. **Execution Safety**: File modifications and terminal commands require user approval by default, unless explicitly enabled by the user in Settings.

---

## License

This project is licensed under the [MIT License](LICENSE).
