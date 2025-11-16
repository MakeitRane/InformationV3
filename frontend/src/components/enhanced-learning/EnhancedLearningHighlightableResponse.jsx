import React, { useState, useRef, useEffect } from 'react';

const EnhancedLearningHighlightableResponse = ({ text, onPromptSubmit }) => {
  const [showPromptInput, setShowPromptInput] = useState(false);
  const [promptPosition, setPromptPosition] = useState({ x: 0, y: 0 });
  const [prompt, setPrompt] = useState('');
  const [highlightedText, setHighlightedText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const promptInputRef = useRef(null);

  const handleTextSelection = () => {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();

    if (selectedText) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      
      // Calculate position for prompt input
      const x = rect.right + window.scrollX;
      const y = rect.top + window.scrollY;
      
      setHighlightedText(selectedText);
      setPromptPosition({ x, y });
      setShowPromptInput(true);
    } else {
      setShowPromptInput(false);
    }
  };

  const handlePromptSubmit = async (e) => {
    e.preventDefault();
    if (prompt.trim() && !isSubmitting) {
      setIsSubmitting(true);
      try {
        await onPromptSubmit({
          highlightedText,
          prompt: prompt.trim()
        });
        
        // Reset state
        setPrompt('');
        setShowPromptInput(false);
        setHighlightedText('');
      } catch (error) {
        console.error('Error submitting prompt:', error);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  useEffect(() => {
    if (showPromptInput && promptInputRef.current) {
      promptInputRef.current.focus();
    }
  }, [showPromptInput]);

  return (
    <div className="relative">
      {/* Response text */}
      <div 
        onMouseUp={handleTextSelection}
        className="whitespace-pre-wrap"
      >
        {text}
      </div>

      {/* Prompt input */}
      {showPromptInput && (
        <div
          className="absolute bg-[#181b1a] border border-gray-600 rounded-lg shadow-xl p-4 z-50"
          style={{
            left: `${promptPosition.x}px`,
            top: `${promptPosition.y}px`,
            transform: 'translate(20px, -50%)',
            maxWidth: '300px'
          }}
        >
          <form onSubmit={handlePromptSubmit}>
            <div className="mb-2">
              <div className="text-sm text-[#00C8C8] mb-1" style={{ fontFamily: 'sans-serif' }}>Selected text:</div>
              <div className="text-sm italic text-[#5f5f5f]" style={{ fontFamily: 'sans-serif' }}>"{highlightedText}"</div>
            </div>
            <textarea
              ref={promptInputRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full bg-[#27272A] text-[#e8e9e2] rounded p-2 mb-2 border border-gray-600 focus:border-[#00C8C8] focus:outline-none"
              placeholder="Enter your prompt..."
              rows={3}
              style={{ fontFamily: 'sans-serif' }}
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowPromptInput(false)}
                className="mr-2 px-3 py-1 text-sm text-[#5f5f5f] hover:text-[#e8e9e2] transition-colors"
                style={{ fontFamily: 'sans-serif' }}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1 bg-[#00C8C8] text-white rounded hover:bg-[#00B0B0] transition-colors flex items-center"
                style={{ fontFamily: 'sans-serif' }}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  'Submit'
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default EnhancedLearningHighlightableResponse;

