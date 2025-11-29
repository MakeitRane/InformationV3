import React, { useState, useEffect, useRef } from 'react';
import IncrementalResponse from './IncrementalResponse';
import EnhancedLearningChatInput from './EnhancedLearningChatInput';
import Sidebar from '../Sidebar';
import axios from 'axios';
import { parseTextIntoChunks, hasTopicChanged } from '../../utils/chunkParser';
import { FaSearch, FaArrowRight } from 'react-icons/fa';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

// Scrollbar visibility management hook
const useScrollbarVisibility = (containerRef) => {
  const scrollTimeoutRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    const customScrollbar = document.getElementById('custom-scrollbar-track');
    if (!container || !customScrollbar) return;

    const handleScroll = () => {
      // Show scrollbar
      container.classList.add('scrolling');
      customScrollbar.style.opacity = '1';
      
      // Clear existing timeout
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      
      // Hide scrollbar after 1 second of inactivity
      scrollTimeoutRef.current = setTimeout(() => {
        container.classList.remove('scrolling');
        customScrollbar.style.opacity = '0';
      }, 1000);
    };

    container.addEventListener('scroll', handleScroll);
    
    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [containerRef]);
};

function EnhancedLearningApp() {
  const [messages, setMessages] = useState([]);
  const [currentConversation, setCurrentConversation] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [stickyQuestion, setStickyQuestion] = useState(null);
  const [chunkIndices, setChunkIndices] = useState({}); // Track current chunk index for each message
  const [responseContexts, setResponseContexts] = useState({}); // Store full context for each response
  const [reprompts, setReprompts] = useState({}); // Track reprompts: { messageId: [{ chunkIndex, query, timestamp, originalQuery }] }
  const [userQueries, setUserQueries] = useState({}); // Track original user queries for each message
  const [showFollowUpBar, setShowFollowUpBar] = useState(false);
  const [showRepromptInput, setShowRepromptInput] = useState(false);
  const [repromptMessageId, setRepromptMessageId] = useState(null);
  const [repromptText, setRepromptText] = useState('');
  const [hasTyped, setHasTyped] = useState(false);
  const contentRef = useRef(null);
  const responseContainerRef = useRef(null);
  const lastMessageRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const sidebarRef = useRef(null);
  const [sidebarWidth, setSidebarWidth] = useState(0);
  const [leftPadding, setLeftPadding] = useState(0);
  const [repromptPositions, setRepromptPositions] = useState({}); // Track positions of reprompt annotations
  
  // Manage scrollbar visibility
  useScrollbarVisibility(responseContainerRef);

  // Update reprompt annotation positions on scroll and when chunks change
  useEffect(() => {
    const updateRepromptPositions = () => {
      const positions = {};
      const container = document.getElementById('response-container');
      if (!container) return;
      
      Object.keys(reprompts).forEach(messageId => {
        if (reprompts[messageId] && reprompts[messageId].length > 0) {
          reprompts[messageId].forEach((reprompt, index) => {
            const chunkElement = document.getElementById(`chunk-${messageId}-${reprompt.chunkIndex}`);
            
            if (chunkElement) {
              const containerRect = container.getBoundingClientRect();
              const chunkRect = chunkElement.getBoundingClientRect();
              // Position relative to viewport top (for fixed positioning)
              positions[`${messageId}-${index}`] = chunkRect.top - containerRect.top;
            }
          });
        }
      });
      setRepromptPositions(positions);
    };

    // Initial update with delay to ensure DOM is ready
    const timeoutId = setTimeout(updateRepromptPositions, 100);
    updateRepromptPositions();

    // Update on scroll
    const container = document.getElementById('response-container');
    if (container) {
      container.addEventListener('scroll', updateRepromptPositions);
      window.addEventListener('resize', updateRepromptPositions);
      window.addEventListener('scroll', updateRepromptPositions);
    }

    // Use MutationObserver to detect when chunks are added
    const observer = new MutationObserver(() => {
      setTimeout(updateRepromptPositions, 50);
    });
    if (container) {
      observer.observe(container, { childList: true, subtree: true });
    }

    return () => {
      clearTimeout(timeoutId);
      if (container) {
        container.removeEventListener('scroll', updateRepromptPositions);
        window.removeEventListener('resize', updateRepromptPositions);
        window.removeEventListener('scroll', updateRepromptPositions);
      }
      observer.disconnect();
    };
  }, [reprompts, currentConversation, chunkIndices]);

  // Measure sidebar width and calculate dynamic padding
  useEffect(() => {
    const updatePadding = () => {
      // Sidebar uses w-[3.8vw] min-w-[80px]
      const viewportWidth = window.innerWidth;
      const calculatedWidth = Math.max(viewportWidth * 0.038, 80); // 3.8vw with 80px minimum
      setSidebarWidth(calculatedWidth);
      setLeftPadding(calculatedWidth + 30); // 30px greater than sidebar width
    };

    // Initial calculation
    updatePadding();

    // Update on window resize
    window.addEventListener('resize', updatePadding);
    
    return () => {
      window.removeEventListener('resize', updatePadding);
    };
  }, []);

  // Fetch initial messages on component mount
  useEffect(() => {
    fetchMessages();
  }, []);

  // Handle typing detection for follow-up bar
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger if typing in input/textarea
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }

      // Check if it's a printable character
      const isPrintableKey = e.key.length === 1 && 
        !['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Enter', 'Tab', 'Escape'].includes(e.key);
      
      if (isPrintableKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
        setHasTyped(true);
        
        // Check if we're at the end of response - if so, show follow up bar
        // Otherwise, show reprompt input
        const lastMessage = currentConversation[currentConversation.length - 1];
        if (lastMessage && lastMessage.party === 'system') {
          const messageId = lastMessage._id;
          const chunks = parseTextIntoChunks(lastMessage.content);
          const currentChunkIndex = chunkIndices[messageId] || 1;
          
          // If at end of response, show follow up bar
          if (currentChunkIndex >= chunks.length) {
            setShowFollowUpBar(true);
            setShowRepromptInput(false);
          } else {
            // Not at end, show reprompt input
            setShowRepromptInput(true);
            setRepromptMessageId(messageId);
            setShowFollowUpBar(false);
          }
        } else {
          // No messages yet, show follow up bar
          setShowFollowUpBar(true);
          setShowRepromptInput(false);
        }
        
        // Clear timeout
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        
        // Hide after 3 seconds if no input
        typingTimeoutRef.current = setTimeout(() => {
          // Only hide if user hasn't started typing in the input
          const activeElement = document.activeElement;
          if (activeElement.tagName !== 'INPUT' && activeElement.tagName !== 'TEXTAREA') {
            setShowFollowUpBar(false);
            setShowRepromptInput(false);
          }
        }, 3000);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  // Check if user has reached end of all responses
  useEffect(() => {
    const checkEndOfResponse = () => {
      if (currentConversation.length === 0) return;
      
      const lastMessage = currentConversation[currentConversation.length - 1];
      if (lastMessage && lastMessage.party === 'system') {
        const messageId = lastMessage._id;
        const chunks = parseTextIntoChunks(lastMessage.content);
        const currentChunkIndex = chunkIndices[messageId] || 1;
        
        // If user has seen all chunks of the last response, show follow-up bar
        if (currentChunkIndex >= chunks.length) {
          setShowFollowUpBar(true);
        }
      }
    };

    checkEndOfResponse();
  }, [currentConversation, chunkIndices]);

  // Handle scroll for sticky header
  useEffect(() => {
    const handleScroll = () => {
      if (contentRef.current && currentConversation.length > 0) {
        const scrollTop = window.scrollY;
        const contentTop = contentRef.current.offsetTop;
        
        if (scrollTop > contentTop) {
          // Find which response is currently in view
          const responseElements = document.querySelectorAll('[data-message-id]');
          let currentQuestion = null;
          
          // Look for the first user message that is still visible or just scrolled past
          for (let i = 0; i < responseElements.length; i++) {
            const element = responseElements[i];
            const rect = element.getBoundingClientRect();
            const messageId = element.getAttribute('data-message-id');
            const message = currentConversation.find(msg => msg._id === messageId);
            
            // Check if this is a user message and if it's still visible or just scrolled past
            if (message && message.party === 'user') {
              // If the element is still visible or just scrolled past (within 100px above viewport)
              if (rect.top <= window.innerHeight && rect.bottom >= -100) {
                currentQuestion = message.content;
                break;
              }
            }
          }
          
          // If no current question found, use the last user message
          if (!currentQuestion) {
            const userMessages = currentConversation.filter(msg => msg.party === 'user');
            if (userMessages.length > 0) {
              currentQuestion = userMessages[userMessages.length - 1].content;
            }
          }
          
          setStickyQuestion(currentQuestion);
        } else {
          setStickyQuestion(null);
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [currentConversation]);

  const fetchMessages = async () => {
    try {
      console.log('Fetching conversations');
      const response = await axios.get(`${API_URL}/conversations`);
      console.log('Received conversations:', response.data);
      
      // Start with empty conversation - user will create new trees via search
      console.log('Starting with empty conversation');
      setMessages([]);
      setCurrentConversation([]);
      setChunkIndices({});
      setResponseContexts({});
      setReprompts({});
      setUserQueries({});
      setShowFollowUpBar(false);
      setHasTyped(false);
    } catch (error) {
      console.error('Error in fetchMessages:', error);
      setError(error.message);
    }
  };

  const handleChunkNavigate = (messageId, chunkIndex, direction) => {
    if (direction === 'previous') {
      // Navigate to previous response
      const currentIndex = currentConversation.findIndex(msg => msg._id === messageId);
      if (currentIndex > 0) {
        // Find the previous AI response
        for (let i = currentIndex - 1; i >= 0; i--) {
          if (currentConversation[i].party === 'system') {
            // Scroll to that response
            const element = document.querySelector(`[data-message-id="${currentConversation[i]._id}"]`);
            if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            break;
          }
        }
      }
    } else {
      // Update chunk index for this message
      setChunkIndices(prev => ({
        ...prev,
        [messageId]: chunkIndex
      }));
    }
  };

  const handleReprompt = async ({ messageId, newQuery, context, currentChunkIndex, repromptLocation }) => {
    // Add reprompt annotation immediately on submit
    setReprompts(prev => ({
      ...prev,
      [messageId]: [
        ...(prev[messageId] || []),
        {
          chunkIndex: repromptLocation,
          query: newQuery,
          timestamp: Date.now()
        }
      ]
    }));
    
    // Hide reprompt input
    setShowRepromptInput(false);
    setRepromptText('');
    setRepromptMessageId(null);
    
    setLoading(true);
    try {
      // Find the message in current conversation BEFORE modifying it
      const messageIndex = currentConversation.findIndex(msg => msg._id === messageId);
      if (messageIndex === -1) {
        throw new Error('Message not found in current conversation');
      }

      const originalMessage = currentConversation[messageIndex];
      
      // Store the FULL original content before any truncation
      const fullOriginalContent = originalMessage.content;
      
      console.log('Reprompting:', { messageId, newQuery, contextLength: context.length, repromptLocation });
      
      // Parse original content into chunks to find where to truncate
      const originalChunks = parseTextIntoChunks(fullOriginalContent);
      
      // Truncate at the reprompt location chunk (include everything up to and including that chunk)
      // repromptLocation is the index of the chunk where reprompt happened
      let truncatedContent = '';
      for (let i = 0; i <= repromptLocation && i < originalChunks.length; i++) {
        const chunk = originalChunks[i];
        // Add subheader if this is the first chunk of a new section
        if (chunk.hasSubheader && chunk.subheader) {
          if (i > 0) truncatedContent += '\n\n';
          truncatedContent += chunk.subheader + '\n\n';
        } else if (i > 0 && originalChunks[i - 1]?.subheader !== chunk.subheader) {
          // Subheader changed, add it
          if (chunk.subheader) {
            truncatedContent += '\n\n' + chunk.subheader + '\n\n';
          }
        }
        truncatedContent += chunk.fullText;
        if (i < repromptLocation) {
          truncatedContent += ' ';
        }
      }
      
      // Call reprompt endpoint with context as springboard and original content for storage
      const response = await axios.post(`${API_URL}/enhanced-learning/reprompt`, {
        userMessage: newQuery,
        previousContext: context,
        messageId: messageId,
        originalContent: fullOriginalContent  // Send full original content to backend for storage
      });

      console.log('Reprompt response received:', response.data);

      // Append the new reprompt response to the truncated content
      const updatedContent = truncatedContent.trim() + '\n\n' + response.data.ai_response;
      
      // Update the original message with new content (truncated + new response)
      const updatedMessage = {
        ...originalMessage,
        content: updatedContent
      };
      
      // Update context
      setResponseContexts(prev => ({
        ...prev,
        [messageId]: updatedContent
      }));

      // Update conversation - replace the message with updated content
      const updatedConversation = [...currentConversation];
      updatedConversation[messageIndex] = updatedMessage;
      
      setCurrentConversation(updatedConversation);
      
      // Keep the current chunk index (where reprompt happened) so we continue from there
      // The previous content (chunks 0 to repromptLocation) remains visible
      // New content will be appended and parsed as new chunks starting from repromptLocation + 1
      // By preserving currentChunkIndex, we show all content up to where the reprompt happened,
      // and new chunks will appear as the user navigates forward
      // Don't reset to 1 - preserve the current position to maintain continuity

      // Auto-scroll to the updated message after a short delay
      setTimeout(() => {
        const element = document.querySelector(`[data-message-id="${messageId}"]`);
        if (element) {
          element.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'nearest',
            inline: 'nearest'
          });
        }
      }, 100);

    } catch (error) {
      console.error('Error reprompting:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = async (query) => {
    setLoading(true);
    setError(null);
    setShowFollowUpBar(false);
    setHasTyped(false);
    try {
      // If this is the first message, create a new conversation tree
      if (currentConversation.length === 0) {
        // Create new conversation tree (AI response will be generated by backend)
        const treeResponse = await axios.post(`${API_URL}/conversations`, {
          userMessage: query
        });
        
        // Get the conversation from the tree
        const conversationResponse = await axios.get(`${API_URL}/conversations/${treeResponse.data.tree_id}`);
        
        // Add tree_id to each message for future reference
        const messagesWithTreeId = conversationResponse.data.map(msg => ({
          ...msg,
          tree_id: treeResponse.data.tree_id
        }));
        
        setMessages(messagesWithTreeId);
        setCurrentConversation(messagesWithTreeId);
        
        // Store context and initialize chunk indices for AI responses
        const contexts = {};
        const indices = {};
        const queries = {};
        messagesWithTreeId.forEach(msg => {
          if (msg.party === 'system') {
            contexts[msg._id] = msg.content;
            indices[msg._id] = 1; // Start at first chunk
            queries[msg._id] = query; // Store original query
          }
        });
        setResponseContexts(contexts);
        setChunkIndices(indices);
        setUserQueries(queries);
        
        // Auto-scroll to the new response after a short delay
        setTimeout(() => {
          if (lastMessageRef.current) {
            lastMessageRef.current.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'start',
              inline: 'nearest'
            });
          }
        }, 100);
      } else {
        // Add to existing conversation
        const parentMessage = currentConversation[currentConversation.length - 1];
        
        // Find the actual user message node ID (not the AI response)
        // For follow-up questions, we need to find the last user message node
        let parentNodeId;
        
        // Look for the last user message in the conversation
        for (let i = currentConversation.length - 1; i >= 0; i--) {
          if (currentConversation[i].party === 'user') {
            parentNodeId = currentConversation[i]._id;
            break;
          }
        }
        
        // If no user message found, use the last message as fallback
        if (!parentNodeId) {
          parentNodeId = parentMessage._id;
        }
        
        // Add message to existing tree (AI response will be generated by backend)
        await axios.post(`${API_URL}/conversations/${parentMessage.tree_id}/messages`, {
          userMessage: query,
          parentNodeId: parentNodeId
        });
        
        // Refresh conversation
        const conversationResponse = await axios.get(`${API_URL}/conversations/${parentMessage.tree_id}`);
        
        // Add tree_id to each message for future reference
        const messagesWithTreeId = conversationResponse.data.map(msg => ({
          ...msg,
          tree_id: parentMessage.tree_id
        }));
        
        setMessages(messagesWithTreeId);
        setCurrentConversation(messagesWithTreeId);
        
        // Store context and initialize chunk indices for new AI responses
        const contexts = { ...responseContexts };
        const indices = { ...chunkIndices };
        const queries = { ...userQueries };
        messagesWithTreeId.forEach(msg => {
          if (msg.party === 'system' && !contexts[msg._id]) {
            contexts[msg._id] = msg.content;
            indices[msg._id] = 1; // Start at first chunk
            queries[msg._id] = query; // Store original query
          }
        });
        setResponseContexts(contexts);
        setChunkIndices(indices);
        setUserQueries(queries);
        
        // Auto-scroll to the new response after a short delay
        setTimeout(() => {
          if (lastMessageRef.current) {
            lastMessageRef.current.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'start',
              inline: 'nearest'
            });
          }
        }, 100);
      }
    } catch (e) {
      console.error('Error in handleSearchSubmit:', e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Get previous context for a message (all previous responses)
  const getPreviousContext = (messageId) => {
    const messageIndex = currentConversation.findIndex(msg => msg._id === messageId);
    if (messageIndex === -1) return '';

    // Get all previous AI responses
    const previousResponses = currentConversation
      .slice(0, messageIndex)
      .filter(msg => msg.party === 'system')
      .map(msg => responseContexts[msg._id] || msg.content)
      .join('\n\n');

    return previousResponses;
  };

  return (
    <div className="min-h-screen bg-[#181b1a] text-[#e8e9e2]" style={{ fontFamily: 'sans-serif' }}>
      {/* Sidebar */}
      <div ref={sidebarRef}>
        <Sidebar />
      </div>
      
      {/* Sticky Header */}
      {stickyQuestion && (
        <div className="fixed top-0 left-[3.8vw] right-0 z-40 bg-[#181b1a] py-4">
          <div className="px-8" style={{ width: '110%', marginLeft: '-5%' }}>
            <div className="max-w-4xl mx-auto">
              <h1 className="text-2xl font-medium text-[#e8e9e2] border-2 border-[#00C8C8] p-4 rounded-lg overflow-hidden" style={{ fontFamily: 'sans-serif', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                {stickyQuestion}
              </h1>
            </div>
          </div>
        </div>
      )}

      {/* Main content area - sidebar doesn't affect width */}
      <div className="min-h-screen" style={{ marginLeft: 0, width: '100vw', position: 'relative' }}>
        {error && (
          <div className="max-w-4xl mx-auto mb-8 bg-red-500 text-white p-4 rounded-lg">
            Error: {error}
          </div>
        )}

        {/* Initial centered search bar */}
        {currentConversation.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-screen">
            <div className="text-6xl font-semibold text-[#e8e9e2] mb-8">not perplexity</div>
            <div className="w-[60vw] max-w-4xl">
              <EnhancedLearningChatInput onSubmit={handleSearchSubmit} isCentered={true} />
            </div>
          </div>
        ) : (
          <div ref={contentRef} style={{ 
            position: 'relative',
            marginLeft: `${leftPadding}px`, // Start after sidebar + 30px
            width: `calc(100vw - ${leftPadding}px - 196px)`, // Extends from left margin to 196px from right edge (pink line)
            paddingLeft: '0', // No padding - text extends fully
            paddingRight: '0', // No padding - text extends to pink line
            marginRight: '0'
          }}>
            {/* Response display - extends from sidebar to right edge, left-aligned content */}
            <div style={{ position: 'relative', width: '100%' }}>
              <div 
                ref={responseContainerRef}
                className="fixed-height-container" 
                id="response-container"
                style={{ 
                  maxHeight: '100vh', 
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  scrollBehavior: 'smooth',
                  width: '100%',
                  wordWrap: 'break-word',
                  overflowWrap: 'break-word',
                  position: 'relative',
                  marginRight: '0',
                  paddingRight: '0',
                  paddingBottom: '0',
                  marginBottom: '0',
                  maxWidth: '100%' // Ensure text extends fully
                }}
              >
              {/* Vertical bar on right edge - fixed from top to bottom of viewport */}
              <div style={{
                position: 'fixed',
                right: '196px', // Position at pink line (196px from right edge)
                top: '0',
                bottom: '0',
                width: '1px',
                backgroundColor: '#374151', // Same as sidebar border-gray-700
                zIndex: 10,
                pointerEvents: 'none'
              }} />
              
                <style>{`
                  /* Scrollbar positioned at absolute right edge of viewport */
                  #response-container {
                    padding-right: 0 !important;
                    margin-right: 0 !important;
                  }
                  /* Create a custom scrollbar track at viewport edge */
                  body {
                    --scrollbar-width: 8px;
                  }
                  #response-container::-webkit-scrollbar {
                    width: 8px;
                    opacity: 0;
                    transition: opacity 0.3s ease;
                  }
                  #response-container::-webkit-scrollbar-track {
                    background: transparent;
                    position: fixed;
                    right: 0;
                  }
                  #response-container::-webkit-scrollbar-thumb {
                    background: rgba(200, 200, 200, 0.3);
                    border-radius: 4px;
                  }
                  #response-container::-webkit-scrollbar-thumb:hover {
                    background: rgba(200, 200, 200, 0.5);
                  }
                  #response-container.scrolling::-webkit-scrollbar {
                    opacity: 1;
                  }
                  /* Firefox scrollbar */
                  #response-container {
                    scrollbar-width: thin;
                    scrollbar-color: rgba(200, 200, 200, 0.3) transparent;
                  }
                  #response-container * {
                    overflow-wrap: break-word;
                    word-wrap: break-word;
                    max-width: 100%;
                  }
                `}</style>
              {currentConversation.length > 0 && (
                <div className="space-y-8" style={{ width: '100%', padding: 0, margin: 0, maxWidth: 'none' }}>
                  {currentConversation.map((message, index) => (
                    <div 
                      key={message._id} 
                      data-message-id={message._id}
                      ref={index === currentConversation.length - 1 ? lastMessageRef : null}
                      style={{ width: '100%' }}
                    >
                      {message.party === 'user' ? (
                        // Only show first user query, hide subsequent ones
                        index === 0 ? (
                          <div className="mb-8" style={{ marginTop: '80px' }}>
                            <h1 className="text-2xl font-medium text-[#e8e9e2] mb-4 border-2 border-[#00C8C8] p-4 rounded-lg overflow-hidden mx-auto" style={{ 
                              fontFamily: 'sans-serif', 
                              display: '-webkit-box', 
                              WebkitLineClamp: 3, 
                              WebkitBoxOrient: 'vertical', 
                              textAlign: 'center',
                              maxWidth: '900px',
                              width: '100%'
                            }}>
                              {message.content}
                            </h1>
                          </div>
                        ) : null
                      ) : (
                        <div className="space-y-6" style={{ width: '100%' }}>
                          <div className="prose prose-invert max-w-none relative" style={{ width: '100%', maxWidth: 'none' }}>
                            <IncrementalResponse
                              fullText={message.content}
                              messageId={message._id}
                              onReprompt={handleReprompt}
                              onNavigate={handleChunkNavigate}
                              currentChunkIndex={chunkIndices[message._id] || 1}
                              previousContext={getPreviousContext(message._id)}
                              reprompts={reprompts[message._id] || []}
                              isRepromptResponse={message.isRepromptResponse || false}
                              onShowRepromptInput={(msgId) => {
                                setShowRepromptInput(true);
                                setRepromptMessageId(msgId);
                                setShowFollowUpBar(false);
                              }}
                              onHideRepromptInput={() => {
                                setShowRepromptInput(false);
                                setRepromptMessageId(null);
                                // Show follow up bar if at end of response
                                const lastMsg = currentConversation[currentConversation.length - 1];
                                if (lastMsg && lastMsg.party === 'system' && lastMsg._id === message._id) {
                                  const chunks = parseTextIntoChunks(lastMsg.content);
                                  const currentChunkIndex = chunkIndices[lastMsg._id] || 1;
                                  if (currentChunkIndex >= chunks.length) {
                                    setShowFollowUpBar(true);
                                  }
                                }
                              }}
                            />
                          </div>
                        
                      </div>
                    )}
                  </div>
                ))}
                </div>
              )}
              </div>
            </div>
            
            {loading && (
              <div className="fixed top-4 right-4 z-50">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#e8e9e2]"></div>
              </div>
            )}
          </div>
        )}
        
        {/* Gaussian blur overlay - from bottom of viewport to top of input boxes, from sidebar to vertical bar */}
        {/* Strongest blur at top edge of prompt box (bottom), weakest at top edge of blur area */}
        {(showFollowUpBar || showRepromptInput) && (
          <div 
            className="fixed z-40"
            style={{
              left: `${leftPadding}px`, // Start at right edge of sidebar
              right: '196px', // End at vertical bar (pink line)
              bottom: '0',
              height: '120px', // Height from bottom to top of input boxes (bottom-8 = 32px + box height ~60px + margin)
              background: 'linear-gradient(to top, rgba(24, 27, 26, 0.95) 0%, rgba(24, 27, 26, 0.7) 30%, rgba(24, 27, 26, 0.4) 60%, transparent 100%)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              maskImage: 'linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.8) 30%, rgba(0,0,0,0.4) 60%, rgba(0,0,0,0) 100%)',
              WebkitMaskImage: 'linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.8) 30%, rgba(0,0,0,0.4) 60%, rgba(0,0,0,0) 100%)',
              pointerEvents: 'none'
            }}
          />
        )}
        
        {/* Reprompt annotations - positioned in 196px space on right, scrolls with content */}
        <div style={{
          position: 'fixed',
          right: '0',
          top: '0',
          bottom: '0',
          width: '196px',
          pointerEvents: 'none',
          zIndex: 15,
          overflow: 'visible'
        }}>
          {currentConversation.map((message) => {
            if (message.party === 'system' && reprompts[message._id] && reprompts[message._id].length > 0) {
              return reprompts[message._id].map((reprompt, repromptIndex) => {
                const positionKey = `${message._id}-${repromptIndex}`;
                const topPosition = repromptPositions[positionKey] !== undefined 
                  ? repromptPositions[positionKey] 
                  : reprompt.chunkIndex * 50; // Fallback estimate
                
                return (
                  <div
                    key={`reprompt-${message._id}-${repromptIndex}`}
                    style={{
                      position: 'absolute',
                      right: '8px', // Padding from right edge
                      top: `${topPosition}px`,
                      width: '180px',
                      pointerEvents: 'auto'
                    }}
                  >
                    <div className="flex items-start gap-2">
                      {/* Left arrow pointing to chunk */}
                      <div className="flex-shrink-0 mt-1">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-[#00C8C8]">
                          <path
                            d="M10 18L4 12L10 6M4 12L20 12"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>
                      {/* Blue box with reprompt query */}
                      <div className="flex-1 rounded-lg p-3 shadow-lg" style={{ 
                        border: '2px solid #00C8C8',
                        backgroundColor: 'rgba(0, 200, 200, 0.1)'
                      }}>
                        <div className="text-xs text-[#00C8C8] mb-1 font-semibold" style={{ fontFamily: 'sans-serif' }}>
                          Reprompt:
                        </div>
                        <div className="text-sm text-[#e8e9e2] leading-relaxed" style={{ fontFamily: 'sans-serif' }}>
                          {reprompt.query}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              });
            }
            return null;
          })}
        </div>
        
        {/* Fixed follow-up button at bottom center - only show at end of response when no reprompt active */}
        {showFollowUpBar && !showRepromptInput && (
          <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50" style={{ width: '600px', maxWidth: '90vw' }}>
            <EnhancedLearningChatInput 
              onSubmit={handleSearchSubmit}
              placeholder="Ask a follow-up..."
              isCentered={false}
            />
          </div>
        )}
        
        {/* Fixed reprompt input at bottom center - only show when typing detected */}
        {showRepromptInput && repromptMessageId && (
          <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50" style={{ width: '600px', maxWidth: '90vw' }}>
            <div className="relative bg-[#27272A] rounded-2xl border border-gray-600 focus-within:border-[#00C8C8] transition-colors">
              <form onSubmit={async (e) => {
                e.preventDefault();
                if (repromptText.trim()) {
                  const message = currentConversation.find(msg => msg._id === repromptMessageId);
                  if (message) {
                    const chunks = parseTextIntoChunks(message.content);
                    const currentChunkIndex = chunkIndices[repromptMessageId] || 1;
                    const visibleChunkTexts = chunks.slice(0, currentChunkIndex).map(chunk => chunk.fullText).join(' ');
                    const fullContext = getPreviousContext(repromptMessageId) 
                      ? `${getPreviousContext(repromptMessageId)}\n\n${visibleChunkTexts}`
                      : visibleChunkTexts;
                    
                    await handleReprompt({
                      messageId: repromptMessageId,
                      newQuery: repromptText.trim(),
                      context: fullContext,
                      currentChunkIndex: currentChunkIndex,
                      repromptLocation: currentChunkIndex - 1
                    });
                  }
                }
              }}>
                {/* Left side icon */}
                <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
                  <FaSearch className="w-4 h-4 text-[#5f5f5f]" />
                </div>
                
                {/* Input field - matches EnhancedLearningChatInput styling */}
                <textarea
                  value={repromptText}
                  onChange={(e) => {
                    setRepromptText(e.target.value);
                    // Auto-resize textarea to match follow-up box
                    e.target.style.height = 'auto';
                    const newHeight = Math.min(e.target.scrollHeight, 144); // 6 lines max (24px per line)
                    e.target.style.height = newHeight + 'px';
                  }}
                  className="w-full bg-transparent text-[#e8e9e2] p-4 pl-12 pr-16 focus:outline-none min-h-[60px] max-h-[144px] resize-none flex items-center overflow-y-auto"
                  placeholder="Type your updated query or direction..."
                  rows={1}
                  style={{ fontFamily: 'sans-serif', lineHeight: '1.5' }}
                  autoFocus
                />
                
                {/* Right side submit button */}
                <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                  <button
                    type="submit"
                    disabled={loading || !repromptText.trim()}
                    aria-label="Submit"
                    className="bg-[#00C8C8] hover:bg-[#00B0B0] text-white p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      <FaArrowRight className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default EnhancedLearningApp;
