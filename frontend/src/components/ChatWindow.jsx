import React, { useState } from "react";
import Message from "./Message";
import ChatInput from "./ChatInput";

export default function ChatWindow() {
  // Placeholder messages
  const [messages] = useState([
    { role: "assistant", text: "Hello! How can I help you today?" },
    { role: "user", text: "Explain how AI works." },
    { role: "assistant", text: "Sure! At a high level, AI refers to..." },
  ]);

  return (
    <div className="flex-1 flex flex-col bg-gray-900">
      {/* Header */}
      <div className="p-4 border-b border-gray-700 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Chat Title</h1>
        <div className="space-x-2">
          <button className="text-gray-400 hover:text-white">...</button>
          <button className="text-gray-400 hover:text-white">⋮</button>
        </div>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, idx) => (
          <Message key={idx} role={msg.role} text={msg.text} />
        ))}
      </div>

      {/* Input bar */}
      <ChatInput />
    </div>
  );
}
