/**
 * Media Log - Application Main Controller
 * Handles Home Showcase (auto-swiping horizontal rows), dedicated pages
 * for Movies, Shows, Anime, Games, Books, and unified Search with vector icons.
 */

import { api } from './api.js';
import { searchService } from './search.js';
import { statsService } from './stats.js';
import { ui } from './ui.js';
import { icons } from './icons.js';

class MediaLogApp {
  constructor() {
    this.mediaList = [];
    this.filteredList = [];

    this.currentView = 'home';

    this.selectedStatus = 'all';
    this.filterCried = false;
    this.selectedSource = 'all';
    this.selectedGenre = 'all';
    this.selectedMovieGenre = 'all';
    this.sortBy = 'dateExperienced';
    this.searchQuery = '';
    this.viewMode = 'grid';

    this.searchViewCategory = 'movie';

    this.activeRecentCategory = 'all';
    this.fixPosterTargetItem = null;
    this.gameStatusFilter = 'all';
    this.tvStatusFilter = 'all';
  }

  async init() {
    // Restore persistent gaming sort & view mode
    const savedGameSort = localStorage.getItem('medialog_game_sort');
    if (savedGameSort) this.sortBy = savedGameSort;
    const savedGameView = localStorage.getItem('medialog_game_view');
    if (savedGameView) this.viewMode = savedGameView;

    this.bindEvents();
    this.updateAdminUI();

    // Global image fallback handler: Never use empty cinema seats; allow shared poster component to handle fallback
    window.addEventListener('error', (e) => {
      if (e.target && e.target.tagName === 'IMG') {
        const parent = e.target.closest('.shared-poster-box');
        if (parent) {
          e.target.style.display = 'none';
          parent.classList.add('has-failed');
        }
      }
    }, true);

    ui.showToast('Loading Media Library...', 'info', 1500);
    try {
      this.mediaList = await api.loadMediaLog();
    } catch (err) {
      console.warn('Could not load media log:', err);
      this.mediaList = [];
    }

    const hash = window.location.hash.replace('#', '');
    if (['home', 'movie', 'tv', 'anime', 'game', 'book', 'search'].includes(hash)) {
      this.switchView(hash);
    } else {
      this.switchView('home');
    }

    statsService.renderStatsBar(this.mediaList);
  }

