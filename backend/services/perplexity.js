import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';
const PERPLEXITY_MODEL = 'sonar';

/**
 * Get Perplexity API key from environment
 * @returns {string} The API key
 */
function getApiKey() {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey || apiKey === 'your_perplexity_api_key_here') {
    throw new Error('Perplexity API key not configured. Please set PERPLEXITY_API_KEY in your environment variables.');
  }
  return apiKey;
}

/**
 * Convert conversation context to Perplexity message format
 * @param {Array} conversationContext - Previous conversation context
 * @param {string} highlightedText - Optional highlighted text from parent response
 * @param {string} userMessage - The user's current message
 * @returns {Array} Array of messages in OpenAI format
 */
function buildMessages(conversationContext = [], highlightedText = null, userMessage = '') {
  const messages = [];

  // Add conversation history
  if (conversationContext.length > 0) {
    conversationContext.forEach(msg => {
      messages.push({
        role: msg.party === 'user' ? 'user' : 'assistant',
        content: msg.content
      });
    });
  }

  // Add highlighted text context if provided
  if (highlightedText) {
    messages.push({
      role: 'user',
      content: `Note: The user is asking about this specific part of the previous response: "${highlightedText}"`
    });
  }

  // Add the current user message
  if (userMessage) {
    messages.push({
      role: 'user',
      content: userMessage
    });
  }

  return messages;
}

/**
 * JSON Schema for Enhanced Learning mode responses
 * Optimized for smaller chunks to enable frequent reprompting
 */
const getResponseSchema = () => ({
  type: 'object',
  properties: {
    sections: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          subheader: {
            type: 'string',
            description: 'A concise subheader (under 80 characters) that describes the section topic'
          },
          chunks: {
            type: 'array',
            items: {
              type: 'string',
              description: 'A chunk of content (2-4 sentences) that addresses the subheader topic'
            },
            description: 'Array of content chunks for this section. Each chunk should be 2-4 sentences to enable frequent reprompting.'
          }
        },
        required: ['subheader', 'chunks']
      },
      description: 'Array of sections, each with a subheader and content chunks'
    }
  },
  required: ['sections']
});

/**
 * Convert JSON schema response to plain text format for frontend compatibility
 * @param {Object} jsonResponse - The JSON response from Perplexity
 * @returns {string} Plain text formatted response
 */
function convertJsonToText(jsonResponse) {
  if (!jsonResponse || !jsonResponse.sections || !Array.isArray(jsonResponse.sections)) {
    return '';
  }

  const textParts = [];

  jsonResponse.sections.forEach((section, index) => {
    // Add subheader on its own line
    if (section.subheader) {
      if (index > 0) {
        textParts.push('\n\n');
      }
      textParts.push(section.subheader);
      textParts.push('\n\n');
    }

    // Add chunks as paragraphs
    if (section.chunks && Array.isArray(section.chunks)) {
      section.chunks.forEach((chunk, chunkIndex) => {
        if (chunk && chunk.trim()) {
          textParts.push(chunk.trim());
          // Add space between chunks, but not after the last chunk of the last section
          if (chunkIndex < section.chunks.length - 1 || index < jsonResponse.sections.length - 1) {
            textParts.push(' ');
          }
        }
      });
    }
  });

  return textParts.join('').trim();
}

/**
 * Generate AI response using Perplexity API
 * @param {string} userMessage - The user's message
 * @param {Array} conversationContext - Previous conversation context
 * @param {string} highlightedText - Optional highlighted text from parent response
 * @returns {Promise<string>} The AI generated response in plain text format
 */
