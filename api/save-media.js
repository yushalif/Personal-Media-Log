// Vercel Serverless Function: /api/save-media
// Reads data/media-log.json, applies changes, and commits directly back to GitHub repository via REST API
// If GitHub env vars are not set, falls back to local filesystem (Node fs) or returns updated payload for localStorage.

import fs from 'fs';
import path from 'path';

function verifyAuth(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return false;
  }
  const token = authHeader.slice(7);
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const [timestamp, expiresAt, role] = decoded.split(':');
    if (role === 'medialog-admin' && Number(expiresAt) > Date.now()) {
      return true;
    }
  } catch (e) {
    // invalid token
  }
  return false;
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed. Use POST.' });
  }

  // Validate Admin Session
  if (!verifyAuth(req)) {
    return res.status(401).json({
      ok: false,
      error: 'Unauthorized: Valid Admin session token required. Please log in.'
    });
  }

  const {
    GITHUB_TOKEN,
    GITHUB_OWNER,
    GITHUB_REPO,
    GITHUB_BRANCH = 'main'
  } = process.env;

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { action, item, id, items } = body;

    let currentLog = [];
    let fileSha = null;

    const hasGitHubConfig = Boolean(GITHUB_TOKEN && GITHUB_OWNER && GITHUB_REPO);

    if (hasGitHubConfig) {
      // 1. Fetch current data/media-log.json from GitHub Contents API
      const fileUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/data/media-log.json?ref=${GITHUB_BRANCH}`;
      const ghFetchRes = await fetch(fileUrl, {
        headers: {
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Media-Log-App'
        }
      });

      if (ghFetchRes.ok) {
        const ghData = await ghFetchRes.json();
        fileSha = ghData.sha;
        const decodedContent = Buffer.from(ghData.content, 'base64').toString('utf-8');
        try {
          currentLog = JSON.parse(decodedContent);
        } catch {
          currentLog = [];
        }
      } else if (ghFetchRes.status === 404) {
        // File does not exist yet in repo, will create
        currentLog = [];
        fileSha = null;
      } else {
        const errText = await ghFetchRes.text();
        throw new Error(`GitHub API error (${ghFetchRes.status}): ${errText}`);
      }
    } else {
      // 2. Read from local disk if available
      try {
        const localPath = path.resolve(process.cwd(), 'data', 'media-log.json');
        if (fs.existsSync(localPath)) {
          const raw = fs.readFileSync(localPath, 'utf-8');
          currentLog = JSON.parse(raw);
        }
      } catch (err) {
        console.warn('Could not read local file, using provided or empty list:', err.message);
        if (Array.isArray(items)) {
          currentLog = items;
        }
      }
    }

    // Apply the requested action
    let updatedLog = [...currentLog];
    let commitMessage = 'chore(media-log): update media library';

    if (action === 'save' && item) {
      const existingIndex = updatedLog.findIndex(m => m.id === item.id);
      const now = new Date().toISOString();
      if (existingIndex >= 0) {
        updatedLog[existingIndex] = {
          ...updatedLog[existingIndex],
          ...item,
          updatedAt: now
        };
        commitMessage = `chore(media-log): update "${item.title}" [admin]`;
      } else {
        const newItem = {
          ...item,
          id: item.id || `item-${Date.now()}`,
          createdAt: item.createdAt || now,
          updatedAt: now
        };
        updatedLog.unshift(newItem);
        commitMessage = `feat(media-log): add "${item.title}" (${item.type}) [admin]`;
      }
    } else if (action === 'delete') {
      const targetId = id || (item && item.id);
      const targetItem = updatedLog.find(m => m.id === targetId);
      updatedLog = updatedLog.filter(m => m.id !== targetId);
      commitMessage = `chore(media-log): delete "${targetItem?.title || targetId}" [admin]`;
    } else if (action === 'replace' && Array.isArray(items)) {
      updatedLog = items;
      commitMessage = 'chore(media-log): batch sync media entries [admin]';
    } else {
      return res.status(400).json({ ok: false, error: 'Invalid action or missing item payload' });
    }

    const updatedJsonString = JSON.stringify(updatedLog, null, 2);

    // Commit back to GitHub if configured
    if (hasGitHubConfig) {
      const putUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/data/media-log.json`;
      const base64Content = Buffer.from(updatedJsonString, 'utf-8').toString('base64');

      const payload = {
        message: commitMessage,
        content: base64Content,
        branch: GITHUB_BRANCH
      };
      if (fileSha) {
        payload.sha = fileSha;
      }

      const putRes = await fetch(putUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'Media-Log-App'
        },
        body: JSON.stringify(payload)
      });

      if (!putRes.ok) {
        const putErr = await putRes.text();
        throw new Error(`GitHub commit failed (${putRes.status}): ${putErr}`);
      }

      const putData = await putRes.json();
      return res.status(200).json({
        ok: true,
        storage: 'github',
        commitSha: putData.commit?.sha || null,
        message: 'Successfully committed to GitHub repository!',
        data: updatedLog
      });
    }

    // Otherwise, write to local file system if local dev
    try {
      const localPath = path.resolve(process.cwd(), 'data', 'media-log.json');
      fs.writeFileSync(localPath, updatedJsonString, 'utf-8');
      return res.status(200).json({
        ok: true,
        storage: 'local-file',
        message: 'Saved directly to data/media-log.json on local disk (GitHub vars not set).',
        data: updatedLog
      });
    } catch (fsErr) {
      return res.status(200).json({
        ok: true,
        storage: 'localstorage-fallback',
        message: 'Read-only environment: updated in memory. Save to localStorage on client.',
        data: updatedLog
      });
    }
  } catch (error) {
    console.error('Save media error:', error);
    return res.status(500).json({
      ok: false,
      error: error.message || 'Failed to save media entry'
    });
  }
}