  // ===================================================================
  // Event Binding
  // ===================================================================
  bindEvents() {
    document.querySelectorAll('.nav-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.getAttribute('data-tab');
        this.switchView(view);
      });
    });

    window.addEventListener('hashchange', () => {
      const hash = window.location.hash.replace('#', '') || 'home';
      if (hash !== this.currentView) {
        if (['home', 'movie', 'tv', 'anime', 'game', 'book', 'search'].includes(hash)) {
          this.switchView(hash);
        } else {
          this.switchView('home');
        }
      }
    });

    document.querySelector('.brand')?.addEventListener('click', () => {
      this.switchView('home');
    });

    document.getElementById('btnAdminLogin')?.addEventListener('click', () => {
      ui.openAdminModal();
    });

    document.getElementById('btnAdminLogout')?.addEventListener('click', () => {
      api.logout();
      this.updateAdminUI();
      this.refreshCurrentView();
      ui.showToast('Logged out of Admin mode.', 'info');
    });

    document.getElementById('formAdminLogin')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const pwd = document.getElementById('adminPasswordInput').value;
      const res = await api.login(pwd);
      if (res.success) {
        ui.closeAdminModal();
        this.updateAdminUI();
        this.refreshCurrentView();
        ui.showToast(res.data?.message || 'Logged in as Admin!', 'success');
      } else {
        const errEl = document.getElementById('adminLoginError');
        errEl.textContent = res.error;
        errEl.style.display = 'block';
      }
    });

    document.getElementById('btnAddMedia')?.addEventListener('click', () => {
      if (!api.isAdmin()) {
        ui.openAdminModal();
        return;
      }
      const defaultType = ['movie', 'tv', 'anime', 'game', 'book'].includes(this.currentView) 
        ? this.currentView 
        : 'movie';
      ui.openLogModal({ type: defaultType });
    });

    document.getElementById('btnOpenCloudSync')?.addEventListener('click', () => {
      this.openStorageModal();
    });

    document.getElementById('btnSyncRepo')?.addEventListener('click', () => {
      this.openStorageModal();
    });

    document.getElementById('btnCloseStorageModal')?.addEventListener('click', () => {
      this.closeStorageModal();
    });
    document.getElementById('btnCloseStorageModalFooter')?.addEventListener('click', () => {
      this.closeStorageModal();
    });

    // Save GitHub Credentials
    document.getElementById('btnSaveGithubConfig')?.addEventListener('click', async () => {
      const token = document.getElementById('cfgGithubToken')?.value.trim();
      const owner = document.getElementById('cfgGithubOwner')?.value.trim();
      const repo = document.getElementById('cfgGithubRepo')?.value.trim();

      if (!token && !owner && !repo) {
        api.setGitHubConfig(null);
        this.updateStorageModalStatus();
        ui.showToast('Cleared GitHub credentials. Using browser storage.', 'info');
        return;
      }

      if (!token || !owner || !repo) {
        ui.showToast('Please fill in Token, Owner, and Repo', 'warning');
        return;
      }

      const cfg = { token, owner, repo, branch: 'main' };
      api.setGitHubConfig(cfg);
      this.updateStorageModalStatus();
      ui.showToast('GitHub credentials saved! Testing connection...', 'info');

      const testRes = await api.testGitHubConnection(cfg);
      const fb = document.getElementById('cfgGithubFeedback');
      if (fb) {
        fb.style.display = 'block';
        if (testRes.success) {
          fb.style.background = 'rgba(16,185,129,0.15)';
          fb.style.color = '#34d399';
          fb.style.border = '1px solid rgba(16,185,129,0.3)';
          fb.textContent = `✓ Success: Connected to GitHub repo "${cfg.owner}/${cfg.repo}"! All additions and edits will now auto-commit.`;
          ui.showToast('Connected to GitHub repository successfully!', 'success');
        } else {
          fb.style.background = 'rgba(244,63,94,0.15)';
          fb.style.color = '#fb7185';
          fb.style.border = '1px solid rgba(244,63,94,0.3)';
          fb.textContent = `✗ Connection failed: ${testRes.error || 'Please check token and repository name.'}`;
        }
      }
    });

    // Test GitHub Connection button
    document.getElementById('btnTestGithub')?.addEventListener('click', async () => {
      const token = document.getElementById('cfgGithubToken')?.value.trim();
      const owner = document.getElementById('cfgGithubOwner')?.value.trim();
      const repo = document.getElementById('cfgGithubRepo')?.value.trim();

      if (!token || !owner || !repo) {
        ui.showToast('Please enter Token, Owner, and Repo to test', 'warning');
        return;
      }

      ui.showToast('Testing GitHub connection...', 'info');
      const testRes = await api.testGitHubConnection({ token, owner, repo, branch: 'main' });
      const fb = document.getElementById('cfgGithubFeedback');
      if (fb) {
        fb.style.display = 'block';
        if (testRes.success) {
          fb.style.background = 'rgba(16,185,129,0.15)';
          fb.style.color = '#34d399';
          fb.style.border = '1px solid rgba(16,185,129,0.3)';
          fb.textContent = `✓ Verified! Connected to "${owner}/${repo}" with read/write permissions.`;
          ui.showToast('Connection verified!', 'success');
        } else {
          fb.style.background = 'rgba(244,63,94,0.15)';
          fb.style.color = '#fb7185';
          fb.style.border = '1px solid rgba(244,63,94,0.3)';
          fb.textContent = `✗ Connection failed: ${testRes.error || 'Check token permissions (requires repo scope).'}`;
        }
      }
    });

    // Download JSON in modal
    document.getElementById('btnExportJsonModal')?.addEventListener('click', () => {
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(this.mediaList, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `media-log.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      ui.showToast('Downloaded media-log.json!', 'success');
      const ts = document.getElementById('syncRepoTimestamp');
      if (ts) ts.textContent = 'Exported just now';
    });

    // Import JSON File
    document.getElementById('inputImportJsonFile')?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const parsed = JSON.parse(event.target.result);
          if (!Array.isArray(parsed)) {
            ui.showToast('Invalid file: JSON must contain an array of media entries', 'error');
            return;
          }
          if (confirm(`Import ${parsed.length} entries from "${file.name}"? This will update your media log.`)) {
            this.mediaList = parsed;
            localStorage.setItem('medialog_entries_cache_v4', JSON.stringify(parsed));
            this.refreshCurrentView();
            statsService.renderStatsBar(this.mediaList);
            ui.showToast(`Imported ${parsed.length} items successfully!`, 'success');
            const ts = document.getElementById('syncRepoTimestamp');
            if (ts) ts.textContent = `Imported ${parsed.length} items`;
            this.closeStorageModal();
          }
        } catch (err) {
          ui.showToast('Error parsing JSON file: ' + err.message, 'error');
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    });

    // Push All to GitHub
    document.getElementById('btnPushAllToGithub')?.addEventListener('click', async () => {
      if (!api.isAdmin()) {
        ui.showToast('Admin login required to push to GitHub', 'warning');
        return;
      }
      ui.showToast('Pushing all entries to GitHub repository...', 'info');
      try {
        const res = await api.pushAllToGitHub(this.mediaList);
        if (res.ok) {
          ui.showToast('All items pushed to GitHub successfully!', 'success');
          const ts = document.getElementById('syncRepoTimestamp');
          if (ts) ts.textContent = 'Pushed to GitHub';
        } else {
          ui.showToast('GitHub push failed: ' + (res.error || 'Check token permissions'), 'error');
        }
      } catch (err) {
        ui.showToast('Push error: ' + err.message, 'error');
      }
    });

    // Global keyboard shortcut '/' to focus search
    window.addEventListener('keydown', (e) => {
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
        e.preventDefault();
        if (this.currentView === 'home') {
          this.switchView('search');
          setTimeout(() => document.getElementById('externalSearchInput')?.focus(), 80);
        } else if (this.currentView === 'search') {
          document.getElementById('externalSearchInput')?.focus();
        } else {
          document.getElementById('librarySearchInput')?.focus();
        }
      }
    });

    // Clickable Hero chip filter shortcuts
    document.querySelectorAll('.hero-chip-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const nav = btn.getAttribute('data-nav');
        const filter = btn.getAttribute('data-filter');
        if (filter === 'tears') this.filterCried = true;
        if (filter === 'yap') this.sortBy = 'yapFactor';
        if (filter === 'long') this.sortBy = 'hoursPlayed';
        if (nav) this.switchView(nav);
      });
    });

    // Clickable Stat cards jumping to pre-filtered pages
    document.querySelectorAll('.stat-card').forEach(card => {
      card.addEventListener('click', () => {
        const nav = card.getAttribute('data-nav');
        const status = card.getAttribute('data-status');
        const filter = card.getAttribute('data-filter');
        if (status) this.selectedStatus = status;
        if (filter === 'cried') this.filterCried = true;
        if (nav && nav !== 'all' && nav !== 'home') {
          this.switchView(nav);
        } else if (nav === 'all') {
          this.switchView('movie');
        }
      });
    });

    // Gaming Status Filter Tab Row
    document.querySelectorAll('#gameStatusFilters .status-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#gameStatusFilters .status-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.gameStatusFilter = btn.getAttribute('data-status') || 'all';
        this.applyFiltersAndRenderGrid();
      });
    });

    // TV Shows Status Filter Tab Row
    document.querySelectorAll('#tvStatusFilters .status-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#tvStatusFilters .status-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.tvStatusFilter = btn.getAttribute('data-status') || 'all';
        this.applyFiltersAndRenderGrid();
      });
    });

    // Fix Poster Modal Actions
    document.getElementById('btnCloseFixPoster')?.addEventListener('click', () => this.closeFixPosterModal());
    document.getElementById('btnCancelFixPoster')?.addEventListener('click', () => this.closeFixPosterModal());
    document.getElementById('btnPreviewPosterUrl')?.addEventListener('click', () => {
      const url = document.getElementById('fixPosterInputUrl')?.value.trim();
      if (this.fixPosterTargetItem) {
        ui.renderFixPosterPreview(this.fixPosterTargetItem, url);
      }
    });
    document.getElementById('btnAutoFetchCovers')?.addEventListener('click', async () => {
      if (!this.fixPosterTargetItem) return;
      const listEl = document.getElementById('fixPosterCandidateList');
      const candContainer = document.getElementById('fixPosterCandidates');
      if (candContainer) candContainer.style.display = 'block';
      if (listEl) {
        listEl.innerHTML = `<div style="grid-column:1/-1; color:var(--text-dim); text-align:center; padding:1rem 0;">Searching online covers...</div>`;
        try {
          const results = await searchService.search(this.fixPosterTargetItem.title, this.fixPosterTargetItem.type);
          const covers = results.filter(r => r.posterUrl);
          if (covers.length === 0) {
            listEl.innerHTML = `<div style="grid-column:1/-1; color:var(--text-dim); text-align:center;">No candidate covers found</div>`;
          } else {
            listEl.innerHTML = covers.slice(0, 8).map(c => `
              <div class="fix-poster-candidate-item" style="cursor:pointer; border-radius:4px; overflow:hidden; border:1px solid rgba(255,255,255,0.15);" data-url="${ui.escapeHtml(c.posterUrl)}">
                <img src="${c.posterUrl}" style="width:100%; aspect-ratio:2/3; object-fit:cover; display:block;" loading="lazy">
              </div>
            `).join('');
            listEl.querySelectorAll('.fix-poster-candidate-item').forEach(itemEl => {
              itemEl.addEventListener('click', () => {
                const u = itemEl.getAttribute('data-url');
                document.getElementById('fixPosterInputUrl').value = u;
                ui.renderFixPosterPreview(this.fixPosterTargetItem, u);
              });
            });
          }
        } catch (e) {
          listEl.innerHTML = `<div style="grid-column:1/-1; color:#f43f5e; text-align:center;">Search failed</div>`;
        }
      }
    });
    document.getElementById('btnSaveFixedPoster')?.addEventListener('click', async () => {
      if (!this.fixPosterTargetItem) return;
      const newUrl = document.getElementById('fixPosterInputUrl')?.value.trim();
      if (!newUrl) {
        ui.showToast('Please enter or select a poster URL', 'warning');
        return;
      }
      this.fixPosterTargetItem.posterUrl = newUrl;
      const res = await api.saveMedia(this.fixPosterTargetItem, this.mediaList);
      if (res.success) {
        this.mediaList = res.items;
        this.refreshCurrentView();
        this.closeFixPosterModal();
        ui.showToast(`Updated cover for "${this.fixPosterTargetItem.title}"`, 'success');
      }
    });

    // TV Episode Tracker Modal Close
    document.getElementById('btnCloseTVEpisodeModal')?.addEventListener('click', () => {
      const modal = document.getElementById('tvEpisodeModal');
      if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
      }
    });

    const searchInput = document.getElementById('librarySearchInput');
    const clearSearchBtn = document.getElementById('btnClearSearch');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.trim().toLowerCase();
        if (clearSearchBtn) clearSearchBtn.style.display = this.searchQuery ? 'block' : 'none';
        this.applyFiltersAndRenderGrid();
      });
    }
    if (clearSearchBtn) {
      clearSearchBtn.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        this.searchQuery = '';
        clearSearchBtn.style.display = 'none';
        this.applyFiltersAndRenderGrid();
      });
    }

    document.getElementById('filterStatus')?.addEventListener('change', (e) => {
      this.selectedStatus = e.target.value;
      this.applyFiltersAndRenderGrid();
    });

    document.getElementById('filterSource')?.addEventListener('change', (e) => {
      this.selectedSource = e.target.value;
      this.applyFiltersAndRenderGrid();
    });

    const btnCry = document.getElementById('btnFilterCry');
    if (btnCry) {
      btnCry.addEventListener('click', () => {
        this.filterCried = !this.filterCried;
        btnCry.classList.toggle('active', this.filterCried);
        this.applyFiltersAndRenderGrid();
      });
    }

    document.getElementById('selectSort')?.addEventListener('change', (e) => {
      this.sortBy = e.target.value;
      if (this.currentView === 'game') {
        localStorage.setItem('medialog_game_sort', this.sortBy);
      }
      this.applyFiltersAndRenderGrid();
    });

    document.getElementById('mangaGenreBar')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.manga-genre-btn');
      if (!btn) return;
      const genre = btn.getAttribute('data-genre') || 'all';
      this.selectedGenre = genre;
      document.querySelectorAll('#mangaGenreBar .manga-genre-btn').forEach(b => {
        b.classList.toggle('active', b === btn);
      });
      this.applyFiltersAndRenderGrid();
    });

    document.getElementById('movieGenreBar')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.movie-genre-btn');
      if (!btn) return;
      const genre = btn.getAttribute('data-genre') || 'all';
      this.selectedMovieGenre = genre;
      document.querySelectorAll('#movieGenreBar .movie-genre-btn').forEach(b => {
        b.classList.toggle('active', b === btn);
      });
      this.applyFiltersAndRenderGrid();
    });

    document.querySelectorAll('.view-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.viewMode = btn.getAttribute('data-mode');
        if (this.currentView === 'game') {
          localStorage.setItem('medialog_game_view', this.viewMode);
        }
        this.renderDedicatedGrid();
      });
    });

    // -----------------------------------------------------------------
    // External Search Controls
    // -----------------------------------------------------------------
    document.querySelectorAll('.search-type-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.search-type-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.searchViewCategory = btn.getAttribute('data-type');
        this.executeExternalSearch();
      });
    });

    const searchLargeForm = document.getElementById('externalSearchForm');
    if (searchLargeForm) {
      searchLargeForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.executeExternalSearch();
      });
    }

    document.querySelectorAll('.preset-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const query = chip.getAttribute('data-query');
        const type = chip.getAttribute('data-type');
        const searchInput = document.getElementById('externalSearchInput');
        if (searchInput) searchInput.value = query;
        if (type) {
          this.searchViewCategory = type;
          document.querySelectorAll('.search-type-btn').forEach(b => {
            b.classList.toggle('active', b.getAttribute('data-type') === type);
          });
        }
        this.executeExternalSearch();
      });
    });

    document.getElementById('btnAddCustomMedia')?.addEventListener('click', () => {
      if (!api.isAdmin()) {
        ui.openAdminModal();
        return;
      }
      const initialTitle = document.getElementById('externalSearchInput')?.value || '';
      ui.openLogModal({
        title: initialTitle,
        type: this.searchViewCategory === 'series' ? 'tv' : this.searchViewCategory
      });
    });

    // -----------------------------------------------------------------
    // Modal Form Interactive Controls
    // -----------------------------------------------------------------
    document.querySelectorAll('.status-opt-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.status-opt-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    document.querySelectorAll('.social-tag-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        btn.classList.toggle('active');
      });
    });

    document.getElementById('mediaType')?.addEventListener('change', (e) => {
      const type = e.target.value;
      const gameSec = document.getElementById('gameFieldsSection');
      const bookSec = document.getElementById('bookFieldsSection');
      if (gameSec) gameSec.style.display = type === 'game' ? 'flex' : 'none';
      if (bookSec) bookSec.style.display = type === 'book' ? 'flex' : 'none';
      
      const extSource = document.getElementById('mediaExternalSource');
      if (extSource) {
        if (type === 'game') extSource.value = 'Metacritic';
        else if (type === 'anime') extSource.value = 'MAL';
        else if (type === 'book') extSource.value = 'Goodreads';
        else extSource.value = 'IMDb';
      }
    });

    document.querySelectorAll('.star-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const val = Number(btn.getAttribute('data-val'));
        ui.updateStarRating(val);
      });
    });

    this.bindSlider('sliderEnjoyment', 'valEnjoyment', (val) => ui.getEnjoymentLabel(val));
    this.bindSlider('sliderRetention', 'valRetention', (val) => ui.getRetentionLabel(val));
    this.bindSlider('sliderYap', 'valYap', (val) => ui.getYapLabel(val));

    document.getElementById('btnCounterDec')?.addEventListener('click', () => {
      const input = document.getElementById('gameTimesFinished');
      if (input && Number(input.value) > 0) input.value = Number(input.value) - 1;
    });
    document.getElementById('btnCounterInc')?.addEventListener('click', () => {
      const input = document.getElementById('gameTimesFinished');
      if (input) input.value = Number(input.value) + 1;
    });

    document.getElementById('formLogMedia')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.saveLoggedMedia();
    });

    document.querySelectorAll('.modal-close-btn, .modal-cancel-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        ui.closeLogModal();
        ui.closeDetailModal();
        ui.closeAdminModal();
      });
    });

    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          ui.closeLogModal();
          ui.closeDetailModal();
          ui.closeAdminModal();
        }
      });
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        ui.closeLogModal();
        ui.closeDetailModal();
        ui.closeAdminModal();
      }
    });
  }

  bindSlider(sliderId, labelId, labelFormatter) {
    const slider = document.getElementById(sliderId);
    const label = document.getElementById(labelId);
    if (!slider || !label) return;

    slider.addEventListener('input', (e) => {
      const val = Number(e.target.value);
      label.textContent = `${val}/5 • ${labelFormatter(val)}`;
    });
  }

  // ===================================================================
  // Navigation & View Routing
  // ===================================================================
  switchView(viewName) {
    this.currentView = viewName;
    window.location.hash = viewName === 'home' ? '' : `#${viewName}`;

    // Update body theme class
    document.body.className = `theme-${viewName}`;

    document.querySelectorAll('.nav-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === viewName);
    });

    const homeView = document.getElementById('homeView');
    const dedicatedView = document.getElementById('dedicatedLibraryView');
    const searchView = document.getElementById('searchView');
    const mangaGenreBar = document.getElementById('mangaGenreBar');
    const movieGenreBar = document.getElementById('movieGenreBar');

    if (mangaGenreBar) {
      if (viewName === 'anime') {
        mangaGenreBar.style.display = 'flex';
      } else {
        mangaGenreBar.style.display = 'none';
        this.selectedGenre = 'all';
        mangaGenreBar.querySelectorAll('.manga-genre-btn').forEach(b => {
          b.classList.toggle('active', b.getAttribute('data-genre') === 'all');
        });
      }
    }

    if (movieGenreBar) {
      if (viewName === 'movie') {
        movieGenreBar.style.display = 'flex';
      } else {
        movieGenreBar.style.display = 'none';
        this.selectedMovieGenre = 'all';
        movieGenreBar.querySelectorAll('.movie-genre-btn').forEach(b => {
          b.classList.toggle('active', b.getAttribute('data-genre') === 'all');
        });
      }
    }

    if (viewName === 'home') {
      if (homeView) homeView.style.display = 'block';
      if (dedicatedView) dedicatedView.style.display = 'none';
      if (searchView) searchView.style.display = 'none';
      this.renderHomeRows();
    } else if (viewName === 'search') {
      if (homeView) homeView.style.display = 'none';
      if (dedicatedView) dedicatedView.style.display = 'none';
      if (searchView) searchView.style.display = 'block';
      const searchInput = document.getElementById('externalSearchInput');
      if (searchInput && searchInput.value.trim()) {
        this.executeExternalSearch();
      } else {
        ui.renderSearchResults([], api.isAdmin());
      }
    } else {
      if (homeView) homeView.style.display = 'none';
      if (dedicatedView) dedicatedView.style.display = 'block';
      if (searchView) searchView.style.display = 'none';
      this.updateDedicatedPageHeader(viewName);
      this.applyFiltersAndRenderGrid();
    }
  }

  refreshCurrentView() {
    if (this.currentView === 'home') {
      this.renderHomeRows();
    } else if (this.currentView === 'search') {
      this.executeExternalSearch();
    } else {
      this.applyFiltersAndRenderGrid();
    }
  }

  updateDedicatedPageHeader(type) {
    const titleEl = document.getElementById('pageTitleText');
    const subtitleEl = document.getElementById('pageSubtitleText');
    const iconEl = document.getElementById('pageIcon');
    const stripEl = document.querySelector('.page-header-strip');

    const headers = {
      movie: { iconSvg: icons.film(24), title: '35mm Film Vault', subtitle: 'Celluloid reels, director cuts, cinema marquee rankings.' },
      tv: { iconSvg: icons.tv(24), title: 'Broadcast Control CRT', subtitle: 'Television studio tapes, season broadcast logs, and episodic arcs.' },
      anime: { iconSvg: icons.sparkles(24), title: 'Manga Panel Archive', subtitle: 'Serialized manga volumes, MyAnimeList scorecards, and epic sound effects.' },
      game: { iconSvg: icons.gamepad(24), title: 'PC HUD // Game Terminal', subtitle: 'Save slots, playtime hours, quest logs, and metascore achievements.' },
      book: { iconSvg: icons.book(24), title: 'The Grand Bookshelf', subtitle: 'Bound volumes, author marginalia, page counts, and reading progress.' }
    };

    const info = headers[type] || headers.movie;
    if (iconEl) iconEl.innerHTML = info.iconSvg;
    if (titleEl) titleEl.textContent = info.title;
    if (subtitleEl) subtitleEl.textContent = info.subtitle;

    // Remove existing thematic ticker if any
    const existingTicker = document.getElementById('thematicTicker');
    if (existingTicker) existingTicker.remove();

    // Thematic HUD element injection
    if (type === 'game') {
      const ticker = document.createElement('div');
      ticker.id = 'thematicTicker';
      ticker.className = 'gaming-hud-ticker';
      ticker.innerHTML = `
        <div class="hud-stat-item"><span class="hud-dot"></span> <span>TERMINAL: ONLINE</span></div>
        <div class="hud-stat-item"><span>FPS: 144</span></div>
        <div class="hud-stat-item"><span>GPU: 62°C</span></div>
        <div class="hud-stat-item"><span>PING: 18ms</span></div>
        <div class="hud-stat-item"><span style="color:#f59e0b;">QUEST LOG: ACTIVE</span></div>
        <div class="hud-stat-item"><span style="color:#06b6d4;">QUICK LOAD [F9]</span></div>
      `;
      stripEl?.parentNode.insertBefore(ticker, stripEl.nextSibling);
    } else if (type === 'tv') {
      const ticker = document.createElement('div');
      ticker.id = 'thematicTicker';
      ticker.className = 'tv-broadcast-ticker';
      ticker.innerHTML = `
        <div class="rec-indicator"><span class="rec-dot"></span> <span>REC [00:42:15]</span></div>
        <div>NTSC BROADCAST SIGNAL: LOCKED</div>
        <div>AUDIO: 2-CH HI-FI STEREO</div>
        <div>CH-04 STUDIO MASTER</div>
      `;
      stripEl?.parentNode.insertBefore(ticker, stripEl.nextSibling);
    }
  }

  // ===================================================================
  // Home View: Render Horizontal Rows with Vector Icons & Rich Sections
  // ===================================================================
  renderHomeRows() {
    const list = this.mediaList;

    const hasGenre = (item, genre) => {
      const g = item.genres || [];
      return g.some(x => x.toLowerCase().includes(genre.toLowerCase()));
    };

    // 1. Featured Memory (Random 5-star title on right side of Hero)
    const fiveStarItems = list.filter(m => Number(m.metrics?.favorite) === 5);
    const pool = fiveStarItems.length > 0 ? fiveStarItems : list;
    if (pool.length > 0) {
      let currentIdx = Math.floor(Math.random() * pool.length);
      const renderCurrentMemory = () => {
        const item = pool[currentIdx % pool.length];
        ui.renderFeaturedMemory(
          item,
          () => {
            currentIdx = (currentIdx + 1 + Math.floor(Math.random() * (pool.length - 1))) % pool.length;
            renderCurrentMemory();
          },
          (clickedItem) => this.handleCardClick(clickedItem)
        );
      };
      renderCurrentMemory();
    } else {
      ui.renderFeaturedMemory(null);
    }

    // 2. Currently Watching (< 6 responsive grid with progress bars, >= 6 carousel)
    const currentlyWatching = list.filter(m => m.status === 'In Progress');
    ui.renderCurrentlyWatching(
      currentlyWatching,
      (item) => this.handleCardClick(item),
      (item) => this.handleQuickPlusOne(item)
    );

    // 3. This Year in Review (Pure SVG: Monthly bar chart, rating distribution, category donut)
    const yearInReview = statsService.getYearInReview(list, new Date().getFullYear());
    ui.renderYearInReview(yearInReview);

    // 4. Backlog Queue (Next 5 planned items with "Pick for me" random selector)
    const backlog = statsService.getBacklogQueue(list, 5);
    ui.renderBacklogQueue(
      backlog,
      (picked) => {
        ui.showToast(`Selected: "${picked.title}" from your backlog queue!`, 'success');
      },
      (item) => this.handleCardClick(item)
    );

    // 5. On This Day (Titles finished on this day in previous years)
    const onThisDay = statsService.getOnThisDay(list);
    ui.renderOnThisDay(onThisDay, (item) => this.handleCardClick(item));

    // 6. Activity Heatmap (GitHub-style 16-week matrix)
    const heatmapCols = statsService.getActivityHeatmap(list, 16);
    ui.renderActivityHeatmap(heatmapCols);

    // 7. Recently Watched & Experienced (Horizontal strip with category filter tab row)
    this.updateRecentWatchedStrip();

    // 8. Curated Thematic Showcase Rows
    const mostFavourite = list.filter(m => Number(m.metrics?.favorite) === 5);
    const characterInfluence = list.filter(m => 
      (m.metrics?.characterInfluence && m.metrics.characterInfluence >= 5) ||
      (m.metrics?.retention && m.metrics.retention >= 5)
    );
    const romance = list.filter(m => hasGenre(m, 'Romance') || m.emotionalImpact?.cried);
    const scifi = list.filter(m => hasGenre(m, 'Sci-Fi'));
    const action = list.filter(m => hasGenre(m, 'Action'));
    const tvSeries = list.filter(m => m.type === 'tv' || m.type === 'series');
    const topAnime = list.filter(m => m.type === 'anime' && Number(m.metrics?.favorite) >= 4);
    const planToWatch = list.filter(m => m.status === 'Plan to Watch/Play');

    const rows = [
      { iconSvg: icons.crown(18), title: 'All-Time Most Favourite Masterpieces', items: mostFavourite },
      { iconSvg: icons.sparkles(18), title: 'Deep Character Development & Influence', items: characterInfluence },
      { iconSvg: icons.heart(18), title: 'Romance & Heartstrings', items: romance },
      { iconSvg: icons.rocket(18), title: 'Sci-Fi Universe', items: scifi },
      { iconSvg: icons.zap(18), title: 'High-Octane Action', items: action },
      { iconSvg: icons.tv(18), title: 'Top TV Series & Shows', items: tvSeries },
      { iconSvg: icons.sparkles(18), title: 'Top Anime (Most Favourite Ones)', items: topAnime },
      { iconSvg: icons.bookmark(18), title: 'What I Plan to Watch / Play / Read', items: planToWatch }
    ];

    ui.renderHomeShowcase(rows, (item) => this.handleCardClick(item));
  }

  updateRecentWatchedStrip() {
    let recentList = [...this.mediaList];
    if (this.activeRecentCategory !== 'all') {
      recentList = recentList.filter(m => {
        if (this.activeRecentCategory === 'movie') return m.type === 'movie';
        if (this.activeRecentCategory === 'tv') return m.type === 'tv' || m.type === 'series';
        if (this.activeRecentCategory === 'anime') return m.type === 'anime';
        if (this.activeRecentCategory === 'game') return m.type === 'game';
        if (this.activeRecentCategory === 'book') return m.type === 'book';
        return true;
      });
    }
    recentList.sort((a, b) => new Date(b.dateExperienced || b.createdAt || 0) - new Date(a.dateExperienced || a.createdAt || 0));
    ui.renderRecentlyWatchedStrip(
      recentList.slice(0, 15),
      this.activeRecentCategory,
      (cat) => {
        this.activeRecentCategory = cat;
        this.updateRecentWatchedStrip();
      },
      (item) => this.handleCardClick(item)
    );
  }

  // ===================================================================
  // Dedicated Pages: Filter, Sort & Render Grid
  // ===================================================================
  applyFiltersAndRenderGrid() {
    const targetType = this.currentView;

    let result = this.mediaList.filter(item => {
      if (targetType === 'movie') return item.type === 'movie';
      if (targetType === 'tv') return item.type === 'tv' || item.type === 'series';
      if (targetType === 'anime') return item.type === 'anime';
      if (targetType === 'game') return item.type === 'game';
      if (targetType === 'book') return item.type === 'book';
      return true;
    });

    // 1. Gaming Page Specific HUD Stats & Status Filter Tabs
    if (targetType === 'game') {
      const allGames = this.mediaList.filter(m => m.type === 'game');
      const gameHUD = statsService.getGamingHUDStats(allGames);
      const gameCounts = {
        all: allGames.length,
        playing: allGames.filter(m => m.status === 'In Progress').length,
        completed: allGames.filter(m => m.status === 'Completed').length,
        plan: allGames.filter(m => m.status.includes('Plan')).length,
        dropped: allGames.filter(m => m.status === 'Dropped').length
      };
      ui.renderGamingStatsHUD(gameHUD, gameCounts);

      if (this.gameStatusFilter && this.gameStatusFilter !== 'all') {
        result = result.filter(m => {
          if (this.gameStatusFilter === 'playing') return m.status === 'In Progress';
          if (this.gameStatusFilter === 'completed') return m.status === 'Completed';
          if (this.gameStatusFilter === 'plan') return m.status.includes('Plan');
          if (this.gameStatusFilter === 'dropped') return m.status === 'Dropped';
          return true;
        });
      }
    }

    // 2. TV Shows Page Specific HUD Stats & Status Filter Tabs
    if (targetType === 'tv') {
      const allShows = this.mediaList.filter(m => m.type === 'tv' || m.type === 'series');
      const tvHUD = statsService.getTVHUDStats(allShows);
      const tvCounts = {
        all: allShows.length,
        watching: allShows.filter(m => m.status === 'In Progress').length,
        completed: allShows.filter(m => m.status === 'Completed').length,
        plan: allShows.filter(m => m.status.includes('Plan')).length,
        dropped: allShows.filter(m => m.status === 'Dropped').length
      };
      ui.renderTVStatsHUD(tvHUD, tvCounts);

      if (this.tvStatusFilter && this.tvStatusFilter !== 'all') {
        result = result.filter(m => {
          if (this.tvStatusFilter === 'watching') return m.status === 'In Progress';
          if (this.tvStatusFilter === 'completed') return m.status === 'Completed';
          if (this.tvStatusFilter === 'plan') return m.status.includes('Plan');
          if (this.tvStatusFilter === 'dropped') return m.status === 'Dropped';
          return true;
        });
      }
    }

    if (targetType === 'anime' && this.selectedGenre !== 'all') {
      result = result.filter(item => {
        if (!Array.isArray(item.genres)) return false;
        return item.genres.some(g => g.toLowerCase() === this.selectedGenre.toLowerCase());
      });
    }

    if (targetType === 'movie' && this.selectedMovieGenre !== 'all') {
      result = result.filter(item => {
        if (!Array.isArray(item.genres)) return false;
        return item.genres.some(g => g.toLowerCase() === this.selectedMovieGenre.toLowerCase());
      });
    }

    if (this.selectedStatus !== 'all') {
      result = result.filter(item => (item.status || 'Completed') === this.selectedStatus);
    }

    if (this.filterCried) {
      result = result.filter(item => Boolean(item.emotionalImpact?.cried));
    }

    if (this.selectedSource !== 'all') {
      result = result.filter(item => item.discoverySource === this.selectedSource);
    }

    if (this.searchQuery) {
      result = result.filter(item => {
        const titleMatch = (item.title || '').toLowerCase().includes(this.searchQuery);
        const reviewMatch = (item.review || '').toLowerCase().includes(this.searchQuery);
        const authorMatch = (item.bookDetails?.author || item.author || '').toLowerCase().includes(this.searchQuery);
        return titleMatch || reviewMatch || authorMatch;
      });
    }

    result.sort((a, b) => {
      switch (this.sortBy) {
        case 'rating': {
          const getScore = (x) => {
            const r = parseFloat(x.externalScore?.rating);
            return isNaN(r) ? 0 : r;
          };
          return getScore(b) - getScore(a);
        }
        case 'yearNewest':
          return (Number(b.releaseYear) || 0) - (Number(a.releaseYear) || 0);
        case 'yearOldest':
          return (Number(a.releaseYear) || 0) - (Number(b.releaseYear) || 0);
        case 'favorite':
          return (Number(b.metrics?.favorite) || 0) - (Number(a.metrics?.favorite) || 0);
        case 'yapFactor':
          return (Number(b.metrics?.yapFactor) || 0) - (Number(a.metrics?.yapFactor) || 0);
        case 'retention':
          return (Number(b.metrics?.retention) || 0) - (Number(a.metrics?.retention) || 0);
        case 'hoursPlayed':
          return (Number(b.gameDetails?.hoursPlayed) || 0) - (Number(a.gameDetails?.hoursPlayed) || 0);
        case 'title':
          return (a.title || '').localeCompare(b.title || '');
        case 'dateOldest':
          return new Date(a.dateExperienced || 0) - new Date(b.dateExperienced || 0);
        case 'dateExperienced':
        default:
          return new Date(b.dateExperienced || 0) - new Date(a.dateExperienced || 0);
      }
    });

    this.filteredList = result;
    this.renderDedicatedGrid();
  }

  renderDedicatedGrid() {
    ui.renderMediaGrid(
      this.filteredList,
      api.isAdmin(),
      (item) => this.handleCardClick(item),
      (item) => this.handleEdit(item),
      (item) => this.handleDelete(item),
      this.viewMode,
      this.currentView
    );

    // Bind custom interactive buttons (+1 Ep, Episode Guide, Fix Poster)
    const container = document.getElementById('mediaContainer');
    if (container) {
      container.querySelectorAll('.btn-plus-one-ep').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = btn.getAttribute('data-id');
          const item = this.mediaList.find(m => m.id === id);
          if (item) this.handleQuickPlusOne(item);
        });
      });

      container.querySelectorAll('.btn-episodes-guide').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = btn.getAttribute('data-id');
          const item = this.mediaList.find(m => m.id === id);
          if (item) this.openTVEpisodeModal(item);
        });
      });

      container.querySelectorAll('.card-btn-fix').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = btn.getAttribute('data-id');
          const item = this.mediaList.find(m => m.id === id);
          if (item) this.openFixPosterModal(item);
        });
      });
    }

    // Movies spotlight bar fix cover button
    document.getElementById('btnFixSpotlightPoster')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const item = this.mediaList.find(m => m.id === 'mov-severance') || this.filteredList[0];
      if (item) this.openFixPosterModal(item);
    });

    if (this.currentView === 'anime') {
      this.initAnimeAmbientSystem();
    }
  }

  // ===================================================================
  // Adaptive Ambient Dynamic Background System for Anime Manga
  // ===================================================================
  initAnimeAmbientSystem() {
    const backdrop = document.getElementById('animeAmbientBackdrop');
    if (!backdrop) return;

    const ANIME_PALETTES = {
      'Spirited Away': 'radial-gradient(ellipse at 80% 25%, rgba(20, 184, 166, 0.42) 0%, transparent 65%), radial-gradient(ellipse at 20% 75%, rgba(245, 158, 11, 0.28) 0%, transparent 60%), linear-gradient(145deg, #042f2e 0%, #081a24 50%, #031317 100%)',
      "Frieren: Beyond Journey's End": 'radial-gradient(ellipse at 80% 25%, rgba(251, 191, 36, 0.4) 0%, transparent 65%), radial-gradient(ellipse at 20% 75%, rgba(168, 85, 247, 0.32) 0%, transparent 60%), linear-gradient(145deg, #240d40 0%, #110d24 50%, #070712 100%)',
      'Cyberpunk: Edgerunners': 'radial-gradient(ellipse at 80% 25%, rgba(244, 63, 94, 0.48) 0%, transparent 65%), radial-gradient(ellipse at 20% 75%, rgba(6, 182, 212, 0.4) 0%, transparent 60%), linear-gradient(145deg, #240523 0%, #0b1424 50%, #050b14 100%)',
      'Your Name (Kimi no Na wa)': 'radial-gradient(ellipse at 80% 25%, rgba(244, 114, 182, 0.42) 0%, transparent 65%), radial-gradient(ellipse at 20% 75%, rgba(129, 140, 248, 0.35) 0%, transparent 60%), linear-gradient(145deg, #201035 0%, #15112b 50%, #0a0b16 100%)',
      'Chainsaw Man': 'radial-gradient(ellipse at 80% 25%, rgba(239, 68, 68, 0.48) 0%, transparent 65%), radial-gradient(ellipse at 20% 75%, rgba(249, 115, 22, 0.35) 0%, transparent 60%), linear-gradient(145deg, #2d0707 0%, #1a0808 50%, #0d0404 100%)',
      'Attack on Titan': 'radial-gradient(ellipse at 80% 25%, rgba(132, 204, 22, 0.42) 0%, transparent 65%), radial-gradient(ellipse at 20% 75%, rgba(185, 28, 28, 0.38) 0%, transparent 60%), linear-gradient(145deg, #162413 0%, #1e1111 50%, #0a0d09 100%)',
      'Steins;Gate': 'radial-gradient(ellipse at 80% 25%, rgba(34, 197, 94, 0.45) 0%, transparent 65%), radial-gradient(ellipse at 20% 75%, rgba(245, 158, 11, 0.30) 0%, transparent 60%), linear-gradient(145deg, #052618 0%, #191408 50%, #060e0a 100%)',
      'Jujutsu Kaisen': 'radial-gradient(ellipse at 80% 25%, rgba(168, 85, 247, 0.45) 0%, transparent 65%), radial-gradient(ellipse at 20% 75%, rgba(56, 189, 248, 0.32) 0%, transparent 60%), linear-gradient(145deg, #1c0a3a 0%, #0c182e 50%, #070714 100%)'
    };

    const defaultAnimeGrad = 'radial-gradient(ellipse at 75% 20%, rgba(244, 63, 94, 0.3) 0%, transparent 60%), radial-gradient(ellipse at 25% 80%, rgba(99, 102, 241, 0.25) 0%, transparent 60%), linear-gradient(145deg, #140b22 0%, #090b14 100%)';

    const updateBackdrop = (title) => {
      if (this.currentView !== 'anime') return;
      const gradient = ANIME_PALETTES[title] || defaultAnimeGrad;
      backdrop.style.background = gradient;
    };

    const firstPanel = document.querySelector('.manga-panel:not(.manga-panel-placeholder)');
    if (firstPanel && firstPanel.getAttribute('data-title')) {
      updateBackdrop(firstPanel.getAttribute('data-title'));
    }

    document.querySelectorAll('.manga-panel:not(.manga-panel-placeholder)').forEach(panel => {
      panel.addEventListener('mouseenter', () => {
        const title = panel.getAttribute('data-title');
        if (title) updateBackdrop(title);
      });
    });

    if (this._animeObserver) {
      this._animeObserver.disconnect();
    }

    this._animeObserver = new IntersectionObserver((entries) => {
      if (this.currentView !== 'anime') return;
      entries.forEach(entry => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.3) {
          const title = entry.target.getAttribute('data-title');
          if (title) updateBackdrop(title);
        }
      });
    }, {
      root: null,
      threshold: [0.3, 0.6]
    });

    document.querySelectorAll('.manga-panel:not(.manga-panel-placeholder)').forEach(p => {
      this._animeObserver.observe(p);
    });
  }

  handleCardClick(item) {
    ui.openDetailModal(
      item,
      api.isAdmin(),
      (m) => this.handleEdit(m),
      (m) => this.handleDelete(m),
      (m) => this.openFixPosterModal(m)
    );
  }

  // ===================================================================
  // Fix Poster Modal Controller
  // ===================================================================
  openFixPosterModal(item) {
    this.fixPosterTargetItem = item;
    const modal = document.getElementById('fixPosterModal');
    if (!modal) return;
    document.getElementById('fixPosterItemTitle').textContent = item.title;
    document.getElementById('fixPosterItemType').textContent = (item.type || 'media').toUpperCase();
    document.getElementById('fixPosterInputUrl').value = item.posterUrl || '';
    document.getElementById('fixPosterCandidates').style.display = 'none';
    ui.renderFixPosterPreview(item, null);
    modal.style.display = 'flex';
    modal.classList.add('active');
  }

  closeFixPosterModal() {
    const modal = document.getElementById('fixPosterModal');
    if (!modal) return;
    modal.classList.remove('active');
    modal.style.display = 'none';
    this.fixPosterTargetItem = null;
  }

  // ===================================================================
  // Storage & Cloud Sync Setup Modal
  // ===================================================================
  openStorageModal() {
    const modal = document.getElementById('storageModal');
    if (!modal) return;

    const ghConfig = api.getGitHubConfig() || {};
    const inputToken = document.getElementById('cfgGithubToken');
    const inputOwner = document.getElementById('cfgGithubOwner');
    const inputRepo = document.getElementById('cfgGithubRepo');
    if (inputToken) inputToken.value = ghConfig.token || '';
    if (inputOwner) inputOwner.value = ghConfig.owner || '';
    if (inputRepo) inputRepo.value = ghConfig.repo || '';

    this.updateStorageModalStatus();

    modal.style.display = 'flex';
    modal.classList.add('active');
  }

  closeStorageModal() {
    const modal = document.getElementById('storageModal');
    if (!modal) return;
    modal.classList.remove('active');
    modal.style.display = 'none';
  }

  updateStorageModalStatus() {
    const ghConfig = api.getGitHubConfig();
    const badge = document.getElementById('syncStatusBadge');
    const title = document.getElementById('syncStatusTitle');
    const desc = document.getElementById('syncStatusDesc');
    const feedback = document.getElementById('cfgGithubFeedback');
    if (feedback) feedback.style.display = 'none';

    if (ghConfig && ghConfig.token && ghConfig.owner && ghConfig.repo) {
      if (badge) {
        badge.className = 'status-pill status-completed';
        badge.textContent = 'Cloud Sync Configured';
      }
      if (title) title.textContent = `GitHub Auto-Commit Active`;
      if (desc) desc.textContent = `Target: ${ghConfig.owner}/${ghConfig.repo} (Branch: ${ghConfig.branch || 'main'})`;
    } else {
      if (badge) {
        badge.className = 'status-pill status-in-progress';
        badge.textContent = 'Browser Storage Only';
      }
      if (title) title.textContent = 'Local Browser Mode';
      if (desc) desc.textContent = 'Changes stay saved in this browser. Configure GitHub below or add Vercel env vars to auto-commit to repository.';
    }
  }

  // ===================================================================
  // TV Shows Quick Actions & Episode Guide
  // ===================================================================
  async handleQuickPlusOne(item) {
    if (!item.tvDetails) item.tvDetails = {};
    const total = item.tvDetails.totalEpisodes || 10;
    const current = Number(item.tvDetails.watchedEpisodes) || 0;
    if (current < total) {
      item.tvDetails.watchedEpisodes = current + 1;
      if (item.tvDetails.seasons && item.tvDetails.seasons.length > 0) {
        let remaining = item.tvDetails.watchedEpisodes;
        for (const s of item.tvDetails.seasons) {
          const sEps = s.episodes || 10;
          s.watched = Math.min(sEps, remaining);
          remaining = Math.max(0, remaining - sEps);
        }
      }
      if (item.tvDetails.watchedEpisodes === total) {
        item.status = 'Completed';
      } else {
        item.status = 'In Progress';
      }
      const res = await api.saveMedia(item, this.mediaList);
      if (res.success) {
        this.mediaList = res.items;
        this.refreshCurrentView();
        statsService.renderStatsBar(this.mediaList);
        ui.showToast(`Marked ${item.title} Ep ${item.tvDetails.watchedEpisodes}/${total} watched!`, 'success');
      }
    } else {
      ui.showToast(`${item.title} is already completed!`, 'info');
    }
  }

  openTVEpisodeModal(item) {
    const modal = document.getElementById('tvEpisodeModal');
    if (!modal) return;
    document.getElementById('tvModalTitle').textContent = `${item.title} // Broadcast Episode Guide`;
    const tv = item.tvDetails || {};
    const totalEps = tv.totalEpisodes || 10;
    const watchedEps = Number(tv.watchedEpisodes) || 0;
    document.getElementById('tvModalMetaBar').innerHTML = `
      <span>NETWORK: <strong>${tv.network || 'BROADCAST'}</strong></span>
      <span>PROGRESS: <strong>${watchedEps}/${totalEps} EPS</strong> (${Math.round((watchedEps/totalEps)*100)}%)</span>
      <span>STATUS: <strong>${(item.status || 'In Progress').toUpperCase()}</strong></span>
    `;

    ui.renderTVEpisodeAccordion(item, async (seasonNum, epNum) => {
      if (!item.tvDetails) item.tvDetails = {};
      if (!item.tvDetails.seasons) {
        item.tvDetails.seasons = [{ seasonNumber: 1, episodes: totalEps, watched: watchedEps }];
      }
      const targetSeason = item.tvDetails.seasons.find(s => s.seasonNumber === seasonNum);
      if (targetSeason) {
        if (epNum <= (targetSeason.watched || 0)) {
          targetSeason.watched = epNum - 1;
        } else {
          targetSeason.watched = epNum;
        }
        let newTotalWatched = 0;
        item.tvDetails.seasons.forEach(s => {
          newTotalWatched += (s.watched || 0);
        });
        item.tvDetails.watchedEpisodes = newTotalWatched;
        if (newTotalWatched >= totalEps) {
          item.status = 'Completed';
        } else if (newTotalWatched > 0) {
          item.status = 'In Progress';
        }
        const res = await api.saveMedia(item, this.mediaList);
        if (res.success) {
          this.mediaList = res.items;
          this.refreshCurrentView();
          this.openTVEpisodeModal(item);
          statsService.renderStatsBar(this.mediaList);
        }
      }
    });

    modal.style.display = 'flex';
    modal.classList.add('active');
  }

  handleEdit(item) {
    ui.openLogModal(item);
  }

  async handleDelete(item) {
    if (!api.isAdmin()) {
      ui.openAdminModal();
      return;
    }

    if (confirm(`Are you sure you want to delete "${item.title}" from your media log?`)) {
      const res = await api.deleteMedia(item.id, this.mediaList);
      if (res.success) {
        this.mediaList = res.items;
        this.refreshCurrentView();
        statsService.renderStatsBar(this.mediaList);
        ui.showToast(`Deleted "${item.title}"`, 'success');
      }
    }
  }

  async executeExternalSearch() {
    const input = document.getElementById('externalSearchInput');
    const query = input ? input.value.trim() : '';

    if (!query) {
      ui.renderSearchResults([], api.isAdmin());
      return;
    }

    const container = document.getElementById('searchResultsContainer');
    if (container) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 3rem 0; color: var(--text-muted);">
          <div style="font-size: 1.5rem; margin-bottom: 0.5rem; display:flex; justify-content:center;">
            ${icons.refresh(32, 'spin')}
          </div>
          Searching ${this.searchViewCategory.toUpperCase()} catalog...
        </div>
      `;
    }

    try {
      const results = await searchService.search(query, this.searchViewCategory);
      ui.renderSearchResults(results, api.isAdmin(), (item) => {
        ui.openLogModal(item);
      });
    } catch (err) {
      if (container) {
        container.innerHTML = `
          <div class="empty-state" style="grid-column: 1 / -1;">
            <div class="empty-icon" style="color:var(--text-dim); display:flex; justify-content:center; margin-bottom:1rem;">
              ${icons.alertCircle(44)}
            </div>
            <h3 class="empty-title">Search Error</h3>
            <p class="empty-desc">${err.message || 'Could not fetch external results.'}</p>
          </div>
        `;
      }
    }
  }

  async saveLoggedMedia() {
    const id = document.getElementById('mediaId').value || `item-${Date.now()}`;
    const title = document.getElementById('mediaTitle').value.trim();
    const type = document.getElementById('mediaType').value;
    const releaseYear = Number(document.getElementById('mediaYear').value) || null;
    const posterUrl = document.getElementById('mediaPosterUrl').value.trim();
    const extSource = document.getElementById('mediaExternalSource').value.trim() || 'Score';
    const extScore = document.getElementById('mediaExternalScore').value.trim() || 'N/A';

    if (!title) {
      alert('Please enter a title');
      return;
    }

    let status = 'Completed';
    document.querySelectorAll('.status-opt-btn').forEach(btn => {
      if (btn.classList.contains('active')) status = btn.getAttribute('data-val');
    });

    const discoverySource = document.getElementById('mediaDiscoverySource').value;
    const recommendedBy = document.getElementById('mediaRecommendedBy').value.trim();

    const socialContext = [];
    document.querySelectorAll('.social-tag-btn.active').forEach(btn => {
      socialContext.push(btn.getAttribute('data-val'));
    });

    const dateExperienced = document.getElementById('mediaDateExperienced').value || new Date().toISOString().slice(0, 10);

    const favorite = Number(document.getElementById('mediaFavoriteLevel').value) || 5;
    const enjoyment = Number(document.getElementById('sliderEnjoyment').value) || 5;
    const retention = Number(document.getElementById('sliderRetention').value) || 4;
    const yapFactor = Number(document.getElementById('sliderYap').value) || 4;

    const cried = Boolean(document.getElementById('toggleCried')?.checked);

    const hoursPlayed = Number(document.getElementById('gameHoursPlayed')?.value) || 0;
    const timesFinished = Number(document.getElementById('gameTimesFinished')?.value) || 0;

    const bookAuthor = document.getElementById('bookAuthor')?.value.trim() || '';
    const bookPages = Number(document.getElementById('bookPages')?.value) || 0;
    const bookFormat = document.getElementById('bookFormat')?.value || 'Paperback';

    const review = document.getElementById('mediaReview').value.trim();

    const mediaItem = {
      id,
      title,
      type,
      releaseYear,
      posterUrl,
      externalScore: {
        source: extSource,
        rating: extScore
      },
      status,
      discoverySource,
      recommendedBy,
      socialContext: socialContext.length > 0 ? socialContext : ['Solo'],
      dateExperienced,
      metrics: {
        favorite,
        enjoyment,
        retention,
        yapFactor,
        characterInfluence: retention
      },
      emotionalImpact: {
        cried
      },
      gameDetails: {
        hoursPlayed: type === 'game' ? hoursPlayed : 0,
        timesFinished: type === 'game' ? timesFinished : 0
      },
      bookDetails: {
        author: type === 'book' ? bookAuthor : '',
        pages: type === 'book' ? bookPages : 0,
        format: type === 'book' ? bookFormat : ''
      },
      review
    };

    ui.closeLogModal();
    ui.showToast('Saving media entry...', 'info', 1500);

    const res = await api.saveMedia(mediaItem, this.mediaList);
    if (res.success) {
      this.mediaList = res.items;
      this.refreshCurrentView();
      statsService.renderStatsBar(this.mediaList);
      ui.showToast(`Saved "${title}" (${res.storage})`, 'success');
      if (this.currentView === 'search') {
        this.switchView('home');
      }
    } else {
      ui.showToast('Failed to save entry', 'error');
    }
  }

  updateAdminUI() {
    const isAdmin = api.isAdmin();
    const btnLogin = document.getElementById('btnAdminLogin');
    const adminBadge = document.getElementById('adminLoggedBadge');
    const btnAdd = document.getElementById('btnAddMedia');

    if (isAdmin) {
      if (btnLogin) btnLogin.style.display = 'none';
      if (adminBadge) adminBadge.style.display = 'inline-flex';
      if (btnAdd) btnAdd.style.display = 'inline-flex';
    } else {
      if (btnLogin) btnLogin.style.display = 'inline-flex';
      if (adminBadge) adminBadge.style.display = 'none';
      if (btnAdd) btnAdd.style.display = 'none';
    }
  }
}

function bootMediaLogApp() {
  if (window.__mediaLogApp) return;
  const app = new MediaLogApp();
  window.__mediaLogApp = app;
  app.init();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootMediaLogApp);
} else {
  bootMediaLogApp();
}
