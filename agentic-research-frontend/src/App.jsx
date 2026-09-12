import ReactMarkdown from "react-markdown";
import { useState, useRef, useEffect } from "react";
import "./App.css";

const N8N_CHAT_URL =
  "https://purvakadam.app.n8n.cloud/webhook/bffe8881-04c2-4b16-95fa-8efc053aa74b/chat";

// Timeout for the whole pipeline. This workflow runs 4 sequential agent
// calls plus a Tavily search round-trip, so it can legitimately take a
// while — this is a safety net, not a target response time.
const REQUEST_TIMEOUT_MS = 90000;

// Mirrors the real n8n workflow: Planner -> Research (Tavily) -> Decision -> Final Answer.
// We don't get live per-stage events back from n8n (it only returns the final
// output), so this is an honest best-effort progress indicator, timed to roughly
// how the pipeline actually behaves — not a literal live status feed.
const PIPELINE_STAGES = [
  { id: "plan", icon: "🧭", label: "Planning the research approach" },
  { id: "research", icon: "🔎", label: "Searching the web with Tavily" },
  { id: "decide", icon: "⚖️", label: "Evaluating the evidence" },
  { id: "final", icon: "✍️", label: "Drafting the final answer" },
];
const STAGE_INTERVAL_MS = 2400;

const CAPABILITIES = [
  {
    icon: "🧭",
    name: "Planner Agent",
    desc: "Breaks your question into a concrete research plan — what to look up, what to compare, what to verify.",
  },
  {
    icon: "🔎",
    name: "Research Agent",
    desc: "Executes the plan using live Tavily web search to gather current, relevant information.",
  },
  {
    icon: "⚖️",
    name: "Decision Agent",
    desc: "Weighs the evidence, compares options, and works out trade-offs and risks.",
  },
  {
    icon: "✍️",
    name: "Final Answer Agent",
    desc: "Turns the decision and reasoning into a clear, direct answer with the key findings.",
  },
];

const initialMessage = {
  role: "assistant",
  content:
    "Hi! I'm ResearchAI. I can research questions, compare options, evaluate information, and provide evidence-based recommendations. What would you like to research?",
};

