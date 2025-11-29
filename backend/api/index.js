// Vercel Serverless Function entry point
// This file is located at backend/api/index.js
// Vercel will automatically route requests to /api/* to this function
// We simply re-export the Express app from server.js

import app from '../server.js';

// Vercel expects a default export that handles HTTP requests
// Since server.js exports the Express app, we can just re-export it
export default app;

