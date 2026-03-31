# Chat GPT Tree

A conversation interface that visualizes AI chat threads as **branching trees**. Ask a question, highlight part of the response, and branch off into a new conversation path — all while keeping the full tree visible.

---

## What It Does

Instead of a linear chat history, every conversation is a **tree**. Each AI response can spawn multiple follow-up branches, letting you explore different lines of questioning from the same starting point.

**Two modes:**

- **Standard Mode** — Chat with tree visualization. Highlight text in any AI response to ask a targeted follow-up, which creates a new branch in the tree.
- **Enhanced Learning Mode** — Responses are broken into navigable chunks. Step through them incrementally and "reprompt" the AI to expand on any section.

---

## Tech Stack

| Layer    | Technology                              |
|----------|-----------------------------------------|
| Frontend | React 18, Tailwind CSS, Framer Motion   |
| Backend  | Node.js, Express                        |
| AI       | Perplexity AI (sonar), Google Gemini    |
| Deploy   | Vercel (serverless functions)           |
| Storage  | In-memory (no database)                 |

---

## Project Structure

```
chat-gpt-tree/
├── backend/
│   ├── api/index.js            # Vercel serverless entry point
│   ├── services/
│   │   ├── perplexity.js       # Perplexity AI integration
│   │   └── gemini.js           # Google Gemini integration
│   ├── node.js                 # Node class (single message in tree)
│   ├── tree.js                 # Tree class (one conversation)
│   ├── tree_manager.js         # Manages multiple conversation trees
│   └── server.js               # Express routes & middleware
│
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── StandardApp.jsx                 # Standard mode
│       │   ├── enhanced-learning/
│       │   │   ├── EnhancedLearningApp.jsx     # Enhanced learning mode
│       │   │   ├── IncrementalResponse.jsx     # Chunk-by-chunk display
│       │   │   └── ...
│       │   ├── HighlightableResponse.jsx       # Text selection → follow-up
│       │   ├── TreeVisual.jsx                  # Tree visualization
│       │   ├── ChatWindow.jsx                  # Message display
│       │   ├── ModeToggle.jsx                  # Switch between modes
│       │   └── Sidebar.jsx                     # Navigation sidebar
│       ├── utils/chunkParser.js                # Parse responses into chunks
│       └── services/api.js                     # API client (Axios)
```

---

## Setup

### Prerequisites

- Node.js (v16+)
- npm
- A [Perplexity AI](https://www.perplexity.ai/) API key and/or a [Google Gemini](https://ai.google.dev/) API key

### 1. Clone and install

```bash
# Backend
cd chat-gpt-tree/backend
npm install

# Frontend (separate terminal)
cd chat-gpt-tree/frontend
npm install
```

### 2. Configure environment variables

**Backend** — create `backend/.env`:

```env
PERPLEXITY_API_KEY=your_perplexity_key
GEMINI_API_KEY=your_gemini_key
PORT=3001
```

**Frontend** — create `frontend/.env.local`:

```env
REACT_APP_API_URL=http://localhost:3001/api
```

### 3. Run

```bash
# Terminal 1 — Backend
cd backend
npm run dev          # starts on http://localhost:3001

# Terminal 2 — Frontend
cd frontend
npm start            # starts on http://localhost:3000
```

> `npm run start:clean` in the backend will kill any existing process on port 3001 before starting.

---

## API Endpoints

### Conversations

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/conversations` | Create a new conversation tree |
| `GET` | `/api/conversations` | List all conversation trees |
| `GET` | `/api/conversations/:treeId` | Get full conversation tree |
| `GET` | `/api/conversations/:treeId/path/:nodeId` | Get path from root to a node |
| `POST` | `/api/conversations/:treeId/messages` | Add a message (branch) to a tree |

### Enhanced Learning

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/enhanced-learning/reprompt` | Reprompt: expand on a response chunk |
| `GET` | `/api/enhanced-learning/original/:messageId` | Get original content before reprompts |

### Utilities

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/stats` | Tree statistics (count, depth, etc.) |
| `GET` | `/api/test-perplexity` | Test Perplexity API connection |

---

## How It Works

### Tree Data Model

Each conversation is a **tree** made up of **nodes**. A node holds a user message, the AI response, and references to its parent and children. When you highlight text and ask a follow-up, a new child node is created — this is how branches form.

```
         [Root Question]
           /         \
     [Follow-up A]  [Follow-up B]
        /
  [Follow-up A1]
```

### Enhanced Learning — Chunk Navigation

In Enhanced Learning mode, AI responses are parsed into discrete **chunks** (split by headers/sections). You can:

1. Step through chunks one at a time (next/prev)
2. Select any chunk and **reprompt** — asking the AI to elaborate, which generates new sub-chunks inline
3. View the full reprompt history for any message

### Highlight → Branch (Standard Mode)

1. Select/highlight text in any AI response
2. A prompt appears to ask a follow-up about the highlighted text
3. The AI uses the highlighted text as context for its response
4. A new branch appears in the tree visualization

---

## Deployment (Vercel)

The backend is configured for Vercel serverless deployment via `backend/vercel.json`.

1. Push to GitHub
2. Import into Vercel
3. Set the root directory to `chat-gpt-tree/backend`
4. Add environment variables (`PERPLEXITY_API_KEY`, `GEMINI_API_KEY`)
5. Deploy the frontend separately (or as a monorepo) and point `REACT_APP_API_URL` to the deployed backend URL

---

## Notes

- **Storage is in-memory** — all conversation data is lost on server restart. This is fine for development; a database (e.g. MongoDB, PostgreSQL) would be needed for production persistence.
- **No authentication** — the API is open. API keys for AI services are server-side only.
- Mode selection (Standard vs. Enhanced Learning) is persisted to `localStorage`.
