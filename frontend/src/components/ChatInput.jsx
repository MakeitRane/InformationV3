import React, { useState } from "react";
import { FaSearch, FaArrowRight } from "react-icons/fa";

export default function ChatInput({ onSubmit, placeholder = "Ask anything or @mention a Space", isCentered = false }) {
  const [input, setInput] = useState("");

  const sendMessage = () => {
    const value = input.trim();
    if (!value) return;
    if (typeof onSubmit === "function") {
      onSubmit(value);
    }
    setInput("");
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className={`w-full ${isCentered ? 'max-w-4xl mx-auto' : ''}`}>
      <div className="relative bg-[#27272A] rounded-2xl border border-gray-600 focus-within:border-[#00C8C8] transition-colors">
        {/* Left side icon */}
        <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
          <FaSearch className="w-4 h-4 text-[#5f5f5f]" />
        </div>

        {/* Input field */}
        <textarea
          className="w-full bg-transparent text-[#e8e9e2] p-4 pl-12 pr-16 focus:outline-none min-h-[60px] max-h-[144px] resize-none flex items-center overflow-y-auto"
          rows={1}
          value={input}
          onKeyDown={onKeyDown}
          onChange={(e) => {
            setInput(e.target.value);
            // Auto-resize textarea
            e.target.style.height = 'auto';
            const newHeight = Math.min(e.target.scrollHeight, 144); // 6 lines max (24px per line)
            e.target.style.height = newHeight + 'px';
          }}
          placeholder={placeholder}
          style={{ fontFamily: 'sans-serif', lineHeight: '1.5' }}
        />

        {/* Right side send button */}
        <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
          <button
            onClick={sendMessage}
            aria-label="Send"
            className="bg-[#00C8C8] hover:bg-[#00B0B0] text-white p-2 rounded-lg transition-colors"
          >
            <FaArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
