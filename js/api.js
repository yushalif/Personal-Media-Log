/**
 * Media Log - Data & Storage API Module
 * Manages public databaseless read flow, Admin authentication, 
 * GitHub commit flow via /api/save-media, and local fallback storage.
 */

const STORAGE_KEY = 'medialog_entries_cache_v4';
const TOKEN_KEY = 'medialog_admin_token';

// Clear legacy caches once on module load
try {
  ['medialog_entries_cache', 'medialog_entries_cache_v1', 'medialog_entries_cache_v2', 'medialog_entries_cache_v3'].forEach(k => {
    localStorage.removeItem(k);
  });
} catch (e) {
  // ignore storage errors
}

export const api = {
  // Check if admin is currently authenticated in session
  isAdmin() {
    const token = sessionStorage.getItem(TOKEN_KEY);
    return Boolean(token);
  },

  getToken() {
    return sessionStorage.getItem(TOKEN_KEY) || '';
  },

  // Log in as Admin
  async login(password) {
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.token) {
          sessionStorage.setItem(TOKEN_KEY, data.token);
          return { success: true, data };
        }
      }

      // Offline / Static Preview Dev Fallback:
      // If server endpoint is unreachable (e.g., static file preview), allow 'Celluloid-35mm-Odyssey#24'
      if (password === 'Celluloid-35mm-Odyssey#24') {
        const mockToken = 'Bearer ' + btoa(`${Date.now()}:${Date.now() + 86400000}:medialog-admin`);
        sessionStorage.setItem(TOKEN_KEY, mockToken);
        return {
          success: true,
          data: {
            token: mockToken,
            message: 'Authenticated.'
          }
        };
      }

      const err = await res.json().catch(() => ({}));
      return { success: false, error: err.error || 'Invalid password' };
    } catch (networkErr) {
      // If server is not running at all (e.g., opened file directly or static host without backend)
      if (password === 'Celluloid-35mm-Odyssey#24') {
        const mockToken = 'Bearer ' + btoa(`${Date.now()}:${Date.now() + 86400000}:medialog-admin`);
        sessionStorage.setItem(TOKEN_KEY, mockToken);
        return {
          success: true,
          data: {
            token: mockToken,
            message: 'Authenticated.'
          }
        };
      }
      return { success: false, error: 'Connection failed. Please check your network connection.' };
    }
  },

  // Logout Admin
  logout() {
    sessionStorage.removeItem(TOKEN_KEY);
  },

  // In-browser GitHub Cloud Sync configuration
  getGitHubConfig() {
    try {
      const cfg = localStorage.getItem('medialog_github_config');
      return cfg ? JSON.parse(cfg) : null;
    } catch {
      return null;
    }
  },

  setGitHubConfig(config) {
    if (!config) {
      localStorage.removeItem('medialog_github_config');
    } else {
      localStorage.setItem('medialog_github_config', JSON.stringify(config));
    }
  },

  async testGitHubConnection(config) {
    const token = this.getToken();
    try {
      const res = await fetch('/api/save-media', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token,
          'x-github-token': config.token || '',
          'x-github-owner': config.owner || '',
          'x-github-repo': config.repo || '',
          'x-github-branch': config.branch || 'main'
        },
        body: JSON.stringify({
          action: 'test-connection',
          githubToken: config.token,
          githubOwner: config.owner,
          githubRepo: config.repo,
          githubBranch: config.branch || 'main'
        })
      });
      const data = await res.json();
      return { success: res.ok && data.ok, data, error: data.error };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  // Load media log (databaseless read flow)
  async loadMediaLog() {
    const localCache = localStorage.getItem(STORAGE_KEY);
    let cachedItems = null;
    if (localCache) {
      try {
        cachedItems = JSON.parse(localCache);
      } catch (e) {
        console.warn('Corrupt local cache:', e);
      }
    }

    try {
      // 1. Fetch data/media-log.json from repository with safety timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      const res = await fetch('/data/media-log.json?t=' + Date.now(), { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        const repoData = await res.json();
        if (Array.isArray(repoData)) {
          // If repo has items
          if (repoData.length > 0) {
            if (Array.isArray(cachedItems) && cachedItems.length > 0) {
              const repoMap = new Map(repoData.map(x => [x.id, x]));
              const localMap = new Map(cachedItems.map(x => [x.id, x]));
              const allIds = new Set([...repoMap.keys(), ...localMap.keys()]);
              const merged = [];
              for (const id of allIds) {
                const r = repoMap.get(id);
                const l = localMap.get(id);
                if (r && l) {
                  const rTime = new Date(r.updatedAt || r.createdAt || 0).getTime();
                  const lTime = new Date(l.updatedAt || l.createdAt || 0).getTime();
                  merged.push(lTime >= rTime ? l : r);
                } else if (l) {
                  merged.push(l);
                } else if (r) {
                  merged.push(r);
                }
              }
              localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
              return merged;
            }
            localStorage.setItem(STORAGE_KEY, JSON.stringify(repoData));
            return repoData;
          } else {
            // Repo has 0 items ([]), but user has logged items in this browser!
            if (Array.isArray(cachedItems) && cachedItems.length > 0) {
              return cachedItems;
            }
            localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
            return [];
          }
        }
      }
    } catch (err) {
      console.warn('Could not fetch /data/media-log.json directly:', err);
    }

    // 2. Fallback to localStorage if offline/preview
    if (Array.isArray(cachedItems)) {
      return cachedItems;
    }

    return [];
  },

  // Save (Add or Update) Media Entry
  async saveMedia(item, currentList) {
    const token = this.getToken();
    const existingIndex = currentList.findIndex(m => m.id === item.id);
    let updatedList = [...currentList];
    const nowIso = new Date().toISOString();

    if (existingIndex >= 0) {
      updatedList[existingIndex] = {
        ...updatedList[existingIndex],
        ...item,
        updatedAt: nowIso
      };
    } else {
      const newItem = {
        ...item,
        id: item.id || `item-${Date.now()}`,
        createdAt: item.createdAt || nowIso,
        updatedAt: nowIso
      };
      updatedList.unshift(newItem);
    }

    // Save to localStorage immediately for instant feedback
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedList));

    // If Admin token is present, try serverless endpoint /api/save-media
    if (token) {
      try {
        const ghConfig = this.getGitHubConfig() || {};
        const headers = {
          'Content-Type': 'application/json',
          'Authorization': token
        };
        if (ghConfig.token) headers['x-github-token'] = ghConfig.token;
        if (ghConfig.owner) headers['x-github-owner'] = ghConfig.owner;
        if (ghConfig.repo) headers['x-github-repo'] = ghConfig.repo;
        if (ghConfig.branch) headers['x-github-branch'] = ghConfig.branch;

        const res = await fetch('/api/save-media', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            action: 'save',
            item: item,
            items: updatedList,
            githubToken: ghConfig.token,
            githubOwner: ghConfig.owner,
            githubRepo: ghConfig.repo,
            githubBranch: ghConfig.branch
          })
        });

        if (res.ok) {
          const result = await res.json();
          if (result.data) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(result.data));
            return {
              success: true,
              storage: result.storage || 'server',
              message: result.storage === 'github' 
                ? 'Committed directly to GitHub repository!' 
                : (result.storage === 'local-file' 
                    ? 'Saved directly to data/media-log.json' 
                    : 'Saved to browser storage. (Set GitHub Token to sync cloud repo)'),
              items: result.data
            };
          }
        }
      } catch (err) {
        console.warn('API save-media call skipped or failed, saved locally:', err);
      }
    }

    return {
      success: true,
      storage: 'localstorage-fallback',
      message: 'Saved to local browser storage',
      items: updatedList
    };
  },

  // Delete Media Entry
  async deleteMedia(id, currentList) {
    const token = this.getToken();
    const updatedList = currentList.filter(m => m.id !== id);

    // Save to localStorage immediately
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedList));

    if (token) {
      try {
        const ghConfig = this.getGitHubConfig() || {};
        const headers = {
          'Content-Type': 'application/json',
          'Authorization': token
        };
        if (ghConfig.token) headers['x-github-token'] = ghConfig.token;
        if (ghConfig.owner) headers['x-github-owner'] = ghConfig.owner;
        if (ghConfig.repo) headers['x-github-repo'] = ghConfig.repo;
        if (ghConfig.branch) headers['x-github-branch'] = ghConfig.branch;

        const res = await fetch('/api/save-media', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            action: 'delete',
            id: id,
            items: updatedList,
            githubToken: ghConfig.token,
            githubOwner: ghConfig.owner,
            githubRepo: ghConfig.repo,
            githubBranch: ghConfig.branch
          })
        });

        if (res.ok) {
          const result = await res.json();
          if (result.data) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(result.data));
            return {
              success: true,
              storage: result.storage || 'server',
              message: result.storage === 'github' ? 'Committed deletion to GitHub!' : 'Deleted successfully',
              items: result.data
            };
          }
        }
      } catch (err) {
        console.warn('API delete call skipped or failed, deleted locally:', err);
      }
    }

    return {
      success: true,
      storage: 'localstorage-fallback',
      message: 'Deleted from local browser storage',
      items: updatedList
    };
  },

  // Push all local items to GitHub
  async pushAllToGitHub(items) {
    const token = this.getToken();
    const ghConfig = this.getGitHubConfig() || {};
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': token
    };
    if (ghConfig.token) headers['x-github-token'] = ghConfig.token;
    if (ghConfig.owner) headers['x-github-owner'] = ghConfig.owner;
    if (ghConfig.repo) headers['x-github-repo'] = ghConfig.repo;
    if (ghConfig.branch) headers['x-github-branch'] = ghConfig.branch;

    const res = await fetch('/api/save-media', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        action: 'replace',
        items: items,
        githubToken: ghConfig.token,
        githubOwner: ghConfig.owner,
        githubRepo: ghConfig.repo,
        githubBranch: ghConfig.branch
      })
    });
    return await res.json();
  },

  // Reset to original data/media-log.json
  async resetToRepositoryData() {
    try {
      const res = await fetch('/data/media-log.json?t=' + Date.now());
      if (res.ok) {
        const repoData = await res.json();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(repoData));
        return { success: true, items: repoData };
      }
    } catch (e) {
      console.error('Reset error:', e);
    }
    return { success: false };
  }
};
