import React from 'react';

const ModeToggle = ({ mode, onModeChange }) => {
  const toggleMode = () => {
    const newMode = mode === 'standard' ? 'enhanced-learning' : 'standard';
    // Save to localStorage
    localStorage.setItem('chatMode', newMode);
    // Notify parent component
    if (onModeChange) {
      onModeChange(newMode);
    }
  };

  return (
    <div className="fixed top-4 right-4 z-[60]">
      <button
        onClick={toggleMode}
        className="bg-[#27272A] border border-gray-600 rounded-lg px-4 py-2 flex items-center space-x-2 hover:border-[#00C8C8] transition-colors shadow-lg"
        style={{ fontFamily: 'sans-serif' }}
      >
        <span className="text-[#e8e9e2] text-sm font-medium">
          {mode === 'standard' ? 'Standard' : 'Enhanced Learning'}
        </span>
        <div className={`w-2 h-2 rounded-full ${mode === 'standard' ? 'bg-[#00C8C8]' : 'bg-green-500'}`}></div>
      </button>
    </div>
  );
};

export default ModeToggle;

