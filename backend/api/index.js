// Vercel Serverless Function entry point
// This file handles all /api/* routes

import app from '../server.js';

// Export the Express app as the handler
// Vercel will call this function for requests matching /api/*
export default app;

