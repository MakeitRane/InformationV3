// Simple test function to verify Vercel is detecting serverless functions
export default function handler(req, res) {
  res.json({ 
    message: 'Vercel serverless function is working!',
    path: req.url,
    method: req.method
  });
}