function App() {
  const [messages, setMessages] = useState([initialMessage]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);
  const [connStatus, setConnStatus] = useState("idle"); // idle | online | error
  const [showInfo, setShowInfo] = useState(false);

  const messagesEndRef = useRef(null);
  const stageTimerRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages, loading]);

  // Stop the pipeline animation and clean up its timer
  const stopStageAnimation = () => {
    if (stageTimerRef.current) {
      clearInterval(stageTimerRef.current);
      stageTimerRef.current = null;
    }
  };

  // Start a completely new chat
  const startNewChat = () => {
    if (loading) return;

    setMessages([initialMessage]);
    setInput("");
    setConnStatus("idle");

    // Remove the previous conversation session
    localStorage.removeItem("researchSessionId");
  };

  const sendMessage = async () => {
    const question = input.trim();

    if (!question || loading) return;

    // Add user's message to the chat
    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: question,
      },
    ]);

    setInput("");
    setLoading(true);
    setStageIndex(0);

    // Walk through the pipeline stages while we wait. This is a best-effort
    // visual — n8n only sends one response at the very end — but it honestly
    // reflects the real Planner -> Research -> Decision -> Final Answer order.
    stopStageAnimation();
    stageTimerRef.current = setInterval(() => {
      setStageIndex((i) => Math.min(i + 1, PIPELINE_STAGES.length - 1));
    }, STAGE_INTERVAL_MS);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      // Get existing session ID
      let sessionId = localStorage.getItem("researchSessionId");

      // Create a new session if one doesn't exist
      if (!sessionId) {
        sessionId = crypto.randomUUID();
        localStorage.setItem("researchSessionId", sessionId);
      }

      // Send message to n8n
      const response = await fetch(N8N_CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "sendMessage",
          chatInput: question,
          sessionId: sessionId,
        }),
        signal: controller.signal,
      });

      // Check HTTP response
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      // Read n8n response
      const data = await response.json();

      // Extract the answer
      const answer =
        data.output ||
        data.text ||
        data.response ||
        data.message ||
        data.data ||
        "I received a response, but I couldn't read the answer.";

      // Add AI response to chat
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            typeof answer === "string"
              ? answer
              : JSON.stringify(answer, null, 2),
        },
      ]);
      setConnStatus("online");
    } catch (error) {
      console.error("Chat error:", error);

      const isTimeout = error.name === "AbortError";
      const content = isTimeout
        ? `The research pipeline didn't finish within ${Math.round(
            REQUEST_TIMEOUT_MS / 1000
          )}s and timed out. This workflow runs 4 agents plus a web search, so complex or multi-part questions can take a while — try a narrower question or send it again.`
        : `Connection error: ${error.message}. If this keeps happening, check that the n8n webhook is active and that CORS/Allowed Origins on the Chat Trigger node includes this site's URL.`;

      // Show connection error in chat
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content,
        },
      ]);
      setConnStatus("error");
    } finally {
      clearTimeout(timeoutId);
      stopStageAnimation();
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="chat-app">

      {/* HEADER */}
      <header className="chat-header">

        {/* BRAND */}
        <div className="brand">
          <div className="brand-icon">✦</div>

          <div>
            <h1>ResearchAI</h1>
            <span>Agentic Research Assistant</span>
          </div>
        </div>

        {/* HEADER RIGHT SIDE */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "14px",
            flexShrink: 0,
          }}
        >

          {/* CONNECTION STATUS */}
          <div className={`status status-${connStatus}`}>
            <span className="status-dot"></span>
            {connStatus === "online"
              ? "Online"
              : connStatus === "error"
              ? "Connection issue"
              : "Ready"}
          </div>

          {/* CAPABILITIES / HOW IT WORKS */}
          <button
            onClick={() => setShowInfo(true)}
            className="capabilities-btn"
            type="button"
          >
            ⓘ How it works
          </button>

          {/* NEW CHAT BUTTON */}
          <button
            onClick={startNewChat}
            disabled={loading}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: "105px",
              height: "38px",
              padding: "0 15px",
              border: "1px solid #d9dce7",
              borderRadius: "9px",
              background: "#ffffff",
              color: "#4f46a5",
              fontSize: "13px",
              fontWeight: "600",
              cursor: loading ? "not-allowed" : "pointer",
              whiteSpace: "nowrap",
              opacity: loading ? 0.5 : 1,
            }}
          >
            + New Chat
          </button>

        </div>
      </header>

      {/* HOW IT WORKS MODAL */}
      {showInfo && (
        <div className="info-overlay" onClick={() => setShowInfo(false)}>
          <div className="info-panel" onClick={(e) => e.stopPropagation()}>
            <div className="info-panel-header">
              <h3>How ResearchAI works</h3>
              <button
                className="info-close"
                onClick={() => setShowInfo(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <p className="info-intro">
              Every question runs through four cooperating agents, in order:
            </p>
            <div className="capability-list">
              {CAPABILITIES.map((c) => (
                <div className="capability-row" key={c.name}>
                  <div className="capability-icon">{c.icon}</div>
                  <div>
                    <div className="capability-name">{c.name}</div>
                    <div className="capability-desc">{c.desc}</div>
                  </div>
                </div>
              ))}
            </div>
            <p className="info-footnote">
              Built with n8n, Google Gemini, and Tavily web search.
            </p>
          </div>
        </div>
      )}

      {/* MAIN CHAT AREA */}
      <main className="chat-container">

        {/* WELCOME MESSAGE */}
        {messages.length === 1 && (
          <div className="welcome">
            <div className="welcome-icon">✦</div>

            <h2>How can I help you?</h2>

            <p>
              Ask me to research, compare, analyze, or recommend.
            </p>
          </div>
        )}

        {/* MESSAGES */}
        <div className="messages">

          {messages.map((message, index) => (
            <div
              key={index}
              className={`message-row ${message.role}`}
            >

              {/* ASSISTANT AVATAR */}
              {message.role === "assistant" && (
                <div className="avatar">✦</div>
              )}

              {/* MESSAGE */}
              <div className="message-bubble">

                {message.role === "assistant" ? (
                  <ReactMarkdown>
                    {message.content}
                  </ReactMarkdown>
                ) : (
                  message.content
                )}

              </div>
            </div>
          ))}

          {/* PIPELINE / TYPING INDICATOR */}
          {loading && (
            <div className="message-row assistant">

              <div className="avatar">✦</div>

              <div className="message-bubble typing-bubble">
                <div className="stage-row" key={stageIndex}>
                  <span className="stage-icon">
                    {PIPELINE_STAGES[stageIndex].icon}
                  </span>
                  <span className="stage-label">
                    {PIPELINE_STAGES[stageIndex].label}
                  </span>
                </div>
                <div className="typing">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>

            </div>
          )}

          <div ref={messagesEndRef}></div>

        </div>
      </main>

      {/* INPUT AREA */}
      <div className="input-area">

        <div className="input-wrapper">

          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a research question..."
            rows="1"
            disabled={loading}
          />

          <button
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            aria-label="Send message"
          >
            ➤
          </button>

        </div>

        <p className="input-hint">
          Press Enter to send • Shift + Enter for a new line
        </p>

      </div>

      {/* FOOTER */}
      <footer>
        ResearchAI · Powered by n8n, Gemini & Tavily
      </footer>

    </div>
  );
}

export default App;