export async function generatePerplexityResponse(userMessage, conversationContext = [], highlightedText = null) {
  try {
    // Check if API key is configured
    if (!process.env.PERPLEXITY_API_KEY || process.env.PERPLEXITY_API_KEY === 'your_perplexity_api_key_here') {
      throw new Error('Perplexity API key not configured. Please set PERPLEXITY_API_KEY in your .env file.');
    }

    // Build messages for conversation context
    const messages = buildMessages(conversationContext, highlightedText, userMessage);

    // Add formatting instructions for enhanced learning mode
    const formattingInstructions = `Format your response as follows:
- Use clear subheaders (on their own line, no asterisks or markdown) that explain what the next few chunks will cover
- Subheaders should be concise and descriptive (under 80 characters)
- Write in paragraph form, not with asterisks or bullet points
- Each subheader should introduce a new topic or section
- Keep the same subheader if the information continues the same topic
- After a subheader, write as many sentences as needed to fully address the topic and answer the user's query comprehensively
- Some sections may require greater depth and detail - adjust the length accordingly to ensure all relevant information is provided
- Flow naturally like a book chapter, providing thorough coverage of each topic
- Break content into smaller chunks (2-4 sentences per chunk) to enable frequent reprompting`;

    // Add system message with formatting instructions
    const systemMessage = {
      role: 'system',
      content: formattingInstructions
    };

    // Prepare the request
    const requestBody = {
      model: PERPLEXITY_MODEL,
      messages: [systemMessage, ...messages],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'enhanced_learning_response',
          strict: true,
          schema: getResponseSchema()
        }
      },
      temperature: 0.7,
      max_tokens: 4000
    };

    // Make API call to Perplexity
    const response = await axios.post(
      PERPLEXITY_API_URL,
      requestBody,
      {
        headers: {
          'Authorization': `Bearer ${getApiKey()}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // Extract the response content
    const responseContent = response.data.choices[0]?.message?.content;
    if (!responseContent) {
      throw new Error('No response content from Perplexity API');
    }

    // Parse JSON response
    let jsonResponse;
    try {
      jsonResponse = typeof responseContent === 'string' 
        ? JSON.parse(responseContent) 
        : responseContent;
    } catch (parseError) {
      console.error('Error parsing JSON response:', parseError);
      console.error('Response content:', responseContent);
      // Fallback: try to extract text if JSON parsing fails
      return responseContent;
    }

    // Convert JSON schema response to plain text for frontend compatibility
    const textResponse = convertJsonToText(jsonResponse);

    if (!textResponse || textResponse.trim().length === 0) {
      throw new Error('Empty response from Perplexity API after conversion');
    }

    return textResponse.trim();
  } catch (error) {
    console.error('Error calling Perplexity API:', error);
    
    // Return a fallback response if API fails
    if (error.message.includes('API key not configured')) {
      return `Error: ${error.message}`;
    }
    
    if (error.response) {
      console.error('Perplexity API error response:', error.response.data);
      return `I apologize, but I encountered an error with the API: ${error.response.data?.error?.message || error.message}. Please try again later.`;
    }
    
    return `I apologize, but I encountered an error: ${error.message}. Please try again later.`;
  }
}

/**
 * Generate AI response for reprompting - uses previous response as context springboard
 * @param {string} userMessage - The user's reprompt query
 * @param {string} previousContext - Previous generated text to use as context springboard
 * @returns {Promise<string>} The AI generated response in plain text format
 */
export async function generatePerplexityRepromptResponse(userMessage, previousContext = '') {
  try {
    // Check if API key is configured
    if (!process.env.PERPLEXITY_API_KEY || process.env.PERPLEXITY_API_KEY === 'your_perplexity_api_key_here') {
      throw new Error('Perplexity API key not configured. Please set PERPLEXITY_API_KEY in your .env file.');
    }

    // Build context prompt with springboard instruction
    let contextPrompt = '';
    if (previousContext) {
      contextPrompt = `Previous response context (use this as a springboard to answer the new question):\n${previousContext}\n\n`;
      contextPrompt += `IMPORTANT: Use the previous response context above as a springboard to answer the user's new question. Build upon the information provided, extend it, or redirect it based on the new query. Do not simply repeat the previous response.\n\n`;
    }

    // Add formatting instructions for reprompting
    const formattingInstructions = `Format your response as follows:
- Use clear subheaders (on their own line, no asterisks or markdown) that explain what the next few chunks will cover
- Subheaders should be concise and descriptive (under 80 characters)
- Write in paragraph form, not with asterisks or bullet points
- Each subheader should introduce a new topic or section
- Keep the same subheader if the information continues the same topic
- After a subheader, write as many sentences as needed to fully address the topic and answer the user's query comprehensively
- Some sections may require greater depth and detail - adjust the length accordingly to ensure all relevant information is provided
- Flow naturally like a book chapter, providing thorough coverage of each topic
- Continue seamlessly from where the previous response left off, building upon the existing context
- Break content into smaller chunks (2-4 sentences per chunk) to enable frequent reprompting`;

    // Build messages
    const messages = [];
    if (contextPrompt) {
      messages.push({
        role: 'user',
        content: contextPrompt
      });
    }
    messages.push({
      role: 'user',
      content: userMessage
    });

    // Add system message with formatting instructions
    const systemMessage = {
      role: 'system',
      content: formattingInstructions
    };

    // Log prompt length for debugging
    const fullPrompt = contextPrompt + userMessage;
    console.log('Reprompt prompt length:', fullPrompt.length, 'characters');
    if (fullPrompt.length > 100000) {
      console.warn('Warning: Prompt is very long, may cause issues');
    }

    // Prepare the request
    const requestBody = {
      model: PERPLEXITY_MODEL,
      messages: [systemMessage, ...messages],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'enhanced_learning_response',
          strict: true,
          schema: getResponseSchema()
        }
      },
      temperature: 0.7,
      max_tokens: 4000
    };

    // Make API call to Perplexity
    console.log('Calling Perplexity API for reprompt with model:', PERPLEXITY_MODEL);
    const response = await axios.post(
      PERPLEXITY_API_URL,
      requestBody,
      {
        headers: {
          'Authorization': `Bearer ${getApiKey()}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('Perplexity API response received, checking structure...');

    // Extract the response content
    const responseContent = response.data.choices[0]?.message?.content;
    if (!responseContent) {
      console.error('Invalid response structure - response.data:', JSON.stringify(response.data, null, 2));
      throw new Error('Invalid response structure from Perplexity API: no content found');
    }

    // Parse JSON response
    let jsonResponse;
    try {
      jsonResponse = typeof responseContent === 'string' 
        ? JSON.parse(responseContent) 
        : responseContent;
    } catch (parseError) {
      console.error('Error parsing JSON response:', parseError);
      console.error('Response content:', responseContent);
      // Fallback: try to extract text if JSON parsing fails
      const text = typeof responseContent === 'string' ? responseContent : JSON.stringify(responseContent);
      if (!text || text.trim().length === 0) {
        throw new Error('Empty response from Perplexity API');
      }
      console.log('Successfully extracted text from Perplexity response (fallback), length:', text.length);
      return text.trim();
    }

    // Convert JSON schema response to plain text for frontend compatibility
    const textResponse = convertJsonToText(jsonResponse);

    if (!textResponse || textResponse.trim().length === 0) {
      console.error('Empty text after conversion - jsonResponse:', JSON.stringify(jsonResponse, null, 2));
      throw new Error('Empty response from Perplexity API after conversion');
    }

    console.log('Successfully extracted text from Perplexity response, length:', textResponse.length);
    return textResponse.trim();
  } catch (error) {
    console.error('Error calling Perplexity API for reprompt:', error);
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
 * Test the Perplexity API connection
 * @returns {Promise<boolean>} True if connection successful, false otherwise
 */
export async function testPerplexityConnection() {
  try {
    if (!process.env.PERPLEXITY_API_KEY || process.env.PERPLEXITY_API_KEY === 'your_perplexity_api_key_here') {
      return false;
    }

    const requestBody = {
      model: PERPLEXITY_MODEL,
      messages: [
        {
          role: 'user',
          content: 'Hello'
        }
      ],
      max_tokens: 10
    };

    await axios.post(
      PERPLEXITY_API_URL,
      requestBody,
      {
        headers: {
          'Authorization': `Bearer ${getApiKey()}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    return true;
  } catch (error) {
    console.error('Perplexity connection test failed:', error);
    return false;
  }
}

