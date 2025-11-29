# Fixing Vercel 404 Error

## The Problem

You're getting a 404 because Vercel can't find your serverless function. This is usually due to one of these issues:

## Solution 1: Check Root Directory (MOST LIKELY ISSUE)

1. Go to your Vercel project dashboard
2. Click **Settings** → **General**
3. Scroll to **Root Directory**
4. **Make sure it's set to: `backend`**
5. If it's empty or set to something else, change it to `backend` and redeploy

## Solution 2: Verify Project Structure

When Root Directory is set to `backend`, Vercel sees:
```
api/index.js    ← Serverless function (this is what Vercel looks for)
server.js       ← Express app
vercel.json     ← Config
package.json
```

## Solution 3: Test Without vercel.json

If it still doesn't work, try this:

1. **Temporarily delete `vercel.json`**
2. **Redeploy**
3. Vercel should auto-detect `api/index.js` as a serverless function
4. Access: `https://v3-information.vercel.app/api/index.js` (should work)
5. Access: `https://v3-information.vercel.app/api/conversations` (should work)

## Solution 4: Check Vercel Logs

1. Go to your deployment in Vercel dashboard
2. Click on the deployment
3. Go to **Functions** tab
4. You should see `api/index.js` listed
5. If it's NOT listed, that's the problem - Vercel isn't detecting it

## Solution 5: Manual Function Test

Create a simple test function to verify Vercel is working:

Create `api/test.js`:
```js
export default function handler(req, res) {
  res.json({ message: 'Vercel function is working!' });
}
```

Then access: `https://v3-information.vercel.app/api/test`

If this works but `api/index.js` doesn't, the issue is with the Express app export.

