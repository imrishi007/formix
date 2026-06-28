"use client";

import { useState } from "react";
import Editor from "@monaco-editor/react";
import { Copy, Download } from "lucide-react";

const defaultFormixCode = `form UserSignup {
  firstName: text(required)
  lastName: text(required)
  email: email(required)
  password: password(required)
  confirmPassword: password(required)
  agreeToTerms: checkbox(required)
  
  submit: "Create Account"
}`;

export function MonacoSandbox() {
  const [code, setCode] = useState(defaultFormixCode);
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([
    { role: "assistant", content: "Hi! I'm here to help you build forms. Tell me what kind of form you need." }
  ]);
  const [input, setInput] = useState("");

  const handleSendMessage = () => {
    if (!input.trim()) return;
    
    const newMessages = [
      ...messages,
      { role: "user" as const, content: input }
    ];
    
    setMessages(newMessages);
    setInput("");
    
    // Simulate AI response
    setTimeout(() => {
      setMessages(prev => [
        ...prev,
        { role: "assistant" as const, content: "That's a great idea! I can help you create that form. Try modifying the DSL on the right." }
      ]);
    }, 500);
  };

  const handleExportCode = () => {
    const element = document.createElement("a");
    const file = new Blob([code], { type: "text/plain" });
    element.href = URL.createObjectURL(file);
    element.download = "form.forml";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <section className="w-full max-w-7xl mx-auto px-6 lg:px-12 py-12 mb-24">
      <div className="w-full border border-zinc-800 rounded-lg overflow-hidden bg-black flex h-[600px] flex-row">
        
        {/* Pane 1: AI Assistant (25%) */}
        <div className="w-1/4 border-r border-zinc-800 flex flex-col bg-black">
          <div className="px-4 py-3 border-b border-zinc-800">
            <h3 className="text-sm font-semibold text-foreground">AI Assistant</h3>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div 
                  className={`rounded-lg px-3 py-2 text-sm max-w-[85%] ${
                    msg.role === "user" 
                      ? "bg-zinc-700 text-foreground" 
                      : "bg-zinc-900 text-foreground/80"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
          </div>
          
          <div className="border-t border-zinc-800 p-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                placeholder="Ask something..."
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-xs text-foreground placeholder-foreground/40 focus:outline-none focus:border-zinc-600"
              />
              <button
                onClick={handleSendMessage}
                className="bg-zinc-700 hover:bg-zinc-600 text-foreground px-2 py-1.5 rounded text-xs transition-colors"
              >
                Send
              </button>
            </div>
          </div>
        </div>

        {/* Pane 2: DSL Editor (45%) */}
        <div className="w-[45%] border-r border-zinc-800 flex flex-col bg-black">
          <div className="px-4 py-3 border-b border-zinc-800">
            <h3 className="text-sm font-semibold text-foreground">DSL Editor</h3>
          </div>
          
          <div className="flex-1 overflow-hidden">
            <Editor
              height="100%"
              defaultLanguage="text"
              value={code}
              onChange={(value) => setCode(value || "")}
              theme="vs-dark"
              options={{
                minimap: { enabled: false },
                fontSize: 12,
                fontFamily: '"Fira Code", "Courier New", monospace',
                padding: { top: 16, bottom: 16 },
                lineHeight: 1.6,
              }}
            />
          </div>
        </div>

        {/* Pane 3: Live Preview (30%) */}
        <div className="w-3/10 flex flex-col bg-zinc-950">
          <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Live Preview</h3>
            <button
              onClick={handleExportCode}
              className="flex items-center gap-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-foreground px-2.5 py-1.5 rounded transition-colors"
              title="Export code"
            >
              <Download className="w-3.5 h-3.5" />
              Export
            </button>
          </div>
          
          <div className="flex-1 p-6 overflow-y-auto flex items-start justify-start">
            <div className="space-y-4 w-full">
              <div className="bg-zinc-900 border border-zinc-800 rounded p-4">
                <p className="text-xs text-foreground/60 mb-3">Form Preview</p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-foreground/80 mb-1.5">
                      First Name
                    </label>
                    <input 
                      type="text" 
                      className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-xs text-foreground" 
                      placeholder="Enter first name"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-foreground/80 mb-1.5">
                      Email
                    </label>
                    <input 
                      type="email" 
                      className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-xs text-foreground" 
                      placeholder="Enter email"
                    />
                  </div>
                  <button className="w-full bg-foreground text-background text-xs font-medium py-1.5 rounded mt-2 hover:bg-foreground/90 transition-colors">
                    Submit
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
