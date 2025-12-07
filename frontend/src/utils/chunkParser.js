/**
 * Extracts header from text (first line if it looks like a header)
 * @param {string} text - The text to extract header from
 * @returns {string|null} The header if found, null otherwise
 */
export function extractHeader(text) {
  if (!text) return null;
  
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length === 0) return null;
  
  const firstLine = lines[0];
  // Heuristic: header is usually short (less than 100 chars), might be all caps or title case
  const isLikelyHeader = firstLine.length < 100 && 
                         !firstLine.includes('.') && 
                         !firstLine.includes('?') &&
                         !firstLine.includes('!') &&
                         (firstLine === firstLine.toUpperCase() || 
                          firstLine.split(' ').every(word => word[0] === word[0].toUpperCase() && word.length > 0));
  
  if (isLikelyHeader && lines.length > 1) {
    return firstLine;
  }
  
  return null;
}

/**
 * Removes header from text if present
 * @param {string} text - The text to process
 * @returns {string} Text without header
 */
export function removeHeader(text) {
  if (!text) return '';
  
  const header = extractHeader(text);
  if (header) {
    // Remove the header line and any following empty lines
    return text.replace(new RegExp(`^${header.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\n+`, 'i'), '').trim();
  }
  
  return text;
}

/**
 * Parses text into dynamically sized chunks with subheaders
 * @param {string} text - The text to parse
 * @param {Array} existingSubheaders - Existing subheaders to potentially reuse
 * @returns {Array} Array of chunk objects with { subheader, sentences, fullText, hasSubheader }
 */
