import { useEffect, useRef, useState, type FormEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowDown,
  ArrowUp,
  Bot,
  Check,
  ChevronDown,
  Code2,
  Github,
  LoaderCircle,
  MessageCircle,
  MessageSquareText,
  Mic,
  Plus,
  Sparkles,
  Square,
  Terminal,
  X,
  Youtube,
} from "lucide-react";
import { isAllowedBrowserUrl, resolveDirectBrowserRequest } from "./browser-actions.js";

type AssistantInfo = {
  id: "builder" | "reviewer";
  name: string;
  title: string;
  description: string;
  initials: string;
  color: string;
  model: string;
  status: string;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  activity?: AgentProgress[];
  actions?: ExternalAction[];
};

type HistoryTurn = {
  role: "user" | "assistant";
  content: string;
};

type AgentProgress = {
  phase: "inspect" | "plan" | "edit" | "check" | "external";
  summary: string;
};

type ExternalAction = {
  tool: string;
  summary: string;
  phase: string;
  url?: string;
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: {
    resultIndex: number;
    results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
  }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type RuntimeStatus = {
  provider: string;
  providerConnected: boolean;
  model: string;
  modelAvailable: boolean;
  workspaceAvailable: boolean;
  agentEnabled: boolean;
  message: string;
};

const assistantFallbacks: AssistantInfo[] = [
  {
    id: "builder",
    name: "Builder",
    title: "Dein Implementierungspartner",
    description: "Schreibt Code, setzt Features um und denkt an passende Tests.",
    initials: "B",
    color: "mint",
    model: "grok-4-1-fast",
    status: "ready",
  },
  {
    id: "reviewer",
    name: "Reviewer",
    title: "Code Review & Debugging",
    description: "Findet Bugs, erklärt Ursachen und hilft beim Debuggen.",
    initials: "R",
    color: "violet",
    model: "grok-4-1-fast",
    status: "ready",
  },
];

const suggestions = [
  { icon: Code2, text: "Hilf mir, eine saubere API zu entwerfen" },
  { icon: Terminal, text: "Finde den Bug in meinem Code" },
  { icon: Sparkles, text: "Schreib Tests für meine Funktion" },
];

const browserShortcuts = [
  { label: "YouTube", url: "https://www.youtube.com/", icon: Youtube },
  { label: "Discord", url: "https://discord.com/app", icon: MessageCircle },
];

function isExplicitOpenRequest(prompt: string): boolean {
  return Boolean(resolveDirectBrowserRequest(prompt)) ||
    /https:\/\/(?:www\.)?(?:youtube\.com|youtu\.be|discord\.com|discord\.gg)\//i.test(prompt);
}

function openShortcut(url: string) {
  if (!isAllowedBrowserUrl(url)) {
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

async function loadAssistants(): Promise<AssistantInfo[]> {
  const response = await fetch("/api/assistants");
  if (!response.ok) {
    throw new Error("Die Assistenten konnten nicht geladen werden.");
  }
  const payload = (await response.json()) as { assistants: AssistantInfo[] };
  return payload.assistants;
}

async function loadRuntimeStatus(): Promise<RuntimeStatus> {
  const response = await fetch("/api/health");
  if (!response.ok) {
    throw new Error("Der lokale Modellstatus konnte nicht geladen werden.");
  }
  return (await response.json()) as RuntimeStatus;
}

async function sendChat(
  assistantId: AssistantInfo["id"],
  prompt: string,
  history: HistoryTurn[],
  onDelta: (content: string) => void,
): Promise<string> {
  const response = await fetch("/api/chat/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ assistantId, prompt, history }),
  });
  if (!response.ok) {
    const payload = (await response.json()) as { error?: string };
    throw new Error(payload.error ?? "Die Nachricht konnte nicht gesendet werden.");
  }
  if (!response.body) {
    throw new Error("Der Browser unterstützt den Antwort-Stream nicht.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let answer = "";

  function processFrame(frame: string) {
    const data = frame.split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .join("\n");
    if (!data) {
      return;
    }

    const event = JSON.parse(data) as
      | { type: "delta"; content: string }
      | { type: "done" }
      | { type: "error"; error: string };
    if (event.type === "delta") {
      answer += event.content;
      onDelta(event.content);
    } else if (event.type === "error") {
      throw new Error(event.error);
    }
  }

  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const frames = buffer.split(/\r?\n\r?\n/);
      buffer = frames.pop() ?? "";
      for (const frame of frames) {
        processFrame(frame);
      }
      if (done) {
        if (buffer.trim()) {
          processFrame(buffer);
        }
        break;
      }
    }
  } finally {
    reader.releaseLock();
  }

  if (!answer) {
    throw new Error("Der Assistent hat keine Antwort zurückgegeben.");
  }
  return answer;
}

async function sendAgent(
  assistantId: AssistantInfo["id"],
  prompt: string,
  history: HistoryTurn[],
  onProgress: (progress: AgentProgress) => void,
): Promise<{ response: string; actions: ExternalAction[] }> {
  const response = await fetch("/api/agent/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ assistantId, prompt, history }),
  });

  if (!response.ok) {
    const payload = (await response.json()) as { error?: string };
    throw new Error(payload.error ?? "Der Coding-Auftrag konnte nicht gestartet werden.");
  }
  if (!response.body) {
    throw new Error("Der Browser unterstützt den Agenten-Stream nicht.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalResponse = "";
  let externalActions: ExternalAction[] = [];

  function processFrame(frame: string) {
    const data = frame.split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .join("\n");
    if (!data) {
      return;
    }

    const event = JSON.parse(data) as
      | { type: "progress"; progress: AgentProgress }
      | { type: "done"; response: string; actions?: ExternalAction[] }
      | { type: "error"; error: string };
    if (event.type === "progress") {
      onProgress(event.progress);
    } else if (event.type === "done") {
      finalResponse = event.response;
      externalActions = event.actions ?? [];
    } else {
      throw new Error(event.error);
    }
  }

  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const frames = buffer.split(/\r?\n\r?\n/);
      buffer = frames.pop() ?? "";
      for (const frame of frames) {
        processFrame(frame);
      }
      if (done) {
        if (buffer.trim()) {
          processFrame(buffer);
        }
        break;
      }
    }
  } finally {
    reader.releaseLock();
  }

  if (!finalResponse) {
    throw new Error("Der Agent hat keine Abschlussmeldung gesendet.");
  }
  return { response: finalResponse, actions: externalActions };
}

function makeMessage(role: Message["role"], content: string): Message {
  return { id: crypto.randomUUID(), role, content };
}

export default function App() {
  const [assistants, setAssistants] = useState(assistantFallbacks);
  const [selectedId, setSelectedId] = useState<AssistantInfo["id"]>("builder");
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [assistantLoadError, setAssistantLoadError] = useState("");
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeStatus>();
  const [autonomous, setAutonomous] = useState(false);
  const [agentProgress, setAgentProgress] = useState<AgentProgress[]>([]);
  const [listening, setListening] = useState(false);
  const [voiceNotice, setVoiceNotice] = useState("");
  const [copied, setCopied] = useState("");
  const scrollArea = useRef<HTMLDivElement>(null);
  const promptBox = useRef<HTMLTextAreaElement>(null);
  const speechRecognition = useRef<SpeechRecognitionLike | null>(null);
  const activeAssistant = assistants.find((assistant) => assistant.id === selectedId) ?? assistantFallbacks[0];
  const isEmpty = messages.length === 0;

  useEffect(() => {
    loadAssistants()
      .then(setAssistants)
      .catch(() => setAssistantLoadError("Die Verbindung zum lokalen API-Server ist gerade nicht verfügbar."));
    loadRuntimeStatus().then(setRuntimeStatus).catch(() => undefined);
  }, []);

  useEffect(() => {
    scrollArea.current?.scrollTo({ top: scrollArea.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  useEffect(() => {
    promptBox.current?.focus();
  }, []);

  function chooseAssistant(id: AssistantInfo["id"]) {
    setSelectedId(id);
    setMessages([]);
    setError("");
    setAgentProgress([]);
  }

  function resetChat() {
    setMessages([]);
    setError("");
    setDraft("");
    setAgentProgress([]);
    promptBox.current?.focus();
  }

  async function submitPrompt(value: string) {
    const prompt = value.trim();
    if (!prompt || busy) {
      return;
    }

    const directBrowserRequest = resolveDirectBrowserRequest(prompt);
    if (directBrowserRequest) {
      openShortcut(directBrowserRequest.url);
      setMessages((current) => [
        ...current,
        makeMessage("user", prompt),
        {
          ...makeMessage("assistant", directBrowserRequest.response),
          actions: [{
            tool: "open_website",
            summary: new URL(directBrowserRequest.url).hostname,
            phase: "external",
            url: directBrowserRequest.url,
          }],
        },
      ]);
      setDraft("");
      setError("");
      setAgentProgress([]);
      return;
    }

    const priorHistory = messages
      .map(({ role, content }) => ({ role, content: content.slice(-4_000) }))
      .slice(-8);
    const reservedTab = autonomous && isExplicitOpenRequest(prompt)
      ? window.open("about:blank", "_blank")
      : null;
    if (reservedTab) {
      reservedTab.opener = null;
    }
    setMessages((current) => [...current, makeMessage("user", prompt)]);
    setDraft("");
    setError("");
    setAgentProgress([]);
    setBusy(true);

    try {
      let answer: string;
      let completedActivity: AgentProgress[] = [];
      if (autonomous) {
        const steps: AgentProgress[] = [];
        setAgentProgress(steps);
        const result = await sendAgent(selectedId, prompt, priorHistory, (step) => {
          steps.push(step);
          setAgentProgress((current) => [...current, step]);
        });
        answer = result.response;
        completedActivity = steps;
        const websiteAction = result.actions.find((action) => action.tool === "open_website" && isAllowedBrowserUrl(action.url));
        if (websiteAction?.url && reservedTab && !reservedTab.closed) {
          reservedTab.location.href = websiteAction.url;
        } else if (reservedTab && !reservedTab.closed) {
          reservedTab.close();
        }
        setMessages((current) => [
          ...current,
          {
            ...makeMessage("assistant", answer),
            activity: completedActivity,
            actions: result.actions.filter((action) => action.tool === "open_website" && isAllowedBrowserUrl(action.url)),
          },
        ]);
      } else {
        const messageId = crypto.randomUUID();
        setMessages((current) => [...current, { id: messageId, role: "assistant", content: "" }]);
        answer = await sendChat(selectedId, prompt, priorHistory, (content) => {
          setMessages((current) => current.map((message) =>
            message.id === messageId ? { ...message, content: `${message.content}${content}` } : message,
          ));
        });
        setMessages((current) => current.map((message) =>
          message.id === messageId ? { ...message, content: answer } : message,
        ));
      }
    } catch (sendError) {
      if (reservedTab && !reservedTab.closed) {
        reservedTab.close();
      }
      setError(sendError instanceof Error ? sendError.message : "Die Anfrage ist fehlgeschlagen.");
    } finally {
      setBusy(false);
      setAgentProgress([]);
      promptBox.current?.focus();
    }
  }

  function toggleVoiceCapture() {
    if (speechRecognition.current) {
      speechRecognition.current.stop();
      return;
    }

    const speechWindow = window as Window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setError("Sprachdiktat ist in diesem Browser nicht verfügbar. Auf dem iPad kannst du die Mikrofontaste der Bildschirmtastatur verwenden.");
      return;
    }

    const recognition = new Recognition();
    recognition.lang = "de-DE";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .slice(event.resultIndex)
        .filter((result) => result.isFinal)
        .map((result) => result[0]?.transcript ?? "")
        .join(" ")
        .trim();
      if (transcript) {
        setDraft((current) => `${current}${current.trim() ? " " : ""}${transcript}`);
        promptBox.current?.focus();
      }
    };
    recognition.onerror = (event) => {
      setError(event.error === "not-allowed"
        ? "Der Mikrofonzugriff wurde verweigert. Erlaube ihn in den Browser-Einstellungen."
        : `Spracherkennung fehlgeschlagen (${event.error}).`);
      setListening(false);
      speechRecognition.current = null;
    };
    recognition.onend = () => {
      setListening(false);
      speechRecognition.current = null;
    };
    try {
      speechRecognition.current = recognition;
      setError("");
      setVoiceNotice("Browser-Spracherkennung kann Audio an den Browseranbieter übertragen. Der erkannte Text wird erst nach Senden an das lokale Modell geschickt.");
      setListening(true);
      recognition.start();
    } catch (startError) {
      speechRecognition.current = null;
      setListening(false);
      setError(startError instanceof Error ? startError.message : "Das Mikrofon konnte nicht gestartet werden.");
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitPrompt(draft);
  }

  async function copyMessage(id: string, content: string) {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(id);
      window.setTimeout(() => setCopied(""), 1600);
    } catch {
      setError("Der Text konnte nicht in die Zwischenablage kopiert werden.");
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Code2 size={19} strokeWidth={2.2} /></div>
          <span>local<span className="brand-light">forge</span></span>
          <span className="brand-version">BETA</span>
        </div>

        <button className="new-chat-button" type="button" onClick={resetChat}>
          <Plus size={17} />
          <span>Neuer Chat</span>
          <span className="shortcut">⌘ K</span>
        </button>

        <div className="sidebar-label">DEINE ASSISTENTEN</div>
        <nav className="assistant-list" aria-label="Assistent wählen">
          {assistants.map((assistant) => (
            <button
              className={`assistant-option ${selectedId === assistant.id ? "selected" : ""}`}
              key={assistant.id}
              onClick={() => chooseAssistant(assistant.id)}
              type="button"
              aria-pressed={selectedId === assistant.id}
            >
              <span className={`avatar avatar-${assistant.color}`}>{assistant.initials}</span>
              <span className="assistant-option-copy">
                <span className="assistant-option-name">{assistant.name}</span>
                <span className="assistant-option-model">{assistant.model}</span>
              </span>
              <span className={`online-dot ${runtimeStatus?.providerConnected && runtimeStatus.modelAvailable ? "" : "offline"}`} />
            </button>
          ))}
        </nav>

        <div className="sidebar-divider" />
        <div className="sidebar-label">TOOLS</div>
        <div className="tool-row"><Code2 size={16} /><span>Code schreiben</span></div>
        <div className="tool-row"><MessageSquareText size={16} /><span>Code reviewen</span></div>

        <div className="sidebar-bottom">
          <div className="provider-card">
            <span className="provider-orb"><Sparkles size={14} /></span>
            <span><strong>{runtimeStatus?.model ?? activeAssistant.model}</strong><small>{runtimeStatus?.provider ?? "KI-Anbieter"}</small></span>
            <span
              className={`provider-status ${runtimeStatus?.providerConnected ? "" : "provider-status-offline"}`}
              title={runtimeStatus?.providerConnected ? `${runtimeStatus.provider} verbunden` : `${runtimeStatus?.provider ?? "KI-Anbieter"} nicht verbunden`}
            />
          </div>
          <a className="sidebar-footer" href="https://github.com/" target="_blank" rel="noreferrer">
            <Github size={15} /> <span>Local Forge</span><ArrowDown size={13} className="external-icon" />
          </a>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div className="breadcrumbs">
            <span>Workspace</span><span className="crumb-slash">/</span>
            <div className="active-assistant-menu">
              <span className={`mini-avatar avatar-${activeAssistant.color}`}>{activeAssistant.initials}</span>
              <span className="crumb-active">{activeAssistant.name}</span>
              <ChevronDown size={14} />
            </div>
          </div>
          <div className="topbar-right">
            <span className="privacy-badge"><span /> Privat &amp; temporär</span>
            <button type="button" className="icon-button" aria-label="Neuen Chat starten" onClick={resetChat}>
              <Plus size={18} />
            </button>
          </div>
        </header>

        <section className="conversation-area" ref={scrollArea}>
          {isEmpty ? (
            <div className="welcome-wrap">
              <div className="welcome-badge"><Sparkles size={13} /> DEIN AI CODING STUDIO</div>
              <h1>Was bauen wir<br /><span>heute zusammen?</span></h1>
              <p className="welcome-description">
                Zwei Coding-Assistenten, direkt auf deinem Laptop. Lass sie Code schreiben,
                Fehler suchen und auf Wunsch Aufgaben selbstständig im Projekt umsetzen.
              </p>

              {assistantLoadError && <p className="inline-warning">{assistantLoadError}</p>}
              {runtimeStatus && (!runtimeStatus.providerConnected || !runtimeStatus.modelAvailable) && (
                <p className="inline-warning">{runtimeStatus.message}</p>
              )}
              {runtimeStatus?.providerConnected && runtimeStatus.modelAvailable && !runtimeStatus.workspaceAvailable && (
                <p className="inline-warning">Chat ist bereit. Für autonome Änderungen setze WORKSPACE_ROOT in der .env auf deinen Projektordner.</p>
              )}

              <div className="assistant-cards">
                {assistants.map((assistant) => (
                  <button
                    className={`assistant-card ${selectedId === assistant.id ? "card-active" : ""}`}
                    key={assistant.id}
                    onClick={() => chooseAssistant(assistant.id)}
                    type="button"
                    aria-pressed={selectedId === assistant.id}
                  >
                    <span className={`avatar avatar-large avatar-${assistant.color}`}>{assistant.initials}</span>
                    <span className="assistant-card-copy">
                      <strong>{assistant.name}</strong>
                      <span>{assistant.title}</span>
                    </span>
                    {selectedId === assistant.id && <Check size={16} className="card-check" />}
                    <p>{assistant.description}</p>
                  </button>
                ))}
              </div>

              <div className="suggestion-label">STARTE MIT EINEM PROMPT</div>
              <div className="suggestions">
                {suggestions.map(({ icon: Icon, text }) => (
                  <button type="button" key={text} onClick={() => void submitPrompt(text)}>
                    <Icon size={15} /><span>{text}</span><ArrowUp size={14} className="suggestion-arrow" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="message-list">
              <div className="thread-heading">
                <div>
                  <span className="thread-eyebrow">{autonomous ? "AUTONOME CODING SESSION" : "CODING SESSION"}</span>
                  <h2>{activeAssistant.name} <span>hilft dir weiter</span></h2>
                </div>
                <button type="button" className="clear-button" onClick={resetChat}><X size={14} /> Chat leeren</button>
              </div>
              {messages.map((message) => (
                <article className={`message message-${message.role}`} key={message.id}>
                  <div className={`message-avatar ${message.role === "assistant" ? `avatar-${activeAssistant.color}` : "user-avatar"}`}>
                    {message.role === "assistant" ? activeAssistant.initials : "Du"}
                  </div>
                  <div className="message-content">
                    <div className="message-meta">
                      <strong>{message.role === "assistant" ? activeAssistant.name : "Du"}</strong>
                      <span>{message.role === "assistant" ? activeAssistant.model : "Gerade eben"}</span>
                    </div>
                    {message.role === "assistant" && message.activity && message.activity.length > 0 && (
                      <details className="activity-panel" open>
                        <summary>{message.activity.length} Arbeitsschritte</summary>
                        <ol>
                          {message.activity.map((step, index) => (
                            <li className={`activity-step phase-${step.phase}`} key={`${index}-${step.summary}`}>
                              <span className="activity-check"><Check size={11} /></span>
                              <span>{step.summary}</span>
                            </li>
                          ))}
                        </ol>
                      </details>
                    )}
                    {message.role === "assistant" && message.actions?.map((action) => (
                      action.url && isAllowedBrowserUrl(action.url) ? (
                        <a
                          className="external-action-link"
                          href={action.url}
                          key={action.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ArrowUp size={13} className="external-action-icon" />
                          {action.summary}
                        </a>
                      ) : null
                    ))}
                    <div className="markdown-body"><ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown></div>
                    {message.role === "assistant" && (
                      <button
                        type="button"
                        className="copy-button"
                        onClick={() => void copyMessage(message.id, message.content)}
                        aria-label="Antwort kopieren"
                      >
                        {copied === message.id ? <Check size={13} /> : <Code2 size={13} />}
                        {copied === message.id ? "Kopiert" : "Antwort kopieren"}
                      </button>
                    )}
                  </div>
                </article>
              ))}
              {busy && (
                <div className="message message-assistant">
                  <div className={`message-avatar avatar-${activeAssistant.color}`}>{activeAssistant.initials}</div>
                  <div className="thinking-wrap">
                    <div className="thinking"><LoaderCircle size={16} className="spin" /> {autonomous ? "Arbeite im Projekt" : `${activeAssistant.model} denkt nach`}<span className="thinking-dots">...</span></div>
                    {autonomous && agentProgress.length > 0 && (
                      <ol className="live-activity">
                        {agentProgress.map((step, index) => (
                          <li className={`activity-step phase-${step.phase}`} key={`${index}-${step.summary}`}>
                            <span className="activity-check"><Check size={11} /></span>
                            <span>{step.summary}</span>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                </div>
              )}
              {error && <div className="error-banner" role="alert">{error}</div>}
            </div>
          )}
        </section>

        <div className="composer-wrap">
          {isEmpty && error && <div className="error-banner empty-error" role="alert">{error}</div>}
          <form className="composer" onSubmit={handleSubmit}>
            <div className="mode-switch" role="group" aria-label="Arbeitsmodus wählen">
              <button
                type="button"
                className={`mode-option ${autonomous ? "" : "mode-selected"}`}
                onClick={() => setAutonomous(false)}
                aria-pressed={!autonomous}
              >
                <MessageSquareText size={13} /> Chat
              </button>
              <button
                type="button"
                className={`mode-option ${autonomous ? "mode-selected mode-agent" : ""}`}
                onClick={() => setAutonomous(true)}
                aria-pressed={autonomous}
              >
                <Bot size={14} /> Autonom
              </button>
              {autonomous && (
                <span className={`agent-readiness ${runtimeStatus?.agentEnabled ? "agent-ready" : ""}`}>
                  {runtimeStatus?.agentEnabled ? "Projektzugriff aktiv" : "Projektordner nötig"}
                </span>
              )}
            </div>
            <div className="quick-launch" aria-label="Websites schnell öffnen">
              <span>Schnell öffnen</span>
              {browserShortcuts.map(({ label, url, icon: Icon }) => (
                <button type="button" key={label} onClick={() => openShortcut(url)}>
                  <Icon size={13} /> {label}
                </button>
              ))}
            </div>
            <textarea
              ref={promptBox}
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
                event.target.style.height = "auto";
                event.target.style.height = `${Math.min(event.target.scrollHeight, 180)}px`;
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void submitPrompt(draft);
                }
              }}
              placeholder={`Frag ${activeAssistant.name} alles rund ums Coden ...`}
              rows={1}
              maxLength={20_000}
              aria-label="Nachricht an den Assistenten"
              disabled={busy}
            />
            <div className="composer-toolbar">
              <div className="composer-hints">
                <span className="composer-model"><span className={`mini-avatar avatar-${activeAssistant.color}`}>{activeAssistant.initials}</span>{activeAssistant.name}<ChevronDown size={12} /></span>
                <span className="composer-hint">Shift + Enter für neue Zeile</span>
              </div>
              <button
                type="button"
                className={`voice-button ${listening ? "voice-listening" : ""}`}
                onClick={toggleVoiceCapture}
                aria-label={listening ? "Spracherkennung stoppen" : "Spracheingabe"}
                title={listening ? "Spracherkennung stoppen" : "Spracheingabe"}
              >
                {listening ? <Square size={13} /> : <Mic size={15} />}
              </button>
              <button className="send-button" type="submit" disabled={!draft.trim() || busy} aria-label="Nachricht senden">
                {busy ? <LoaderCircle size={16} className="spin" /> : <ArrowUp size={17} />}
              </button>
            </div>
          </form>
          {voiceNotice && <p className="voice-notice">{voiceNotice}</p>}
          <p className="disclaimer">
            {autonomous
              ? "Der Agent kann Dateien im gewählten Ordner ändern und Tests/Builds starten. Sichere wichtige Arbeit vorher."
              : "KI-Antworten können Fehler enthalten. Prüfe wichtigen Code, bevor du ihn einsetzt."}
          </p>
        </div>
      </main>
    </div>
  );
}
