import ReactMarkdown from "react-markdown";
import { useState, useRef, useEffect } from "react";
import "./App.css";

const N8N_CHAT_URL =
  "https://purvakadam.app.n8n.cloud/webhook/bffe8881-04c2-4b16-95fa-8efc053aa74b/chat";

const initialMessage = {
  role: "assistant",
  content:
    "Hi! I'm ResearchAI. I can research questions, compare options, evaluate information, and provide evidence-based recommendations. What would you like to research?",
};

function App() {
  const [messages, setMessages] = useState([initialMessage]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages, loading]);

  // Start a completely new chat
  const startNewChat = () => {
    if (loading) return;

    setMessages([initialMessage]);
    setInput("");

    // Remove the previous conversation session
    localStorage.removeItem("researchSessionId");
  };

  const sendMessage = async () => {
    const question = input.trim();

    if (!question || loading) return;

    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: question,
      },
    ]);

    setInput("");
    setLoading(true);

    try {
      let sessionId = localStorage.getItem("researchSessionId");

      if (!sessionId) {
        sessionId = crypto.randomUUID();
        localStorage.setItem("researchSessionId", sessionId);
      }

      const response = await fetch(N8N_CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "sendMessage",
          chatInput: question,
          sessionId,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      console.log("n8n response:", data);

      const answer =
        data.output ||
        data.text ||
        data.response ||
        data.message ||
        data.data ||
        "I received a response, but I couldn't read the answer.";

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
    } catch (error) {
      console.error("Chat error:", error);

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Connection error: ${error.message}`,
        },
      ]);
    } finally {
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

          {/* ONLINE STATUS */}
          <div className="status">
            <span className="status-dot"></span>
            Online
          </div>

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

      {/* MAIN CHAT AREA */}
      <main className="chat-container">

        {messages.length === 1 && (
          <div className="welcome">
            <div className="welcome-icon">✦</div>

            <h2>How can I help you?</h2>

            <p>
              Ask me to research, compare, analyze, or recommend.
            </p>
          </div>
        )}

        <div className="messages">

          {messages.map((message, index) => (
            <div
              key={index}
              className={`message-row ${message.role}`}
            >

              {message.role === "assistant" && (
                <div className="avatar">✦</div>
              )}

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

          {/* TYPING INDICATOR */}
          {loading && (
            <div className="message-row assistant">

              <div className="avatar">✦</div>

              <div className="message-bubble typing">
                <span></span>
                <span></span>
                <span></span>
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