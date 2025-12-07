import { GoogleGenAI } from "@google/genai";
import dotenv from 'dotenv';

dotenv.config();

// Initialize the Gemini AI client
const genAI = new GoogleGenAI(process.env.GEMINI_API_KEY);

/**
 * Generate AI response using Google Gemini
 * @param {string} userMessage - The user's message
 * @param {Array} conversationContext - Previous conversation context
 * @param {string} highlightedText - Optional highlighted text from parent response
 * @returns {Promise<string>} The AI generated response
 */
export async function generateGeminiResponse(userMessage, conversationContext = [], highlightedText = null) {
  try {
    // Check if API key is configured
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
      throw new Error('Gemini API key not configured. Please set GEMINI_API_KEY in your .env file.');
    }

    // Build conversation history for context
    let conversationHistory = '';
    if (conversationContext.length > 0) {
      conversationHistory = conversationContext.map(msg => 
        `${msg.party === 'user' ? 'User' : 'AI'}: ${msg.content}`
      ).join('\n') + '\n\n';
    }

    // Add highlighted text context if provided
    let highlightedContext = '';
    if (highlightedText) {
      highlightedContext = `\nNote: The user is asking about this specific part of the previous response: "${highlightedText}"\n\n`;
    }

    // Add formatting instructions for enhanced learning mode
    const formattingInstructions = `\n\nFormat your response as follows:
- Use clear subheaders (on their own line, no asterisks or markdown) that explain what the next few chunks will cover
- Subheaders should be concise and descriptive (under 80 characters)
- Write in paragraph form, not with asterisks or bullet points
- Each subheader should introduce a new topic or section
- Keep the same subheader if the information continues the same topic
- After a subheader, write as many sentences as needed to fully address the topic and answer the user's query comprehensively
- Some sections may require greater depth and detail - adjust the length accordingly to ensure all relevant information is provided
- Flow naturally like a book chapter, providing thorough coverage of each topic\n\n`;

    // Create the prompt with context
    const prompt = conversationHistory + highlightedContext + formattingInstructions + `User: ${userMessage}\nAI:`;

    // Generate content using the models.generateContent method
    const result = await genAI.models.generateContent({
      model: "gemini-2.5-flash-lite",
      contents: prompt
    });
    
    // Extract text from the response structure
    const text = result.candidates[0].content.parts[0].text;

    return text.trim();
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    
    // Return a fallback response if API fails
    if (error.message.includes('API key not configured')) {
      return `Error: ${error.message}`;
    }
    
    return `I apologize, but I encountered an error: ${error.message}. Please try again later.`;
  }
}

/**
 * Generate AI response for reprompting - uses previous response as context springboard
 * @param {string} userMessage - The user's reprompt query
 * @param {string} previousContext - Previous generated text to use as context springboard
 * @returns {Promise<string>} The AI generated response
 */
export async function generateGeminiRepromptResponse(userMessage, previousContext = '') {
  try {
    // Check if API key is configured
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
      throw new Error('Gemini API key not configured. Please set GEMINI_API_KEY in your .env file.');
    }

    // Build context prompt with springboard instruction
    let contextPrompt = '';
    if (previousContext) {
      contextPrompt = `Previous response context (use this as a springboard to answer the new question):\n${previousContext}\n\n`;
      contextPrompt += `IMPORTANT: Use the previous response context above as a springboard to answer the user's new question. Build upon the information provided, extend it, or redirect it based on the new query. Do not simply repeat the previous response.\n\n`;
    }

    // Add formatting instructions for reprompting
    const formattingInstructions = `\n\nFormat your response as follows:
- Use clear subheaders (on their own line, no asterisks or markdown) that explain what the next few chunks will cover
- Subheaders should be concise and descriptive (under 80 characters)
- Write in paragraph form, not with asterisks or bullet points
- Each subheader should introduce a new topic or section
- Keep the same subheader if the information continues the same topic
- After a subheader, write as many sentences as needed to fully address the topic and answer the user's query comprehensively
- Some sections may require greater depth and detail - adjust the length accordingly to ensure all relevant information is provided
- Flow naturally like a book chapter, providing thorough coverage of each topic
- Continue seamlessly from where the previous response left off, building upon the existing context\n\n`;

    // Create the prompt with context
    const prompt = contextPrompt + formattingInstructions + `User: ${userMessage}\nAI:`;
    
    // Log prompt length for debugging
    console.log('Reprompt prompt length:', prompt.length, 'characters');
    if (prompt.length > 100000) {
      console.warn('Warning: Prompt is very long, may cause issues');
    }

    // Generate content using the models.generateContent method
    console.log('Calling Gemini API for reprompt with model: gemini-2.5-flash-lite');
    const result = await genAI.models.generateContent({
      model: "gemini-2.5-flash-lite",
      contents: prompt
    });
    
    console.log('Gemini API response received, checking structure...');
    console.log('Result keys:', result ? Object.keys(result) : 'result is null/undefined');
    
    // Extract text from the response structure with error handling
    if (!result || !result.candidates || !result.candidates[0]) {
      console.error('Invalid response structure - result:', JSON.stringify(result, null, 2));
      throw new Error('Invalid response structure from Gemini API: no candidates found');
    }
    
    if (!result.candidates[0].content || !result.candidates[0].content.parts || !result.candidates[0].content.parts[0]) {
      console.error('Invalid content structure - candidates[0]:', JSON.stringify(result.candidates[0], null, 2));
      throw new Error('Invalid response structure from Gemini API: no content parts found');
    }
    
    const text = result.candidates[0].content.parts[0].text;
    
    if (!text) {
      console.error('Empty text in response - parts[0]:', JSON.stringify(result.candidates[0].content.parts[0], null, 2));
      throw new Error('Empty response from Gemini API');
    }

    console.log('Successfully extracted text from Gemini response, length:', text.length);
    return text.trim();
  } catch (error) {
    console.error('Error calling Gemini API for reprompt:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      response: error.response?.data || error.response || 'No response data',
      code: error.code
    });
    
    // Re-throw the error so the server can handle it properly
    throw error;
  }
}

/**
 * Test the Gemini API connection
 * @returns {Promise<boolean>} True if connection successful, false otherwise
 */
export async function testGeminiConnection() {
  try {
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
      return false;
    }

    const result = await genAI.models.generateContent({
      model: "gemini-2.5-flash-lite",
      contents: "Hello"
    });
    
    return true;
  } catch (error) {
    console.error('Gemini connection test failed:', error);
    return false;
  }
}
