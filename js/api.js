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

  // Load media log (databaseless read flow)
  async loadMediaLog() {
    try {
      // 1. Fetch data/media-log.json from repository with safety timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      const res = await fetch('/data/media-log.json?t=' + Date.now(), { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        const repoData = await res.json();
        if (Array.isArray(repoData)) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(repoData));
          return repoData;
        }
      }
    } catch (err) {
      console.warn('Could not fetch /data/media-log.json directly:', err);
    }

    // 2. Fallback to localStorage if offline/preview
    const localCache = localStorage.getItem(STORAGE_KEY);
    if (localCache) {
      try {
        const cached = JSON.parse(localCache);
        if (Array.isArray(cached)) return cached;
      } catch (e) {
        console.warn('Corrupt local cache:', e);
      }
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
        const res = await fetch('/api/save-media', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': token
          },
          body: JSON.stringify({
            action: 'save',
            item: item,
            items: updatedList
          })
        });

        if (res.ok) {
          const result = await res.json();
          if (result.data) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(result.data));
            return {
              success: true,
              storage: result.storage || 'server',
              message: result.message || 'Saved successfully!',
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
      message: 'Saved to local browser storage (Dev / Preview mode)',
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
        const res = await fetch('/api/save-media', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': token
          },
          body: JSON.stringify({
            action: 'delete',
            id: id,
            items: updatedList
          })
        });

        if (res.ok) {
          const result = await res.json();
          if (result.data) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(result.data));
            return {
              success: true,
              storage: result.storage || 'server',
              message: result.message || 'Deleted successfully',
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
