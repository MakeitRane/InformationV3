import React, { useState, useEffect, useRef, useMemo } from 'react';
import { parseTextIntoChunks } from '../../utils/chunkParser';

const IncrementalResponse = ({ 
  fullText, 
  messageId,
  onReprompt, 
  onNavigate,
  currentChunkIndex,
  previousContext = '',
  reprompts = [], // Array of { chunkIndex, query, timestamp }
  isRepromptResponse = false, // Whether this is a response from a reprompt
  header = null, // Optional header for the response
  onShowRepromptInput = null, // Callback to show reprompt input in parent
  onHideRepromptInput = null // Callback to hide reprompt input in parent
}) => {
  const [chunks, setChunks] = useState([]);
  const [visibleChunks, setVisibleChunks] = useState(1);
  const containerRef = useRef(null);
  const chunkRefs = useRef({});
  const [annotationPositions, setAnnotationPositions] = useState({});
  const lastChunkRef = useRef(null);

  // Parse text into chunks on initial load
  useEffect(() => {
    if (fullText) {
      const parsedChunks = parseTextIntoChunks(fullText);
      // Debug: log chunks to verify subheader extraction
      console.log('Parsed chunks with subheaders:', parsedChunks.map((c, i) => ({
        index: i,
        subheader: c.subheader,
        hasSubheader: c.hasSubheader,
        textPreview: c.fullText.substring(0, 50)
      })));
      setChunks(parsedChunks);
      // Use currentChunkIndex if provided, otherwise start with first chunk
      setVisibleChunks(currentChunkIndex || 1);
    }
  }, [fullText, currentChunkIndex]);

  // Calculate displayed chunks - memoized to avoid recalculation
  const displayedChunks = useMemo(() => {
    return chunks.slice(0, visibleChunks);
  }, [chunks, visibleChunks]);

  // Calculate annotation positions based on chunk positions
  useEffect(() => {
    // Use requestAnimationFrame to ensure DOM is updated
    const updatePositions = () => {
      const positions = {};
      displayedChunks.forEach((chunk, index) => {
        const repromptAtThisChunk = reprompts.find(r => r.chunkIndex === index);
        if (repromptAtThisChunk && chunkRefs.current[index]) {
          const chunkElement = chunkRefs.current[index];
          const container = document.getElementById('response-container');
          if (container && chunkElement) {
            const containerRect = container.getBoundingClientRect();
            const chunkRect = chunkElement.getBoundingClientRect();
            positions[index] = chunkRect.top - containerRect.top + container.scrollTop;
          }
        }
      });
      setAnnotationPositions(positions);
    };
    
    // Delay to ensure chunks are rendered
    const timeoutId = setTimeout(updatePositions, 100);
    requestAnimationFrame(updatePositions);
    
    return () => clearTimeout(timeoutId);
  }, [visibleChunks, displayedChunks, reprompts]);

  // Auto-scroll to last visible chunk
  useEffect(() => {
    if (lastChunkRef.current && visibleChunks > 0) {
      setTimeout(() => {
        const container = document.getElementById('response-container');
        if (container && lastChunkRef.current) {
          const chunkRect = lastChunkRef.current.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();
          
          // Only scroll if chunk is below the visible area
          if (chunkRect.bottom > containerRect.bottom) {
            lastChunkRef.current.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'nearest',
              inline: 'nearest'
            });
          }
        }
      }, 100);
    }
  }, [visibleChunks]);

  // Handle keyboard events for navigation and typing detection
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't intercept if user is typing in an input/textarea
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }

      // Arrow down - read on (next chunk)
      if (e.key === 'ArrowDown' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        handleReadOn();
      }
      
      // Arrow up - go back (previous chunk)
      if (e.key === 'ArrowUp' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        handleGoBack();
      }

      // Typing detection - show reprompt input
      // Only trigger if it's a printable character (not special keys)
      const isPrintableKey = e.key.length === 1 && 
        !['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Enter', 'Tab', 'Escape'].includes(e.key);
      
      if (isPrintableKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // Notify parent to show reprompt input
        if (onShowRepromptInput) {
          onShowRepromptInput(messageId);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [visibleChunks, chunks.length, onShowRepromptInput, messageId]);

  const handleReadOn = () => {
    if (visibleChunks < chunks.length) {
      const newIndex = visibleChunks + 1;
      setVisibleChunks(newIndex);
      if (onNavigate) {
        onNavigate(messageId, newIndex);
      }
    }
  };

  const handleGoBack = () => {
    if (visibleChunks > 1) {
      const newIndex = visibleChunks - 1;
      setVisibleChunks(newIndex);
      if (onNavigate) {
        onNavigate(messageId, newIndex);
      }
    } else if (onNavigate) {
      // If at first chunk, navigate to previous response
      onNavigate(messageId, 0, 'previous');
    }
  };

  // Reprompt handling is now done in parent component

  
  // Group chunks by subheader for proper structure
  // A new group is created whenever the subheader value changes
  const groupedChunks = useMemo(() => {
    const groups = [];
    let currentGroup = null;
    let previousSubheader = null;
    
    displayedChunks.forEach((chunk, index) => {
      // Normalize subheader (treat empty string as null)
      const currentSubheader = chunk.subheader && chunk.subheader.trim() 
        ? chunk.subheader.trim() 
        : null;
      
      // Check if subheader changed (handling null/empty string cases)
      const subheaderChanged = currentSubheader !== previousSubheader;
      
      // Start a new group if the subheader changed
      if (subheaderChanged) {
        // Save previous group if it exists
        if (currentGroup) {
          groups.push(currentGroup);
        }
        // Start a new group with the current subheader
        currentGroup = {
          subheader: currentSubheader,
          chunks: [chunk],
          startIndex: index
        };
      } else {
        // Same subheader, add to current group
        if (currentGroup) {
          currentGroup.chunks.push(chunk);
        } else {
          // No current group yet, start one
          currentGroup = {
            subheader: currentSubheader,
            chunks: [chunk],
            startIndex: index
          };
        }
      }
      
      // Update previous subheader for next iteration
      previousSubheader = currentSubheader;
    });
    
    // Don't forget to add the last group
    if (currentGroup) {
      groups.push(currentGroup);
    }
    
    return groups;
  }, [displayedChunks]);

  return (
    <div ref={containerRef} className="relative" style={{ width: '100%', position: 'relative' }}>
      {/* Header - only show if not a reprompt response */}
      {header && !isRepromptResponse && (
        <h2 className="text-3xl font-bold mb-4 text-[#00C8C8]" style={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '20px' }}>
          {header}
        </h2>
      )}
      
      {/* Response chunks - structured by subheaders */}
      <div className="relative" style={{ width: '100%' }}>
        {/* Text content - left-aligned */}
        <div style={{ 
          fontFamily: '"Times New Roman", Times, serif', 
          fontSize: '16px', 
          color: '#e8e9e2',
          wordWrap: 'break-word', 
          overflowWrap: 'break-word', 
          width: '100%', 
          textAlign: 'left',
          lineHeight: '1.6'
        }}>
          {groupedChunks.map((group, groupIndex) => (
            <div key={groupIndex} className="relative" style={{ display: 'block', width: '100%' }}>
              {/* Subheader */}
              {group.subheader && (
                <h3 
                  style={{ 
                    fontFamily: '"Times New Roman", Times, serif', 
                    fontSize: '25px',
                    color: '#e8e9e2',
                    fontWeight: 'bold',
                    display: 'block',
                    width: '100%',
                    lineHeight: '1.2',
                    marginTop: '1.5rem',
                    marginBottom: '0.75rem',
                    padding: 0,
                    textAlign: 'left'
                  }}
                >
                  {group.subheader}
                </h3>
              )}
              
              {/* Chunks in this group */}
              <div className="relative" style={{ 
                display: 'block', 
                width: '100%', 
                color: '#e8e9e2',
                textAlign: 'left',
                marginBottom: '1.5rem'
              }}>
                {group.chunks.map((chunk, chunkIndex) => {
                  const absoluteIndex = group.startIndex + chunkIndex;
                  const chunkId = `chunk-${messageId}-${absoluteIndex}`;
                  const isLastChunk = absoluteIndex === displayedChunks.length - 1;
                  
                  return (
                    <span
                      key={absoluteIndex}
                      id={chunkId}
                      ref={el => {
                        chunkRefs.current[absoluteIndex] = el;
                        if (isLastChunk) {
                          lastChunkRef.current = el;
                        }
                      }}
                      className={`relative inline ${isLastChunk ? 'animate-fade-in' : ''}`}
                      style={{ marginRight: '0.5em' }}
                    >
                      {/* Chunk text - inline with space after */}
                      {chunk.fullText}
                      {absoluteIndex < displayedChunks.length - 1 && ' '}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        
      </div>

    </div>
  );
};

export default IncrementalResponse;
