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

    // Create the prompt with context
    const prompt = conversationHistory + highlightedContext + `User: ${userMessage}\nAI:`;

    // Generate content using the models.generateContent method
    const result = await genAI.models.generateContent({
      model: "gemini-2.0-flash-exp",
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
 * Test the Gemini API connection
 * @returns {Promise<boolean>} True if connection successful, false otherwise
 */
export async function testGeminiConnection() {
  try {
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
      return false;
    }

    const result = await genAI.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: "Hello"
    });
    
    return true;
  } catch (error) {
    console.error('Gemini connection test failed:', error);
    return false;
  }
}
