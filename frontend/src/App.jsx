import React, { useState } from 'react';
import StandardApp from './components/StandardApp';
import EnhancedLearningApp from './components/enhanced-learning/EnhancedLearningApp';
import ModeToggle from './components/ModeToggle';

function App() {
  const [mode, setMode] = useState(() => {
    // Load from localStorage or default to 'standard'
    const savedMode = localStorage.getItem('chatMode');
    return savedMode || 'standard';
  });

  const handleModeChange = (newMode) => {
    setMode(newMode);
  };

  return (
    <>
      <ModeToggle mode={mode} onModeChange={handleModeChange} />
      {mode === 'standard' ? <StandardApp /> : <EnhancedLearningApp />}
    </>
  );
}

export default App;
