import React, { useState, useEffect, useRef } from 'react';
import HighlightableResponse from './HighlightableResponse';
import ChatInput from './ChatInput';
import TreeVisual from './TreeVisual';
import Sidebar from './Sidebar';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

function StandardApp() {
  const [messages, setMessages] = useState([]);
  const [currentConversation, setCurrentConversation] = useState([]);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [stickyQuestion, setStickyQuestion] = useState(null);
  const contentRef = useRef(null);
  const lastMessageRef = useRef(null);

  // Fetch initial messages on component mount
  useEffect(() => {
    fetchMessages();
  }, []);

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
      setSelectedNodeId(null);
    } catch (error) {
      console.error('Error in fetchMessages:', error);
      setError(error.message);
    }
  };

  const handlePromptSubmit = async ({ highlightedText, prompt }) => {
    setLoading(true);
    try {
      console.log('Submitting prompt:', { highlightedText, prompt });
      
      // Find the current tree ID
      const currentTreeId = messages.find(m => m.tree_id)?.tree_id;
      if (!currentTreeId) {
        throw new Error('No conversation tree found');
      }

      // Find the parent node ID - this should be the user message node that contains the highlighted text
      // We need to find the user message node that corresponds to the AI response containing the highlighted text
      let parentNodeId = null;
      
      // Look for the user message node that has the AI response containing the highlighted text
      for (let i = 0; i < currentConversation.length; i++) {
        if (currentConversation[i].party === 'system' && currentConversation[i].content.includes(highlightedText)) {
          // Find the corresponding user message node
          for (let j = 0; j < currentConversation.length; j++) {
            if (currentConversation[j].party === 'user' && currentConversation[j]._id === currentConversation[i].parent.reference) {
              parentNodeId = currentConversation[j]._id;
              break;
            }
          }
          break;
        }
      }
      
      // Fallback: if we can't find the specific node, use the last user message
      if (!parentNodeId) {
        for (let i = currentConversation.length - 1; i >= 0; i--) {
          if (currentConversation[i].party === 'user') {
            parentNodeId = currentConversation[i]._id;
            break;
          }
        }
      }

      if (!parentNodeId) {
        throw new Error('No parent node found for the highlighted text');
      }

      console.log('Adding branch to tree:', { currentTreeId, parentNodeId, prompt, highlightedText });

      // Add message to existing tree using the proper tree API
      const response = await axios.post(`${API_URL}/conversations/${currentTreeId}/messages`, {
        userMessage: prompt,
        parentNodeId: parentNodeId,
        highlightedText: highlightedText
      });

      console.log('Branch created successfully:', response.data);

      // Refresh the conversation to show the new branch
      const conversationResponse = await axios.get(`${API_URL}/conversations/${currentTreeId}`);
      
      // Add tree_id to each message for future reference
      const messagesWithTreeId = conversationResponse.data.map(msg => ({
        ...msg,
        tree_id: currentTreeId
      }));
      
      setMessages(messagesWithTreeId);
      
      // Show the conversation path to the new node
      const newConversationPath = await axios.get(`${API_URL}/conversations/${currentTreeId}/path/${response.data.node_id}`);
      setCurrentConversation(newConversationPath.data);
      setSelectedNodeId(response.data.node_id);
      
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
      
    } catch (error) {
      console.error('Error in handlePromptSubmit:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleNodeSelect = async (nodeId) => {
    console.log('Selecting node:', nodeId);
    setSelectedNodeId(nodeId);
    try {
      // Find the tree_id from the current messages
      const currentTreeId = messages.find(m => m.tree_id)?.tree_id;
      
      if (!currentTreeId) {
        console.error('No tree ID found in current messages');
        setError('No conversation tree found');
        return;
      }

      // Get the conversation path from root to the selected node
      const response = await axios.get(`${API_URL}/conversations/${currentTreeId}/path/${nodeId}`);
      console.log('Selected conversation path:', response.data);

      setCurrentConversation(response.data);
    } catch (error) {
      console.error('Error in handleNodeSelect:', error);
      setError(error.message);
    }
  };

  const handleSearchSubmit = async (query) => {
    setLoading(true);
    setError(null);
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
        setSelectedNodeId(messagesWithTreeId[messagesWithTreeId.length - 1]._id);
        
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
        setSelectedNodeId(messagesWithTreeId[messagesWithTreeId.length - 1]._id);
        
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

  return (
    <div className="min-h-screen bg-[#181b1a] text-[#e8e9e2]" style={{ fontFamily: 'sans-serif' }}>
      {/* Sidebar */}
      <Sidebar />
      
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

      {/* Main content area */}
      <div className="ml-[3.8vw] min-h-screen">
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
              <ChatInput onSubmit={handleSearchSubmit} isCentered={true} />
            </div>
          </div>
        ) : (
          /* Response display */
          <div ref={contentRef} className="px-8 py-8 max-w-4xl mx-auto">
            {currentConversation.length > 0 && (
              <div className="space-y-8">
                {currentConversation.map((message, index) => (
                  <div 
                    key={message._id} 
                    data-message-id={message._id}
                    ref={index === currentConversation.length - 1 ? lastMessageRef : null}
                  >
                    {message.party === 'user' ? (
                      <div className="mb-8">
                        <h1 className="text-2xl font-medium text-[#e8e9e2] mb-4 border-2 border-[#00C8C8] p-4 rounded-lg overflow-hidden" style={{ fontFamily: 'sans-serif', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                          {message.content}
                        </h1>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        <div className="prose prose-invert max-w-none">
                          <div className="text-[#e8e9e2] leading-relaxed" style={{ fontFamily: 'sans-serif' }}>
                            <HighlightableResponse
                              text={message.content}
                              onPromptSubmit={handlePromptSubmit}
                            />
                          </div>
                        </div>
                        
                        {/* Follow-up Search Bar - only show after the last AI response */}
                        {index === currentConversation.length - 1 && (
                          <div className="mt-12 mb-8">
                            <ChatInput 
                              onSubmit={handleSearchSubmit}
                              placeholder="Ask a follow-up..."
                              isCentered={false}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            
            {loading && (
              <div className="fixed top-4 right-4 z-50">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#e8e9e2]"></div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tree visualization */}
      {currentConversation.length > 0 && (
        <TreeVisual
          responses={messages}
          selectedNodeId={selectedNodeId}
          onNodeSelect={handleNodeSelect}
        />
      )}
    </div>
  );
}

export default StandardApp;

