import React from "react";

export default function Message({ role, text }) {
  const isUser = role === "user";

  return (
    <div className={isUser ? "flex justify-end" : "flex justify-start"}>
      <div
        className={
          isUser
            ? "bg-blue-600 text-white py-2 px-4 rounded-lg max-w-xs"
            : "bg-gray-800 text-white py-2 px-4 rounded-lg max-w-xs"
        }
      >
        {text}
      </div>
    </div>
  );
}