export function parseTextIntoChunks(text, existingSubheaders = []) {
  if (!text) return [];

  // Clean up text - remove asterisks and markdown formatting
  let cleanText = text
    .replace(/\*\*/g, '') // Remove bold markdown
    .replace(/\*/g, '') // Remove asterisks
    .replace(/^#{1,6}\s+/gm, '') // Remove markdown headers
    .trim();

  // Remove header if present (we'll handle it separately)
  cleanText = removeHeader(cleanText);

  // Improved subheader detection: process line by line to catch subheaders on their own line
  // Split by newlines - keep empty lines to detect paragraph breaks
  const allLines = cleanText.split('\n');
  const lines = [];
  
  // Process lines, preserving structure
  for (let i = 0; i < allLines.length; i++) {
    const line = allLines[i].trim();
    if (line.length > 0) {
      lines.push({ text: line, index: i, isEmpty: false });
    } else if (i > 0 && i < allLines.length - 1) {
      // Empty line between content - could indicate section break
      lines.push({ text: '', index: i, isEmpty: true });
    }
  }
  
  // Helper function to check if a line is likely a subheader
  const isLikelySubheader = (lineText, nextLineText) => {
    if (!lineText || lineText.length < 3 || lineText.length >= 100) return false;
    
    // Check for punctuation that indicates it's a sentence, not a subheader
    // Allow colons as they're common in subheaders
    if (lineText.includes('.') || lineText.includes('?') || lineText.includes('!')) {
      return false;
    }
    
    // Check if it ends with a colon (common subheader pattern)
    const endsWithColon = lineText.endsWith(':');
    
    // Check if it's title case (each significant word capitalized)
    const words = lineText.replace(':', '').split(' ');
    const significantWords = words.filter(w => w.length > 0);
    
    if (significantWords.length === 0) return false;
    
    // Check title case - first word must be capitalized, most words should be
    const firstWordCapitalized = significantWords[0][0] === significantWords[0][0].toUpperCase();
    const capitalizedWords = significantWords.filter(word => {
      const firstChar = word[0];
      return firstChar === firstChar.toUpperCase() && firstChar !== firstChar.toLowerCase();
    });
    
    // At least 60% of words should be capitalized for title case
    const isTitleCase = firstWordCapitalized && (capitalizedWords.length / significantWords.length >= 0.6);
    
    // Check if all caps
    const isAllCaps = lineText === lineText.toUpperCase() && lineText !== lineText.toLowerCase();
    
    // If it ends with colon, it's very likely a subheader
    if (endsWithColon && (isTitleCase || isAllCaps || significantWords.length <= 5)) {
      return true;
    }
    
    // Otherwise, check title case or all caps
    if (isTitleCase || isAllCaps) {
      // Additional check: if next line starts with lowercase, this is likely content, not subheader
      if (nextLineText && nextLineText.length > 0) {
        const nextFirstChar = nextLineText[0];
        // If next line starts with lowercase, this line is probably content
        if (nextFirstChar === nextFirstChar.toLowerCase() && nextFirstChar !== nextFirstChar.toUpperCase()) {
          return false;
        }
      }
      return true;
    }
    
    return false;
  };
  
  // Build sections by grouping lines, detecting subheaders
  const sections = [];
  let currentSection = [];
  let currentSubheaderForSection = null;
  
  for (let i = 0; i < lines.length; i++) {
    const lineObj = lines[i];
    const line = lineObj.text;
    const nextLineObj = i < lines.length - 1 ? lines[i + 1] : null;
    const nextLine = nextLineObj ? nextLineObj.text : null;
    
    // Skip empty lines but use them as potential section breaks
    if (lineObj.isEmpty) {
      // If we have a subheader but no content yet, empty line is fine
      // If we have content, empty line might indicate section break
      if (currentSubheaderForSection && currentSection.length === 0) {
        continue; // Skip empty line after subheader
      }
      // Otherwise, treat empty line as content separator
      if (currentSection.length > 0) {
        currentSection.push(' '); // Add space for paragraph break
      }
      continue;
    }
    
    // Check if this line is a subheader
    const isSubheader = isLikelySubheader(line, nextLine);
    
    if (isSubheader) {
      // If we have accumulated content, save it as a section
      if (currentSection.length > 0) {
        sections.push({
          subheader: currentSubheaderForSection,
          content: currentSection.join(' ').trim()
        });
        currentSection = [];
      }
      // This line is the subheader for the next section
      // Remove trailing colon if present, but keep the text
      currentSubheaderForSection = line.replace(/:\s*$/, '').trim();
    } else {
      // This is content, add it to current section
      // Make sure we're not accidentally including a subheader that wasn't detected
      // Check if this line might actually be a subheader that was missed
      if (currentSection.length === 0 && !currentSubheaderForSection) {
        // No current subheader and no content yet - this might be a missed subheader
        // Try a more lenient check
        const words = line.split(' ');
        if (words.length <= 8 && words.length >= 1) {
          const firstChar = line[0];
          if (firstChar === firstChar.toUpperCase() && firstChar !== firstChar.toLowerCase()) {
            // Could be a subheader - check if next line looks like content
            if (nextLine && nextLine.length > 20) {
              // Next line is substantial content, this might be a subheader
              currentSubheaderForSection = line.replace(/:\s*$/, '').trim();
              continue; // Skip adding to content
            }
          }
        }
      }
      currentSection.push(line);
    }
  }
  
  // Don't forget the last section
  if (currentSection.length > 0) {
    sections.push({
      subheader: currentSubheaderForSection,
      content: currentSection.join(' ').trim()
    });
  }
  
  // If no sections were created (no subheaders found), create one section with all content
  if (sections.length === 0 && lines.length > 0) {
    const allContent = lines.filter(l => !l.isEmpty).map(l => l.text).join(' ');
    sections.push({
      subheader: null,
      content: allContent
    });
  }
  
  const chunks = [];
  let currentSubheader = null;
  
  // Process each section (already has subheader extracted)
  for (const section of sections) {
    let sectionSubheader = section.subheader;
    let content = section.content;
    
    // Update current subheader if this section has one
    if (sectionSubheader) {
      currentSubheader = sectionSubheader;
    }
    
    // Check for inline subheaders as fallback (phrases that look like subheaders appearing after sentence endings)
    // This is a fallback in case subheaders weren't detected on their own line
    if (!sectionSubheader && content.length > 0) {
      // Try to find subheader patterns after sentence endings
      const inlineSubheaderPattern = /([.!?]\s+)([A-Z][a-zA-Z\s]{3,78}?)(?:\s+[A-Z][a-z]|$)/g;
      const inlineMatches = [];
      let match;
      
      // Reset regex lastIndex
      inlineSubheaderPattern.lastIndex = 0;
      
      // Find all potential inline subheaders
      while ((match = inlineSubheaderPattern.exec(content)) !== null) {
        const potentialSubheader = match[2].trim();
        
        // Check if it looks like a subheader
        const isTitleCase = potentialSubheader.split(' ').every(word => {
          if (word.length === 0) return true;
          const firstChar = word[0];
          return firstChar === firstChar.toUpperCase() && firstChar !== firstChar.toLowerCase();
        });
        
        // Common subheader patterns to look for
        const commonSubheaderWords = ['Era', 'Period', 'War', 'Revolution', 'Colonization', 'Exploration', 'Founding', 'Nation', 'Expansion', 'Building', 'Rights', 'Reconstruction', 'Industrialization', 'Immigration', 'Depression', 'Modern'];
        const hasSubheaderWord = commonSubheaderWords.some(word => 
          potentialSubheader.includes(word)
        );
        
        if (potentialSubheader.length < 80 && 
            potentialSubheader.length > 3 &&
            !potentialSubheader.includes('.') && 
            !potentialSubheader.includes('?') &&
            !potentialSubheader.includes('!') &&
            !potentialSubheader.includes(',') &&
            (isTitleCase || hasSubheaderWord)) {
          inlineMatches.push({
            index: match.index + match[1].length,
            length: potentialSubheader.length,
            text: potentialSubheader
          });
        }
      }
      
      // If we found inline subheaders and don't have a section subheader, use the first one
      if (inlineMatches.length > 0 && !sectionSubheader) {
        // Use the first inline subheader as the section subheader
        sectionSubheader = inlineMatches[0].text;
        currentSubheader = sectionSubheader;
        // Remove the subheader from content (including the period before it)
        const firstMatch = inlineMatches[0];
        const beforeIndex = content.lastIndexOf('.', firstMatch.index);
        if (beforeIndex >= 0) {
          content = content.substring(0, beforeIndex + 1) + 
                    ' ' +
                    content.substring(firstMatch.index + firstMatch.length).trim();
        } else {
          content = content.substring(0, firstMatch.index) + 
                    content.substring(firstMatch.index + firstMatch.length);
        }
        content = content.trim();
      }
    }
    
    // Split content into sentences - improved regex to handle abbreviations
    // Match sentence endings (. ! ?) but be careful with abbreviations
    const sentenceRegex = /[^.!?]+(?:[.!?]+|$)/g;
    const sentences = content.match(sentenceRegex) || [];
    
    // Clean sentences - remove empty ones and trim
    const cleanSentences = sentences
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    // If no sentences found, treat the whole content as one sentence
    if (cleanSentences.length === 0 && content.length > 0) {
      cleanSentences.push(content);
    }
    
    // Group sentences into dynamically sized chunks.
    // We target ~500 characters per chunk, but allow flexibility:
    // - short sections stay as a single chunk
    // - long sections break into multiple chunks at sentence boundaries
    const targetChunkLength = 500;
    const maxChunkLength = 900;
    const maxSentencesPerChunk = 8;
    
    let currentChunkSentences = [];
    let currentChunkLength = 0;
    let chunkIndexInSection = 0;

    const flushChunk = () => {
      if (currentChunkSentences.length === 0) return;

      const chunkText = currentChunkSentences.join(' ').trim();
      if (chunkText.length === 0) {
        currentChunkSentences = [];
        currentChunkLength = 0;
        return;
      }

      const chunkSubheader = sectionSubheader || currentSubheader;

      chunks.push({
        subheader: chunkSubheader,
        sentences: [...currentChunkSentences],
        fullText: chunkText,
        // Only the first chunk in a section that has a subheader gets the hasSubheader flag
        hasSubheader: !!sectionSubheader && chunkIndexInSection === 0
      });

      chunkIndexInSection += 1;
      currentChunkSentences = [];
      currentChunkLength = 0;
    };

    for (let i = 0; i < cleanSentences.length; i++) {
      const sentence = cleanSentences[i];
      const sentenceLength = sentence.length;

      // If adding this sentence would make the chunk too long and we already
      // have some content, flush the current chunk first.
      const wouldExceedTarget = currentChunkLength + sentenceLength > targetChunkLength;
      const wouldExceedMax = currentChunkLength + sentenceLength > maxChunkLength;
      const tooManySentences = currentChunkSentences.length >= maxSentencesPerChunk;

      if ((wouldExceedTarget && currentChunkSentences.length > 0) || wouldExceedMax || tooManySentences) {
        flushChunk();
      }

      currentChunkSentences.push(sentence);
      currentChunkLength += sentenceLength + 1; // +1 for a space
    }

    // Flush any remaining sentences as the last chunk in the section
    flushChunk();
  }
  
  // If no chunks were created, create one with the full text
  if (chunks.length === 0 && cleanText.length > 0) {
    chunks.push({
      subheader: null,
      sentences: [cleanText],
      fullText: cleanText,
      hasSubheader: false
    });
  }
  
  return chunks;
}

/**
 * Determines if a reprompt significantly changes the topic
 * Simple heuristic: check if key words are different
 * @param {string} originalQuery - Original query
 * @param {string} repromptQuery - New reprompt query
 * @returns {boolean} True if topic changed significantly
 */
export function hasTopicChanged(originalQuery, repromptQuery) {
  if (!originalQuery || !repromptQuery) return true;
  
  // Extract key words (remove common words)
  const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'about', 'what', 'how', 'why', 'when', 'where', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those']);
  
  const getKeyWords = (text) => {
    return text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3 && !commonWords.has(word));
  };
  
  const originalWords = new Set(getKeyWords(originalQuery));
  const repromptWords = new Set(getKeyWords(repromptQuery));
  
  // Calculate similarity (Jaccard similarity)
  const intersection = new Set([...originalWords].filter(x => repromptWords.has(x)));
  const union = new Set([...originalWords, ...repromptWords]);
  
  const similarity = intersection.size / union.size;
  
  // If similarity is less than 0.3, topic has changed significantly
  return similarity < 0.3;
}
