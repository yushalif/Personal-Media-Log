/**
 * Media Log - UI Rendering & Modal Interaction Module
 * Distraction-free dark mode components, dynamic sliders, tags, detail view,
 * and cinematic auto-swiping horizontal rows using vector SVG icons.
 */

import { icons } from './icons.js';

export const ui = {
  // ===================================================================
  // Shared Poster Component: Loading skeleton -> Image -> Graceful fallback
  // ===================================================================
  createPosterHTML(item, options = {}) {
    if (!item) return '';
    const {
      aspectRatio = (item.type === 'game' ? '3/4' : '2/3'),
      className = '',
      imgClass = 'card-poster',
      alt = item.title || 'Poster',
      lazy = true
    } = options;

    const title = item.title || 'Untitled';
    const type = item.type || 'movie';
    const posterUrl = (item.posterUrl || '').trim();

    // Deterministic hash -> hue from title
    let hash = 0;
    for (let i = 0; i < title.length; i++) {
      hash = ((hash << 5) - hash) + title.charCodeAt(i);
      hash |= 0;
    }
    hash = Math.abs(hash);
    const hue1 = hash % 360;
    const hue2 = (hue1 + 45 + (hash % 60)) % 360;
    const accentHue = (hue1 + 180) % 360;

    let fontFamily = "'Inter', sans-serif";
    let typeIconSvg = icons.film(24);
    let typeLabel = 'FEATURE';

    if (type === 'movie') {
      fontFamily = "'Cinzel', Georgia, serif";
      typeIconSvg = icons.film(24);
      typeLabel = '35MM FILM';
    } else if (type === 'anime') {
      fontFamily = "'Bangers', 'Impact', cursive";
      typeIconSvg = icons.sparkles(24);
      typeLabel = 'MANGA';
    } else if (type === 'game') {
      fontFamily = "'Share Tech Mono', monospace";
      typeIconSvg = icons.gamepad(24);
      typeLabel = 'GAME';
    } else if (type === 'tv' || type === 'series') {
      fontFamily = "'VT323', monospace";
      typeIconSvg = icons.tv(24);
      typeLabel = 'BROADCAST';
    } else if (type === 'book') {
      fontFamily = "'Crimson Pro', Georgia, serif";
      typeIconSvg = icons.book(24);
      typeLabel = 'BOOK';
    }

    const aspectClass = aspectRatio === '3/4' ? 'aspect-3-4' : (aspectRatio === '1/1' ? 'aspect-1-1' : 'aspect-2-3');
    const safeTitle = this.escapeHtml(title);
    const safeAlt = this.escapeHtml(alt);
    // Never treat empty cinema seats photo as valid
    const hasValidUrl = Boolean(posterUrl && !posterUrl.includes('photo-1489599849927-2ee91cede3ba'));

    const fallbackHTML = `
      <div class="poster-generated-cover" style="--cover-h1:${hue1}; --cover-h2:${hue2}; --cover-accent:${accentHue}; font-family:${fontFamily};">
        <div class="cover-bg-mesh"></div>
        <div class="cover-header">
          <span class="cover-type-tag">${typeLabel}</span>
          <span class="cover-year">${item.releaseYear || ''}</span>
        </div>
        <div class="cover-icon-emblem">
          ${typeIconSvg}
        </div>
        <div class="cover-body">
          <h4 class="cover-title">${safeTitle}</h4>
          ${item.genres && item.genres.length ? `<span class="cover-genre">${this.escapeHtml(item.genres[0])}</span>` : ''}
        </div>
        <div class="cover-footer-strip">
          <span class="cover-hash">#${hash.toString(16).slice(-4).toUpperCase()}</span>
          <span class="cover-watermark">MEDIALOG</span>
        </div>
      </div>
    `;

    return `
      <div class="shared-poster-box ${aspectClass} ${className} ${!hasValidUrl ? 'has-failed' : ''}" data-title="${safeTitle}">
        <div class="poster-shimmer-skeleton" aria-hidden="true"></div>
        ${fallbackHTML}
        ${hasValidUrl ? `
          <img class="${imgClass}"
               src="${this.escapeHtml(posterUrl)}"
               alt="${safeAlt}"
               ${lazy ? 'loading="lazy"' : ''}
               decoding="async"
               referrerpolicy="no-referrer"
               onload="this.parentElement.classList.add('is-loaded')"
               onerror="this.style.display='none'; this.parentElement.classList.add('has-failed');">
        ` : ''}
      </div>
    `;
  },

  // ===================================================================
  // Home View: Auto-Swiping Horizontal Rows
  // ===================================================================
  autoSwipeTimers: [],

  renderHomeShowcase(rows, onCardClick) {
    const container = document.getElementById('homeRowsContainer');
    if (!container) return;

    this.autoSwipeTimers.forEach(t => clearInterval(t));
    this.autoSwipeTimers = [];

    container.innerHTML = rows.map((row, idx) => {
      if (!row.items || row.items.length === 0) return '';
      const rowId = `hrow-${idx}`;

      return `
        <div class="horizontal-row-wrapper" data-row-id="${rowId}">
          <div class="row-header">
            <div class="row-title-group">
              <h3 class="row-title">
                <span style="display:inline-flex; align-items:center; color:var(--accent-primary);">${row.iconSvg}</span>
                <span>${row.title}</span>
              </h3>
              <span class="row-count-badge">${row.items.length} titles</span>
            </div>
            <div class="row-nav-controls">
              <button class="btn-row-nav btn-row-prev" data-target="${rowId}" title="Scroll Left" aria-label="Previous">
                ${icons.chevronLeft(16)}
              </button>
              <button class="btn-row-nav btn-row-next" data-target="${rowId}" title="Scroll Right" aria-label="Next">
                ${icons.chevronRight(16)}
              </button>
            </div>
          </div>

          <div id="${rowId}" class="horizontal-scroll-track">
            ${row.items.map(item => this.createRowCardHTML(item)).join('')}
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.row-card').forEach(cardEl => {
      cardEl.addEventListener('click', () => {
        const id = cardEl.getAttribute('data-id');
        const allItems = rows.flatMap(r => r.items);
        const item = allItems.find(m => m.id === id);
        if (item) onCardClick(item);
      });
    });

    container.querySelectorAll('.btn-row-prev').forEach(btn => {
      btn.addEventListener('click', () => {
        const track = document.getElementById(btn.getAttribute('data-target'));
        if (track) track.scrollBy({ left: -420, behavior: 'smooth' });
      });
    });

    container.querySelectorAll('.btn-row-next').forEach(btn => {
      btn.addEventListener('click', () => {
        const track = document.getElementById(btn.getAttribute('data-target'));
        if (track) track.scrollBy({ left: 420, behavior: 'smooth' });
      });
    });

    container.querySelectorAll('.horizontal-scroll-track').forEach(track => {
      let isHovered = false;
      track.addEventListener('mouseenter', () => { isHovered = true; });
      track.addEventListener('mouseleave', () => { isHovered = false; });
      track.addEventListener('touchstart', () => { isHovered = true; }, { passive: true });
      track.addEventListener('touchend', () => { isHovered = false; }, { passive: true });

      const randomInterval = Math.floor(Math.random() * 3000) + 3500;
      const scrollStep = 220;

      const timer = setInterval(() => {
        if (isHovered) return;
        if (track.scrollLeft + track.clientWidth >= track.scrollWidth - 10) {
          track.scrollTo({ left: 0, behavior: 'smooth' });
        } else {
          track.scrollBy({ left: scrollStep, behavior: 'smooth' });
        }
      }, randomInterval);

      this.autoSwipeTimers.push(timer);
    });
  },

  createRowCardHTML(item) {
    const typeLabel = item.type === 'game' ? 'Game' : item.type === 'anime' ? 'Anime' : item.type === 'tv' ? 'Series' : item.type === 'book' ? 'Book' : 'Movie';
    const typeClass = `type-${item.type === 'series' ? 'tv' : item.type}`;
    const didCry = Boolean(item.emotionalImpact?.cried);
    const scoreVal = item.externalScore?.rating && item.externalScore.rating !== 'N/A' ? item.externalScore.rating : null;

    return `
      <div class="row-card" data-id="${item.id}">
        <div style="position:relative; width:100%; aspect-ratio:2/3; overflow:hidden;">
          <span class="card-type-badge ${typeClass}" style="top:0.5rem; left:0.5rem; font-size:0.68rem; padding:0.15rem 0.5rem; z-index:3;">${typeLabel}</span>
          ${didCry ? `<span class="card-cry-badge" style="top:0.5rem; right:0.5rem; font-size:0.68rem; padding:0.15rem 0.45rem; z-index:3;">${icons.drop(11)}</span>` : ''}
          ${this.createPosterHTML(item, { className: 'row-card-poster-box', imgClass: 'row-card-poster', aspectRatio: '2/3' })}
        </div>
        <div class="row-card-content">
          <h4 class="row-card-title" title="${this.escapeHtml(item.title)}">${this.escapeHtml(item.title)}</h4>
          <div class="row-card-sub">
            <span>${item.releaseYear || ''}</span>
            <span style="display:inline-flex; align-items:center; gap:2px; color:#f59e0b;">
              ${icons.star(12)} ${item.metrics?.favorite || 5}
            </span>
            ${scoreVal ? `<span class="card-external-score" style="font-size:0.7rem;">${scoreVal}</span>` : ''}
          </div>
        </div>
      </div>
    `;
  },

  // ===================================================================
  // HOME PAGE NEW EXPERIENCES
  // ===================================================================

  // 1. Hero Featured Memory Component
  renderFeaturedMemory(item, onShuffle, onClick) {
    const box = document.getElementById('featuredMemoryContent');
    const shuffleBtn = document.getElementById('btnShuffleMemory');
    if (!box) return;

    if (!item) {
      box.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:1.25rem 1rem; color:var(--text-dim); gap:0.4rem; height:100%;">
          <svg class="svg-icon" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:0.4;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
          <div style="font-size:0.85rem; font-weight:600; color:var(--text-primary);">No 5-Star Memory Yet</div>
          <div style="font-size:0.75rem; color:var(--text-dim); max-width:260px; line-height:1.4;">Log any title with a 5/5 star rating to spotlight it here on your home dashboard.</div>
        </div>
      `;
      if (shuffleBtn) shuffleBtn.style.display = 'none';
      return;
    }
    if (shuffleBtn) shuffleBtn.style.display = 'inline-flex';

    const typeLabel = item.type === 'game' ? 'Game' : item.type === 'anime' ? 'Anime' : item.type === 'tv' ? 'Series' : item.type === 'book' ? 'Book' : 'Movie';
    const note = item.review || item.synopsis || 'An indelible experience that shaped my personal canon.';

    box.innerHTML = `
      <div class="featured-memory-inner" id="featuredMemoryClickArea" data-id="${item.id}" title="Click to inspect this 5-star memory">
        <div class="featured-thumb-wrap">
          ${this.createPosterHTML(item, { className: 'featured-poster-box', imgClass: 'featured-thumb-img', aspectRatio: '2/3' })}
        </div>
        <div class="featured-meta">
          <span class="featured-cat-tag">${typeLabel} · ${item.releaseYear || ''} · ★ 5.0</span>
          <h4 class="featured-title" title="${this.escapeHtml(item.title)}">${this.escapeHtml(item.title)}</h4>
          <p class="featured-note">"${this.escapeHtml(note)}"</p>
        </div>
      </div>
    `;

    document.getElementById('featuredMemoryClickArea')?.addEventListener('click', () => {
      if (onClick) onClick(item);
    });

    if (shuffleBtn && !shuffleBtn.dataset.bound) {
      shuffleBtn.dataset.bound = 'true';
      shuffleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (onShuffle) onShuffle();
      });
    }
  },

  // 2. Currently Watching & In Progress (Grid when < 6, Carousel when >= 6)
  renderCurrentlyWatching(items = [], onCardClick, onQuickPlusOne) {
    const container = document.getElementById('currentlyTrackContainer');
    const countBadge = document.getElementById('currentlyCountBadge');
    const navControls = document.getElementById('currentlyNavControls');
    if (!container) return;

    if (countBadge) countBadge.textContent = `${items.length} titles`;

    if (!items || items.length === 0) {
      container.innerHTML = `
        <div style="padding:1.5rem; text-align:center; color:var(--text-dim); font-size:0.85rem;">
          No titles currently in progress. Add or set status to "In Progress" to track active media.
        </div>
      `;
      if (navControls) navControls.style.display = 'none';
      return;
    }

    const isGrid = items.length < 6;

    if (isGrid) {
      container.className = 'currently-grid';
      if (navControls) navControls.style.display = 'none';
      container.innerHTML = items.map(item => {
        let progressLabel = 'In Progress';
        let progressPct = 50;

        if (item.type === 'tv' || item.type === 'series') {
          const total = item.tvDetails?.totalEpisodes || 10;
          const watched = Number(item.tvDetails?.watchedEpisodes) || 6;
          progressLabel = `Episode ${watched}/${total}`;
          progressPct = Math.min(100, Math.round((watched / total) * 100));
        } else if (item.type === 'book') {
          const pages = item.bookDetails?.pages || 800;
          const current = Math.round(pages * 0.45);
          progressLabel = `Page ${current}/${pages}`;
          progressPct = 45;
        } else if (item.type === 'game') {
          const hrs = item.gameDetails?.hoursPlayed || 24;
          progressLabel = `${hrs} hours logged`;
          progressPct = Math.min(100, Math.round((hrs / 60) * 100));
        }

        return `
          <div class="currently-progress-card" data-id="${item.id}">
            <div style="position:relative; width:100%; aspect-ratio:2/3;">
              <span class="card-type-badge type-${item.type || 'movie'}" style="top:0.4rem; left:0.4rem; font-size:0.65rem; z-index:3;">
                ${item.type.toUpperCase()}
              </span>
              ${this.createPosterHTML(item, { aspectRatio: '2/3', imgClass: 'currently-card-poster' })}
            </div>
            <div class="currently-card-body">
              <h4 class="currently-card-title" title="${this.escapeHtml(item.title)}">${this.escapeHtml(item.title)}</h4>
              <div class="currently-card-stat">
                <span>${progressLabel}</span>
                <span>${progressPct}%</span>
              </div>
              <div class="currently-progress-bar-wrap">
                <div class="currently-progress-fill" style="width:${progressPct}%;"></div>
              </div>
              ${item.type === 'tv' ? `
                <button type="button" class="tv-next-up-btn btn-home-plus-ep" data-id="${item.id}" style="margin-top:0.35rem; width:100%; justify-content:center;">
                  +1 Episode Watched
                </button>
              ` : ''}
            </div>
          </div>
        `;
      }).join('');
    } else {
      // Carousel mode when >= 6 items
      container.className = 'horizontal-scroll-track';
      if (navControls) navControls.style.display = 'flex';
      container.innerHTML = items.map(item => this.createRowCardHTML(item)).join('');

      const btnPrev = document.getElementById('btnCurrentlyPrev');
      const btnNext = document.getElementById('btnCurrentlyNext');
      if (btnPrev) {
        btnPrev.onclick = () => container.scrollBy({ left: -420, behavior: 'smooth' });
      }
      if (btnNext) {
        btnNext.onclick = () => container.scrollBy({ left: 420, behavior: 'smooth' });
      }
    }

    container.querySelectorAll('.currently-progress-card, .row-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.btn-home-plus-ep')) return;
        const id = card.getAttribute('data-id');
        const item = items.find(m => m.id === id);
        if (item && onCardClick) onCardClick(item);
      });
    });

    container.querySelectorAll('.btn-home-plus-ep').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        const item = items.find(m => m.id === id);
        if (item && onQuickPlusOne) onQuickPlusOne(item);
      });
    });
  },

  // 3. This Year in Review Analytics (Vanilla SVG charts)
  renderYearInReview(reviewData) {
    const container = document.getElementById('reviewChartsGrid');
    const badge = document.getElementById('reviewYearBadge');
    if (!container) return;

    if (badge) badge.textContent = `${reviewData.year} Review`;

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const maxMonth = Math.max(1, ...reviewData.monthlyCounts);

    // SVG Bar Chart: 12 vertical bars with rounded tops
    const barWidth = 20;
    const barGap = 10;
    const chartHeight = 105;
    const barsSVG = reviewData.monthlyCounts.map((val, idx) => {
      const h = Math.round((val / maxMonth) * (chartHeight - 20));
      const x = 16 + idx * (barWidth + barGap);
      const y = chartHeight - h;
      return `
        <g class="bar-group">
          <title>${months[idx]}: ${val} titles logged</title>
          <rect x="${x}" y="${y}" width="${barWidth}" height="${Math.max(3, h)}" rx="3" fill="url(#barGrad)"/>
          <text x="${x + barWidth / 2}" y="${chartHeight + 16}" font-size="9" fill="#94a3b8" text-anchor="middle" font-family="'Inter', sans-serif">${months[idx][0]}</text>
          ${val > 0 ? `<text x="${x + barWidth / 2}" y="${y - 4}" font-size="8" fill="#e2e8f0" text-anchor="middle" font-weight="600">${val}</text>` : ''}
        </g>
      `;
    }).join('');

    const barChartHTML = `
      <div class="chart-card">
        <h4 class="chart-card-title">
          <svg class="svg-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
          Monthly Log Volume
        </h4>
        <svg viewBox="0 0 380 135" width="100%" height="135" style="overflow:visible;">
          <defs>
            <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#a855f7"/>
              <stop offset="100%" stop-color="#6366f1"/>
            </linearGradient>
          </defs>
          <line x1="10" y1="${chartHeight}" x2="370" y2="${chartHeight}" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>
          ${barsSVG}
        </svg>
      </div>
    `;

    // Rating Distribution Histogram (5★ down to 1★)
    const maxRatingCount = Math.max(1, ...Object.values(reviewData.ratingDist));
    const ratingBarsHTML = [5, 4, 3, 2, 1].map(stars => {
      const count = reviewData.ratingDist[stars] || 0;
      const pct = Math.round((count / maxRatingCount) * 100);
      return `
        <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.45rem; font-size:0.75rem;">
          <span style="width:36px; color:#f59e0b; display:inline-flex; align-items:center; gap:2px; font-weight:600;">
            ${stars}★
          </span>
          <div style="flex:1; height:8px; background:rgba(255,255,255,0.08); border-radius:4px; overflow:hidden;">
            <div style="width:${pct}%; height:100%; background:linear-gradient(90deg, #f59e0b, #fbbf24); border-radius:4px;"></div>
          </div>
          <span style="width:20px; text-align:right; color:#cbd5e1; font-weight:600;">${count}</span>
        </div>
      `;
    }).join('');

    const ratingChartHTML = `
      <div class="chart-card">
        <h4 class="chart-card-title">
          <svg class="svg-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
          Rating Spread
        </h4>
        <div style="margin-top:0.35rem;">
          ${ratingBarsHTML}
        </div>
      </div>
    `;

    // Category Donut Chart (vanilla SVG)
    const cats = [
      { key: 'movie', label: 'Movies', color: '#8b5cf6', count: reviewData.categoryCounts.movie || 0 },
      { key: 'tv', label: 'Shows', color: '#3b82f6', count: reviewData.categoryCounts.tv || 0 },
      { key: 'anime', label: 'Anime', color: '#f43f5e', count: reviewData.categoryCounts.anime || 0 },
      { key: 'game', label: 'Games', color: '#10b981', count: reviewData.categoryCounts.game || 0 },
      { key: 'book', label: 'Books', color: '#f59e0b', count: reviewData.categoryCounts.book || 0 }
    ];

    const totalCats = Math.max(1, cats.reduce((acc, c) => acc + c.count, 0));
    const circumference = 2 * Math.PI * 38;
    let accumulatedOffset = 0;

    const donutSegments = cats.map(c => {
      const strokeDash = (c.count / totalCats) * circumference;
      const seg = `
        <circle cx="65" cy="65" r="38" fill="transparent"
                stroke="${c.color}" stroke-width="15"
                stroke-dasharray="${strokeDash} ${circumference}"
                stroke-dashoffset="${-accumulatedOffset}"
                transform="rotate(-90 65 65)">
          <title>${c.label}: ${c.count} titles</title>
        </circle>
      `;
      accumulatedOffset += strokeDash;
      return seg;
    }).join('');

    const donutLegend = cats.map(c => `
      <div style="display:flex; align-items:center; gap:0.35rem; font-size:0.7rem; color:#cbd5e1;">
        <span style="width:8px; height:8px; border-radius:50%; background:${c.color}; display:inline-block;"></span>
        <span>${c.label} (${c.count})</span>
      </div>
    `).join('');

    const donutChartHTML = `
      <div class="chart-card">
        <h4 class="chart-card-title">
          <svg class="svg-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
          Category Mix
        </h4>
        <div style="display:flex; align-items:center; justify-content:space-between; gap:1rem;">
          <svg viewBox="0 0 130 130" width="95" height="95">
            ${donutSegments}
            <text x="65" y="70" text-anchor="middle" fill="#fff" font-size="13" font-weight="800">${reviewData.totalInYear}</text>
          </svg>
          <div style="display:flex; flex-direction:column; gap:0.25rem;">
            ${donutLegend}
          </div>
        </div>
      </div>
    `;

    container.innerHTML = barChartHTML + ratingChartHTML + donutChartHTML;
  },

  // 4. Backlog Queue Component
  renderBacklogQueue(items = [], onPick, onClick) {
    const container = document.getElementById('backlogListContainer');
    const pickBtn = document.getElementById('btnPickBacklog');
    if (!container) return;

    if (!items || items.length === 0) {
      container.innerHTML = `
        <div style="padding:1.5rem; text-align:center; color:var(--text-dim); font-size:0.85rem; grid-column:1/-1;">
          Your backlog queue is empty! Mark titles as "Plan to Watch/Play" to queue them here.
        </div>
      `;
      if (pickBtn) pickBtn.style.display = 'none';
      return;
    }

    if (pickBtn) pickBtn.style.display = 'inline-flex';

    container.innerHTML = items.map(item => `
      <div class="backlog-card" data-id="${item.id}" title="${this.escapeHtml(item.title)}">
        <div style="position:relative; width:100%; aspect-ratio:2/3;">
          <span class="card-type-badge type-${item.type || 'movie'}" style="top:0.4rem; left:0.4rem; font-size:0.65rem; z-index:3;">
            ${(item.type || 'TITLE').toUpperCase()}
          </span>
          ${this.createPosterHTML(item, { aspectRatio: '2/3', imgClass: 'card-poster' })}
        </div>
        <div style="padding:0.6rem 0.75rem;">
          <h4 style="margin:0 0 0.2rem 0; font-size:0.88rem; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:#fff;">
            ${this.escapeHtml(item.title)}
          </h4>
          <div style="font-size:0.72rem; color:#94a3b8; display:flex; justify-content:space-between;">
            <span>${item.releaseYear || ''}</span>
            <span style="color:#f59e0b;">★ ${item.externalScore?.rating || '8.5'}</span>
          </div>
        </div>
      </div>
    `).join('');

    container.querySelectorAll('.backlog-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.getAttribute('data-id');
        const item = items.find(m => m.id === id);
        if (item && onClick) onClick(item);
      });
    });

    if (pickBtn && !pickBtn.dataset.bound) {
      pickBtn.dataset.bound = 'true';
      pickBtn.addEventListener('click', () => {
        if (onPick) onPick(items);
      });
    }
  },

  // 5. On This Day Component (Hidden if none)
  renderOnThisDay(items = [], onClick) {
    const section = document.getElementById('homeOnThisDaySection');
    const container = document.getElementById('onThisDayContainer');
    if (!section || !container) return;

    if (!items || items.length === 0) {
      section.style.display = 'none';
      return;
    }

    section.style.display = 'block';
    container.innerHTML = items.map(item => {
      const year = new Date(item.dateExperienced).getFullYear();
      const yearsAgo = new Date().getFullYear() - year;
      return `
        <div class="row-card" data-id="${item.id}" style="cursor:pointer;">
          <div style="position:relative; width:100%; aspect-ratio:2/3;">
            <span class="card-type-badge type-${item.type || 'movie'}" style="top:0.4rem; left:0.4rem; font-size:0.65rem; z-index:3;">
              ${yearsAgo}Y AGO (${year})
            </span>
            ${this.createPosterHTML(item, { aspectRatio: '2/3', imgClass: 'row-card-poster' })}
          </div>
          <div class="row-card-content">
            <h4 class="row-card-title">${this.escapeHtml(item.title)}</h4>
            <div class="row-card-sub">
              <span>Finished on this day in ${year}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.row-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.getAttribute('data-id');
        const item = items.find(m => m.id === id);
        if (item && onClick) onClick(item);
      });
    });
  },

  // 6. Activity Heatmap Component (16 weeks GitHub-style matrix)
  renderActivityHeatmap(columns = []) {
    const container = document.getElementById('heatmapGridContainer');
    if (!container) return;

    const colsHTML = columns.map(col => `
      <div class="heatmap-col">
        ${col.map(cell => `
          <div class="heat-cell heat-${cell.level}" title="${cell.date}: ${cell.count} media logged"></div>
        `).join('')}
      </div>
    `).join('');

    container.innerHTML = `<div class="heatmap-table">${colsHTML}</div>`;
  },

  // 7. Recently Watched Strip with Category Filter Tabs
  renderRecentlyWatchedStrip(items = [], activeCategory = 'all', onTabChange, onClick) {
    const track = document.getElementById('recentlyWatchedTrack');
    const countBadge = document.getElementById('recentCategoryCountBadge');
    const tabsContainer = document.getElementById('recentCategoryTabs');
    if (!track) return;

    let filtered = items;
    if (activeCategory !== 'all') {
      filtered = items.filter(m => {
        if (activeCategory === 'tv') return m.type === 'tv' || m.type === 'series';
        return m.type === activeCategory;
      });
    }

    if (countBadge) {
      countBadge.textContent = `${filtered.length} titles`;
    }

    if (filtered.length === 0) {
      track.innerHTML = `
        <div style="padding:1.5rem; color:var(--text-dim); font-size:0.85rem;">
          No recently experienced items in this category.
        </div>
      `;
    } else {
      track.innerHTML = filtered.map(item => this.createRowCardHTML(item)).join('');
      track.querySelectorAll('.row-card').forEach(card => {
        card.addEventListener('click', () => {
          const id = card.getAttribute('data-id');
          const item = items.find(m => m.id === id);
          if (item && onClick) onClick(item);
        });
      });
    }

    if (tabsContainer && !tabsContainer.dataset.bound) {
      tabsContainer.dataset.bound = 'true';
      tabsContainer.querySelectorAll('.recent-tab').forEach(tab => {
        tab.addEventListener('click', () => {
          tabsContainer.querySelectorAll('.recent-tab').forEach(t => {
            t.classList.remove('active');
            t.setAttribute('aria-selected', 'false');
          });
          tab.classList.add('active');
          tab.setAttribute('aria-selected', 'true');
          const cat = tab.getAttribute('data-cat');
          if (onTabChange) onTabChange(cat);
        });
      });
    }
  },

  // ===================================================================
  // Dedicated Pages: Media Grid or List
  // ===================================================================
  renderMediaGrid(items, isAdmin, onCardClick, onEdit, onDelete, viewMode = 'grid', currentView = 'movie') {
    const container = document.getElementById('mediaContainer');
    if (!container) return;

    if (!items || items.length === 0) {
      const sectionIcons = {
        movie: icons.film(44),
        tv: icons.tv(44),
        anime: icons.sparkles(44),
        game: icons.gamepad(44),
        book: icons.book(44)
      };
      const sectionLabels = {
        movie: 'Movies',
        tv: 'TV Series',
        anime: 'Anime',
        game: 'Games',
        book: 'Books'
      };
      const iconSvg = sectionIcons[currentView] || icons.film(44);
      const label = sectionLabels[currentView] || 'Media';

      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon" style="color:var(--accent-primary); opacity:0.6; display:flex; justify-content:center; margin-bottom:1rem;">
            ${iconSvg}
          </div>
          <h3 class="empty-title">No ${label} Logged Yet</h3>
          <p class="empty-desc">Your personal ${label.toLowerCase()} archive is ready. Use "+ Add Media" above or Search &amp; Add to log your first title.</p>
          ${isAdmin ? `<button id="btnEmptyAdd" class="btn-primary-add">+ Log First ${label}</button>` : ''}
        </div>
      `;
      if (isAdmin) {
        document.getElementById('btnEmptyAdd')?.addEventListener('click', () => {
          document.getElementById('btnAddMedia')?.click();
        });
      }
      return;
    }

    if (viewMode === 'list') {
      if (currentView === 'game') {
        container.className = 'game-table-container';
        this.renderGamingTableView(items, onCardClick, onEdit, onDelete, null, isAdmin);
        return;
      } else if (currentView === 'tv') {
        container.className = 'tv-table-container';
        this.renderTVTableView(items, onCardClick, onEdit, onDelete, null, null, isAdmin);
        return;
      } else {
        container.className = 'media-list-view';
        container.innerHTML = items.map(item => this.createListItemHTML(item, isAdmin)).join('');
      }
    } else if (currentView === 'movie') {
      container.className = 'film-roll-container';
      container.innerHTML = this.createFilmRollHTML(items, isAdmin);
      this.initFilmRollRollingInteractions();
    } else if (currentView === 'anime') {
      container.className = 'manga-spread-container';
      const total = items.length;
      const spreads = [];
      if (total <= 6) {
        spreads.push(items);
      } else {
        const pageCount = Math.ceil(total / 6);
        const perPage = Math.ceil(total / pageCount);
        for (let s = 0; s < pageCount; s++) {
          const slice = items.slice(s * perPage, (s + 1) * perPage);
          if (slice.length > 0) spreads.push(slice);
        }
      }
      container.innerHTML = spreads.map((chunk, s) =>
        this.createMangaPageSpreadHTML(chunk, s, spreads.length, isAdmin)
      ).join('');
    } else {
      container.className = currentView === 'book' ? 'media-grid bookshelf-shelf' : 'media-grid';
      container.innerHTML = items.map((item, idx) => {
        if (currentView === 'game') return this.createGamingHUDCardHTML(item, isAdmin, idx);
        if (currentView === 'tv') return this.createCRTTVCardHTML(item, isAdmin, idx);
        if (currentView === 'book') return this.createBookshelfCardHTML(item, isAdmin, idx);
        return this.createCardHTML(item, isAdmin);
      }).join('');
    }

    container.querySelectorAll('.media-card, .media-list-item, .film-frame-card, .film-frame-cell, .film-spiral-cell, .manga-panel-card, .manga-panel, .crt-tv-card, .standing-book-card').forEach(cardEl => {
      const id = cardEl.getAttribute('data-id');
      const item = items.find(m => m.id === id);

      cardEl.addEventListener('click', (e) => {
        if (e.target.closest('.card-action-btn') || e.target.closest('button')) return;
        if (item) onCardClick(item);
      });

      const editBtn = cardEl.querySelector('.card-btn-edit');
      if (editBtn) {
        editBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (item) onEdit(item);
        });
      }

      const delBtn = cardEl.querySelector('.card-btn-del');
      if (delBtn) {
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (item) onDelete(item);
        });
      }
    });
  },

  // Manga Spread Generators (Authentic Japanese Manga Page Template with Dynamic Panels & 0 Placeholders)
  createMangaPageSpreadHTML(chunk, spreadIndex, totalSpreads, isAdmin) {
    const pageNumStart = spreadIndex * 2 + 1;
    const pageNumEnd = spreadIndex * 2 + 2;
    const n = chunk.length;

    let layoutHTML = '';

    if (n === 1) {
      layoutHTML = `
        <div class="manga-page-layout manga-layout-1">
          ${this.createSingleMangaPanelHTML(chunk[0], 1, isAdmin, 'manga-panel-hero-splash')}
        </div>
      `;
    } else if (n === 2) {
      layoutHTML = `
        <div class="manga-page-layout manga-layout-2">
          ${this.createSingleMangaPanelHTML(chunk[0], 1, isAdmin, 'manga-panel-dual-top')}
          ${this.createSingleMangaPanelHTML(chunk[1], 2, isAdmin, 'manga-panel-dual-bottom')}
        </div>
      `;
    } else if (n === 3) {
      // 3-panel dynamic layout (Exact match for user's Image 1 request)
      layoutHTML = `
        <div class="manga-page-layout manga-layout-3">
          <div class="manga-col-left">
            ${this.createSingleMangaPanelHTML(chunk[0], 1, isAdmin, 'manga-panel-tri-1')}
            ${this.createSingleMangaPanelHTML(chunk[1], 2, isAdmin, 'manga-panel-tri-2')}
          </div>
          <div class="manga-col-right">
            ${this.createSingleMangaPanelHTML(chunk[2], 3, isAdmin, 'manga-panel-tri-hero')}
          </div>
        </div>
      `;
    } else if (n === 4) {
      // 4-panel balanced 2x2 dynamic manga spread
      layoutHTML = `
        <div class="manga-page-layout manga-layout-4">
          <div class="manga-col-left">
            ${this.createSingleMangaPanelHTML(chunk[0], 1, isAdmin, 'manga-panel-quad-1')}
            ${this.createSingleMangaPanelHTML(chunk[1], 2, isAdmin, 'manga-panel-quad-2')}
          </div>
          <div class="manga-col-right">
            ${this.createSingleMangaPanelHTML(chunk[2], 3, isAdmin, 'manga-panel-quad-3')}
            ${this.createSingleMangaPanelHTML(chunk[3], 4, isAdmin, 'manga-panel-quad-4')}
          </div>
        </div>
      `;
    } else if (n === 5) {
      // 5-panel dynamic spread (2 on left, 3 on right)
      layoutHTML = `
        <div class="manga-page-layout manga-layout-5">
          <div class="manga-col-left">
            ${this.createSingleMangaPanelHTML(chunk[0], 1, isAdmin, 'manga-panel-quint-1')}
            ${this.createSingleMangaPanelHTML(chunk[1], 2, isAdmin, 'manga-panel-quint-2')}
          </div>
          <div class="manga-col-right">
            ${this.createSingleMangaPanelHTML(chunk[2], 3, isAdmin, 'manga-panel-quint-3')}
            ${this.createSingleMangaPanelHTML(chunk[3], 4, isAdmin, 'manga-panel-quint-4')}
            ${this.createSingleMangaPanelHTML(chunk[4], 5, isAdmin, 'manga-panel-quint-5')}
          </div>
        </div>
      `;
    } else {
      // 6-panel authentic Shonen Jump layout
      layoutHTML = `
        <div class="manga-page-layout manga-layout-6">
          <div class="manga-col-left">
            ${this.createSingleMangaPanelHTML(chunk[0], 1, isAdmin)}
            ${this.createSingleMangaPanelHTML(chunk[2], 3, isAdmin)}
            ${this.createSingleMangaPanelHTML(chunk[4], 5, isAdmin)}
          </div>
          <div class="manga-col-right">
            ${this.createSingleMangaPanelHTML(chunk[1], 2, isAdmin)}
            ${this.createSingleMangaPanelHTML(chunk[3], 4, isAdmin)}
            ${this.createSingleMangaPanelHTML(chunk[5], 6, isAdmin)}
          </div>
        </div>
      `;
    }

    return `
      <div class="manga-page-spread" data-spread="${spreadIndex + 1}">
        <div class="manga-page-header">
          <span style="display:flex; align-items:center; gap:0.5rem;">
            <span style="color:#f43f5e;">✦</span>
            <span>MANGA ARCHIVE // VOLUME ${spreadIndex + 1}</span>
            <span style="color:var(--text-dim); font-size:0.9rem;">(SHONEN JUMP TEMPLATE)</span>
          </span>
          <span class="manga-page-number">PAGE ${String(pageNumStart).padStart(2, '0')} - ${String(pageNumEnd).padStart(2, '0')}</span>
        </div>

        ${layoutHTML}

        <div class="manga-page-footer">
          <span>MANGA UNIVERSITY CERTIFIED</span>
          <span style="color:#fda4af; letter-spacing:0.04em;">CLICK ANY PANEL FOR 3D PERSPECTIVE CUTOUT &amp; SPEECH BUBBLE</span>
          <span>${spreadIndex + 1 < totalSpreads ? 'CHAPTER CONTINUES ›' : '✦ FIN // EPISODE COMPLETE ✦'}</span>
        </div>
      </div>
    `;
  },

  createSingleMangaPanelHTML(item, panelNum, isAdmin, customClass = '') {
    if (!item) return '';

    const PANEL_SVG_POINTS = {
      1: '0,0 100,0 100,85.3 0,100',
      2: '0,0 100,0 100,80.4 0,100',
      3: '0,18.5 100,0 100,83.3 0,100',
      4: '0,15.3 100,0 100,100 0,100',
      5: '0,16.7 100,0 100,100 0,100',
      6: '0,0 100,0 100,100 0,100',
      'manga-panel-tri-1': '0,0 100,0 100,86.8 0,100',
      'manga-panel-tri-2': '0,13.2 100,0 100,100 0,100',
      'manga-panel-tri-hero': '0,0 100,0 100,100 0,100',
      'manga-panel-quad-1': '0,0 100,0 100,86.8 0,100',
      'manga-panel-quad-2': '0,13.2 100,0 100,100 0,100',
      'manga-panel-quad-3': '0,0 100,0 100,84.4 0,100',
      'manga-panel-quad-4': '0,15.6 100,0 100,100 0,100',
      'manga-panel-quint-1': '0,0 100,0 100,86.8 0,100',
      'manga-panel-quint-2': '0,13.2 100,0 100,100 0,100',
      'manga-panel-quint-3': '0,0 100,0 100,84.4 0,100',
      'manga-panel-quint-4': '0,15.6 100,0 100,85.9 0,100',
      'manga-panel-quint-5': '0,14.1 100,0 100,100 0,100',
      'manga-panel-dual-top': '0,0 100,0 100,86.8 0,100',
      'manga-panel-dual-bottom': '0,13.2 100,0 100,100 0,100',
      'manga-panel-hero-splash': '0,0 100,0 100,100 0,100'
    };

    const svgPoints = PANEL_SVG_POINTS[customClass] || PANEL_SVG_POINTS[panelNum] || '0,0 100,0 100,100 0,100';

    const hash = (item.title || 'Anime').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const hue1 = hash % 360;
    const hue2 = (hash + 50) % 360;
    const gradBg = `linear-gradient(135deg, hsl(${hue1}, 55%, 16%), hsl(${hue2}, 65%, 8%))`;
    const poster = item.posterUrl || '';
    const imgOrCover = poster 
      ? `<img class="manga-panel-img" src="${poster}" alt="${this.escapeHtml(item.title)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"><div class="manga-panel-img poster-generated-cover" style="display:none; background:${gradBg}; align-items:center; justify-content:center; flex-direction:column; padding:1rem; text-align:center;"><div style="font-family:'Bangers', cursive; font-size:1.1rem; color:#fff; text-shadow:1px 1px 2px #000;">${this.escapeHtml(item.title)}</div></div>`
      : `<div class="manga-panel-img poster-generated-cover" style="background:${gradBg}; display:flex; align-items:center; justify-content:center; flex-direction:column; padding:1rem; text-align:center;"><div style="font-family:'Bangers', cursive; font-size:1.1rem; color:#fff; text-shadow:1px 1px 2px #000;">${this.escapeHtml(item.title)}</div></div>`;

    const didCry = Boolean(item.emotionalImpact?.cried);
    const sfxList = ['DON!', 'DOKI!', 'BAAM!', 'GOGO!', 'SHING!', 'ZAZA!'];
    const sfx = sfxList[(panelNum - 1) % sfxList.length];
    const scoreVal = item.externalScore?.rating && item.externalScore.rating !== 'N/A' ? item.externalScore.rating : '8.8';
    const genre = Array.isArray(item.genres) && item.genres.length > 0 ? item.genres[0] : 'ANIME';

    const classes = ['manga-panel', `panel-${panelNum}`];
    if (customClass) classes.push(customClass);

    return `
      <div class="${classes.join(' ')}" data-id="${item.id}" data-title="${this.escapeHtml(item.title)}" title="${this.escapeHtml(item.title)}">
        <svg class="manga-frame-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
          <polygon points="${svgPoints}" fill="none" stroke="#ffffff" stroke-width="3.5" vector-effect="non-scaling-stroke"/>
        </svg>
        ${imgOrCover}
        <div class="manga-panel-overlay">
          <span class="manga-panel-sfx">${sfx}</span>
          <div style="position:relative; z-index:4;">
            <div style="display:flex; gap:0.4rem; align-items:center; margin-bottom:4px; flex-wrap:wrap;">
              <span class="manga-genre-tag" style="background:#000; border:1.5px solid #fff; color:#fff; font-family:'Bangers', cursive; font-size:0.8rem; padding:0.1rem 0.45rem;">${genre.toUpperCase()}</span>
              ${didCry ? `<span class="manga-panel-cried" style="font-family:'Bangers', cursive; display:inline-flex; align-items:center; gap:0.25rem;">${icons.drop(12)} TEARS</span>` : ''}
              ${isAdmin ? `
                <div class="card-admin-actions" style="margin-left:auto; display:inline-flex; gap:0.25rem;">
                  <button class="card-action-btn card-btn-edit" style="font-family:'Bangers', cursive; padding:0.1rem 0.4rem; font-size:0.75rem;">EDIT</button>
                  <button class="card-action-btn card-btn-del" style="font-family:'Bangers', cursive; padding:0.1rem 0.4rem; font-size:0.75rem;">DEL</button>
                </div>
              ` : ''}
            </div>
            <h3 class="manga-panel-title">${this.escapeHtml(item.title)}</h3>
            <div class="manga-panel-meta">
              <span class="manga-panel-score">MAL ★ ${scoreVal}</span>
              <span style="color:#fff; text-shadow:1px 1px 0px #000;">${item.releaseYear || ''}</span>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  // 1. THEME: PC Game HUD Card
  createGamingHUDCardHTML(item, isAdmin, idx) {
    const hours = item.gameDetails?.hoursPlayed || 0;
    const finished = item.gameDetails?.timesFinished || (item.status === 'Completed' ? 1 : 0);
    const didCry = Boolean(item.emotionalImpact?.cried);
    const scoreVal = item.externalScore?.rating && item.externalScore.rating !== 'N/A' ? item.externalScore.rating : '90+';
    
    // Meaningful LVL: derived from hours logged (floor(hours / 10), min 1)
    const lvl = Math.max(1, Math.floor(hours / 10));
    const xpPercent = Math.min(100, Math.round(((hours % 10) / 10) * 100));

    // Status styling: [PLAN] gray, [IN PROGRESS] amber, [COMPLETED] green, [DROPPED] red, [100%] gold
    const rawStatus = item.status || 'Completed';
    const is100 = rawStatus === 'Completed' && (item.gameDetails?.achievements?.unlocked >= item.gameDetails?.achievements?.total || finished > 1);
    let statusClass = 'chip-status-completed';
    let statusLabel = '[COMPLETED]';
    if (is100) {
      statusClass = 'chip-status-100';
      statusLabel = '[100% CLEARED]';
    } else if (rawStatus === 'In Progress') {
      statusClass = 'chip-status-inprogress';
      statusLabel = '[IN PROGRESS]';
    } else if (rawStatus.includes('Plan')) {
      statusClass = 'chip-status-plan';
      statusLabel = '[PLAN]';
    } else if (rawStatus === 'Dropped') {
      statusClass = 'chip-status-dropped';
      statusLabel = '[DROPPED]';
    }

    // Per-game fields: platform badge, difficulty, achievements
    const platform = item.gameDetails?.platform || item.platform || 'PC';
    const difficulty = item.gameDetails?.difficulty || 'Normal';
    const achievements = item.gameDetails?.achievements || null;
    const isNewGamePlus = finished > 1;

    return `
      <div class="media-card theme-game-card" data-id="${item.id}">
        <div class="card-poster-wrapper" style="border-bottom: 1px solid rgba(16,185,129,0.3); aspect-ratio: 3/4;">
          <span class="card-type-badge type-game" style="font-family:'Share Tech Mono', monospace;" title="LVL ${lvl}: derived from ${hours}h logged (1 LVL per 10 hours logged)">
            LVL.${lvl}
          </span>
          ${isNewGamePlus ? `<span class="game-newgameplus-badge" style="position:absolute; top:0.75rem; right:0.75rem; z-index:3;">NEW GAME+</span>` : ''}
          ${didCry && !isNewGamePlus ? `<span class="card-cry-badge" style="position:absolute; top:0.75rem; right:0.75rem; z-index:3; display:inline-flex; align-items:center; gap:0.25rem;">${icons.drop(12)} Cried</span>` : ''}
          ${this.createPosterHTML(item, { aspectRatio: '3/4', className: 'game-hud-poster-box', imgClass: 'card-poster' })}
          <span class="card-status-pill ${statusClass}" style="font-family:'Share Tech Mono', monospace; bottom:0.5rem; left:0.5rem; right:auto; z-index:3;">
            ${statusLabel}
          </span>
        </div>
        <div class="card-content">
          <div class="card-header-line">
            <h3 class="card-title" title="${this.escapeHtml(item.title)}">${this.escapeHtml(item.title)}</h3>
            <span class="card-year" style="font-family:'Share Tech Mono', monospace;">${item.releaseYear || ''}</span>
          </div>

          <div style="display:flex; gap:0.35rem; align-items:center; margin-top:0.15rem; font-family:'Share Tech Mono', monospace;">
            <span style="font-size:0.68rem; background:rgba(16,185,129,0.2); color:#6ee7b7; padding:0.1rem 0.35rem; border-radius:3px; border:1px solid rgba(16,185,129,0.4);">
              ${platform}
            </span>
            <span style="font-size:0.68rem; background:rgba(255,255,255,0.06); color:#cbd5e1; padding:0.1rem 0.35rem; border-radius:3px;">
              ${difficulty}
            </span>
          </div>

          <!-- XP Bar (Separate from metascore) -->
          <div class="game-lvl-xp-bar" title="Level XP Progress: ${xpPercent}% (${hours % 10}/10 hrs to LVL.${lvl + 1})">
            <div class="game-lvl-xp-fill" style="width: ${xpPercent}%;"></div>
          </div>

          <div style="font-family:'Share Tech Mono', monospace; font-size:0.75rem; color:#34d399; display:flex; justify-content:space-between; margin-top:0.25rem;">
            <span>METASCORE: ${scoreVal}</span>
            <span>CLEARS: ${finished}x</span>
          </div>

          ${achievements ? `
            <div style="font-family:'Share Tech Mono', monospace; font-size:0.7rem; color:#94a3b8; display:flex; justify-content:space-between; margin-top:0.25rem;">
              <span>ACHIEVEMENTS:</span>
              <span style="color:#fbbf24;">${achievements.unlocked}/${achievements.total} (${Math.round((achievements.unlocked / achievements.total) * 100)}%)</span>
            </div>
            <div style="width:100%; height:3px; background:rgba(255,255,255,0.08); border-radius:1px; overflow:hidden; margin-top:0.15rem;">
              <div style="width:${Math.round((achievements.unlocked / achievements.total) * 100)}%; height:100%; background:#f59e0b;"></div>
            </div>
          ` : ''}

          <div class="card-game-stats" style="font-family:'Share Tech Mono', monospace; justify-content:space-between; margin-top:0.35rem;">
            <span>${icons.clock(12)} ${hours} HRS LOGGED</span>
            <span style="color:#f59e0b;">★ ${item.metrics?.favorite || 5}.0</span>
          </div>

          ${item.review ? `
            <p class="card-review-snippet" style="font-family:'Share Tech Mono', monospace; font-size:0.76rem; -webkit-line-clamp:2;">// "${this.escapeHtml(item.review)}"</p>
          ` : ''}

          <div class="card-footer" style="font-family:'Share Tech Mono', monospace;">
            <span style="color:#10b981; font-size:0.72rem;">[QUEST: ${item.discoverySource || 'SOLO'}]</span>
            <div class="card-admin-actions">
              <button type="button" class="card-action-btn card-btn-fix" data-id="${item.id}" title="Fix Poster Art">ART</button>
              ${isAdmin ? `
                <button type="button" class="card-action-btn card-btn-edit">EDIT</button>
                <button type="button" class="card-action-btn card-btn-del">DEL</button>
              ` : `
                <span style="color:var(--text-dim); font-size:0.7rem;">HUD [E]</span>
              `}
            </div>
          </div>
        </div>
      </div>
    `;
  },

  // Gaming Stats HUD Updater
  renderGamingStatsHUD(hudStats, counts) {
    const elHours = document.getElementById('gameStatHours');
    const elClears = document.getElementById('gameStatClears');
    const elScore = document.getElementById('gameStatScore');
    const elPlat = document.getElementById('gameStatPlatform');
    const elLongest = document.getElementById('gameStatLongest');

    if (elHours) elHours.textContent = `${hudStats.totalHours} HRS`;
    if (elClears) elClears.textContent = `${hudStats.clears} RUNS`;
    if (elScore) elScore.textContent = `${hudStats.avgScore}/100`;
    if (elPlat) elPlat.textContent = hudStats.topPlatform;
    if (elLongest) elLongest.textContent = hudStats.longestGame;

    if (counts) {
      const cAll = document.getElementById('gameCountAll');
      const cProg = document.getElementById('gameCountInProgress');
      const cComp = document.getElementById('gameCountCompleted');
      const c100 = document.getElementById('gameCount100');
      const cPlan = document.getElementById('gameCountPlan');
      const cDrop = document.getElementById('gameCountDropped');
      if (cAll) cAll.textContent = counts.all || 0;
      if (cProg) cProg.textContent = counts.playing || counts.inProgress || 0;
      if (cComp) cComp.textContent = counts.completed || 0;
      if (c100) c100.textContent = counts.cleared100 || 0;
      if (cPlan) cPlan.textContent = counts.plan || 0;
      if (cDrop) cDrop.textContent = counts.dropped || 0;
    }
  },

  // Dense Gaming Table View
  renderGamingTableView(games = [], onCardClick, onEdit, onDelete, onFixPoster, isAdmin) {
    const container = document.getElementById('mediaContainer');
    if (!container) return;

    container.className = 'media-table-view';
    const rowsHTML = games.map(item => {
      const hours = item.gameDetails?.hoursPlayed || 0;
      const finished = item.gameDetails?.timesFinished || 0;
      const platform = item.gameDetails?.platform || item.platform || 'PC';
      const status = item.status || 'Completed';
      const score = item.externalScore?.rating || '90+';
      const lvl = Math.max(1, Math.floor(hours / 10));

      return `
        <tr class="game-table-row" data-id="${item.id}">
          <td style="width: 44px; padding: 0.4rem;">
            <div style="width: 36px; aspect-ratio: 3/4;">
              ${this.createPosterHTML(item, { aspectRatio: '3/4', imgClass: 'table-thumb' })}
            </div>
          </td>
          <td style="font-weight: 700; color: #fff; cursor: pointer;" class="cell-title">
            ${this.escapeHtml(item.title)}
            <span style="font-size:0.7rem; color: #94a3b8; margin-left: 0.35rem;">(${item.releaseYear || ''})</span>
          </td>
          <td><span style="color: #6ee7b7; background: rgba(16,185,129,0.15); padding: 0.15rem 0.4rem; border-radius: 3px;">${platform}</span></td>
          <td><span style="color: #38bdf8;">LVL.${lvl}</span> <span style="color: var(--text-dim); font-size:0.75rem;">(${hours}h)</span></td>
          <td><span style="color: #fbbf24;">★ ${item.metrics?.favorite || 5}.0</span></td>
          <td><span style="color: #34d399;">${score}</span></td>
          <td><span class="card-status-pill status-${status.toLowerCase().replace(/\s+/g, '')}">[${status.toUpperCase()}]</span></td>
          <td style="text-align: right;">
            <button type="button" class="card-action-btn card-btn-fix" data-id="${item.id}" title="Fix Poster">Cover</button>
            ${isAdmin ? `
              <button type="button" class="card-action-btn card-btn-edit" data-id="${item.id}">Edit</button>
              <button type="button" class="card-action-btn card-btn-del" data-id="${item.id}">Del</button>
            ` : `
              <button type="button" class="card-action-btn cell-inspect" data-id="${item.id}">View</button>
            `}
          </td>
        </tr>
      `;
    }).join('');

    container.innerHTML = `
      <div class="dense-game-table-wrap">
        <table class="dense-game-table">
          <thead>
            <tr>
              <th>Art</th>
              <th>Title</th>
              <th>Platform</th>
              <th>Hours / LVL</th>
              <th>Rating</th>
              <th>Metascore</th>
              <th>Status</th>
              <th style="text-align:right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHTML}
          </tbody>
        </table>
      </div>
    `;

    container.querySelectorAll('.game-table-row .cell-title, .game-table-row .cell-inspect').forEach(el => {
      el.addEventListener('click', () => {
        const tr = el.closest('tr');
        const id = tr.getAttribute('data-id');
        const item = games.find(m => m.id === id);
        if (item && onCardClick) onCardClick(item);
      });
    });

    container.querySelectorAll('.card-btn-fix').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        const item = games.find(m => m.id === id);
        if (item && onFixPoster) onFixPoster(item);
      });
    });

    if (isAdmin) {
      container.querySelectorAll('.card-btn-edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = btn.getAttribute('data-id');
          const item = games.find(m => m.id === id);
          if (item && onEdit) onEdit(item);
        });
      });
      container.querySelectorAll('.card-btn-del').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = btn.getAttribute('data-id');
          const item = games.find(m => m.id === id);
          if (item && onDelete) onDelete(item);
        });
      });
    }
  },

  // 2. THEME: 35mm 3D Helical Spiral Film Roll Experience (Matching User Sketch)
  createFilmRollHTML(items, isAdmin) {
    if (!items || items.length === 0) {
      return `
        <div class="empty-state">
          <div class="empty-icon">${icons.film(48)}</div>
          <h3 class="empty-title">No 35mm Film Reels Loaded</h3>
          <p class="empty-desc">No movie titles match your active filter or search. Select another genre or sort option.</p>
        </div>
      `;
    }

    // Generate helical cells across the 3D spiral (17 positions: -8 to +8)
    const TOTAL_CELLS = 17;
    const halfCount = Math.floor(TOTAL_CELLS / 2);
    const cellsHTML = [];

    for (let i = -halfCount; i <= halfCount; i++) {
      const itemIndex = ((i % items.length) + items.length) % items.length;
      const item = items[itemIndex];
      cellsHTML.push(this.createFilmSpiralCellHTML(item, i, itemIndex, items.length, isAdmin));
    }

    const firstItem = items[0];
    const firstScore = firstItem.externalScore?.rating && firstItem.externalScore.rating !== 'N/A' ? firstItem.externalScore.rating : '8.5';
    const firstFav = '★'.repeat(firstItem.metrics?.favorite || 5);

    return `
      <div class="film-spiral-experience" id="filmSpiralExperience">
        <!-- Top Cinema Transport Console -->
        <div class="film-transport-console">
          <div class="film-transport-left">
            <span class="film-recording-light">●</span>
            <span class="film-stock-indicator">35MM CELLULOID HELIX ● KODAK 5063 SAFETY FILM ● 24 FPS SOUND</span>
          </div>

          <div class="film-transport-controls">
            <button type="button" class="film-transport-btn" id="btnFilmRewind" title="Rewind 1 Frame (Step Backward)">
              <svg class="svg-icon" width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="11 19 2 12 11 5 11 19"/><polygon points="22 19 13 12 22 5 22 19"/></svg>
              <span>REWIND</span>
            </button>
            <button type="button" class="film-transport-btn btn-film-play" id="btnFilmPlay" title="Auto-Roll 3D Spiral">
              <svg class="svg-icon play-icon" width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              <span class="play-label">AUTO ROLL</span>
            </button>
            <button type="button" class="film-transport-btn" id="btnFilmFF" title="Advance 1 Frame (Step Forward)">
              <span>ADVANCE</span>
              <svg class="svg-icon" width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="13 19 22 12 13 5 13 19"/><polygon points="2 19 11 12 2 5 2 19"/></svg>
            </button>
            <button type="button" class="film-transport-btn" id="btnFilmReset" title="Center Current Frame">
              <span>CENTER ⊙</span>
            </button>
          </div>

          <div class="film-transport-right">
            <span>REEL LOAD: <strong id="filmFrameCount">${items.length} TITLES IN 3D HELIX</strong></span>
          </div>
        </div>

        <!-- 3D Film Spiral Stage Viewport -->
        <div class="film-spiral-stage-3d" id="filmSpiralStage" title="Drag horizontally or scroll wheel to roll the 3D film spiral">
          <!-- Flow Direction Reference Annotations (Matching User Sketch) -->
          <div class="film-spiral-backdrop-hints">
            <div class="spiral-hint-top">
              <span>TOP LOOP: WINDING BACKWARDS INTO DISTANCE</span>
              <span>──────▶</span>
            </div>
            <div class="spiral-hint-bottom">
              <span>◀────── BOTTOM LOOP: WINDING FORWARD</span>
              <span>● FOREGROUND ACTIVE STRIP</span>
            </div>
          </div>

          <!-- Central 3D Coordinate Rig -->
          <div class="film-spiral-rig" id="filmSpiralRig">
            ${cellsHTML.join('')}
          </div>
        </div>

        <!-- Active Movie Spotlight Bar (Directly below 3D Spiral) -->
        <div class="film-spotlight-bar" id="filmSpotlightBar">
          <div class="spotlight-left">
            <div id="spotlightPosterContainer" class="spotlight-thumb-container">
              ${this.createPosterHTML(firstItem, { className: 'spotlight-thumb-wrap', imgClass: 'spotlight-thumb', aspectRatio: '2/3' })}
            </div>
            <div class="spotlight-details">
              <h3 id="spotlightTitle" class="spotlight-title">${this.escapeHtml(firstItem.title)}</h3>
              <div class="spotlight-meta">
                <span id="spotlightYear">${firstItem.releaseYear || ''}</span>
                <span>·</span>
                <span id="spotlightScore" class="film-cell-rating">★ IMDb ${firstScore}</span>
                <span>·</span>
                <span id="spotlightFav" style="color:#f59e0b;">${firstFav}</span>
                <span id="spotlightCry">${firstItem.emotionalImpact?.cried ? `<span style="color:#38bdf8; display:inline-flex; align-items:center; gap:0.2rem;">${icons.drop(12)} Cried</span>` : ''}</span>
              </div>
            </div>
          </div>

          <div class="spotlight-right">
            <button type="button" class="btn-spotlight-open" id="btnSpotlightOpen" data-id="${firstItem.id}">
              <svg class="svg-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>
              <span>VIEW SCREENING ARCHIVE</span>
            </button>
          </div>
        </div>

        <!-- Film Scrubber & Controls Footer -->
        <div class="film-roll-footer">
          <div class="film-scrubber-wrapper">
            <span class="scrubber-label">SCRUB 3D SPIRAL:</span>
            <input type="range" class="film-scrubber-slider" id="filmScrubber" min="0" max="1000" value="500" aria-label="Scrub film spiral position">
          </div>
          <div class="film-roll-hint">
            <svg class="svg-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 14 14"/></svg>
            <span>DRAG OR MOUSE WHEEL TO ROLL FILM SPIRAL ● CLICK ANY FRAME TO INSPECT</span>
          </div>
        </div>
      </div>
    `;
  },

  createFilmSpiralCellHTML(item, cellIdx, itemIdx, totalItems, isAdmin) {
    const didCry = Boolean(item.emotionalImpact?.cried);
    const frameNumber = String(itemIdx + 1).padStart(2, '0');
    const scoreVal = item.externalScore?.rating && item.externalScore.rating !== 'N/A' ? item.externalScore.rating : '8.5';
    const timeSec = String(itemIdx * 4 + 12).padStart(2, '0');

    return `
      <div class="film-spiral-cell" data-cell-idx="${cellIdx}" data-item-idx="${itemIdx}" data-id="${item.id}" title="${this.escapeHtml(item.title)}">
        <!-- FRONT FACE: High contrast, glossy 35mm film cell -->
        <div class="film-cell-front">
          <div class="film-cell-sprockets top">
            <div class="sprocket-perfs-track">
              <span class="sprocket-perf"></span>
              <span class="sprocket-perf"></span>
              <span class="sprocket-perf"></span>
              <span class="sprocket-perf"></span>
              <span class="sprocket-perf"></span>
              <span class="sprocket-perf"></span>
              <span class="sprocket-perf"></span>
            </div>
            <span class="sprocket-edge-text">KODAK 5063 SAFETY FILM ● ${frameNumber}A</span>
            <div class="sprocket-perfs-track">
              <span class="sprocket-perf"></span>
              <span class="sprocket-perf"></span>
              <span class="sprocket-perf"></span>
              <span class="sprocket-perf"></span>
              <span class="sprocket-perf"></span>
              <span class="sprocket-perf"></span>
              <span class="sprocket-perf"></span>
            </div>
          </div>

          <div class="film-cell-poster-wrap">
            ${this.createPosterHTML(item, { className: 'film-cell-poster-wrap-inner', imgClass: 'film-cell-poster-img', aspectRatio: '16/9' })}
            <div class="film-cell-glare"></div>
            <span class="film-cell-stamp">FRAME #${frameNumber}</span>
            ${didCry ? `<span class="film-cell-cry-badge">${icons.drop(11)} Cried</span>` : ''}

            <div class="film-cell-scrim">
              <h4 class="film-cell-title">${this.escapeHtml(item.title)}</h4>
              <div class="film-cell-sub">
                <span>${item.releaseYear || ''}</span>
                <span class="film-cell-rating">★ ${scoreVal}</span>
              </div>
            </div>
          </div>

          <div class="film-cell-sprockets bottom">
            <div class="sprocket-perfs-track">
              <span class="sprocket-perf"></span>
              <span class="sprocket-perf"></span>
              <span class="sprocket-perf"></span>
              <span class="sprocket-perf"></span>
              <span class="sprocket-perf"></span>
              <span class="sprocket-perf"></span>
              <span class="sprocket-perf"></span>
            </div>
            <span class="sprocket-edge-text">01:${timeSec}:24:18 ● 24 FPS SOUND</span>
            <div class="sprocket-perfs-track">
              <span class="sprocket-perf"></span>
              <span class="sprocket-perf"></span>
              <span class="sprocket-perf"></span>
              <span class="sprocket-perf"></span>
              <span class="sprocket-perf"></span>
              <span class="sprocket-perf"></span>
              <span class="sprocket-perf"></span>
            </div>
          </div>
        </div>

        <!-- BACK FACE: Translucent dark celluloid acetate visible when in background loop -->
        <div class="film-cell-back">
          <div class="film-cell-sprockets top">
            <div class="sprocket-perfs-track">
              <span class="sprocket-perf"></span>
              <span class="sprocket-perf"></span>
              <span class="sprocket-perf"></span>
              <span class="sprocket-perf"></span>
              <span class="sprocket-perf"></span>
              <span class="sprocket-perf"></span>
              <span class="sprocket-perf"></span>
            </div>
            <span class="sprocket-edge-text">SAFETY FILM ●</span>
            <div class="sprocket-perfs-track">
              <span class="sprocket-perf"></span>
              <span class="sprocket-perf"></span>
              <span class="sprocket-perf"></span>
              <span class="sprocket-perf"></span>
              <span class="sprocket-perf"></span>
              <span class="sprocket-perf"></span>
              <span class="sprocket-perf"></span>
            </div>
          </div>

          <div class="film-cell-back-inner">
            <span class="film-cell-back-title">35MM REEL</span>
            <span style="font-family:'Share Tech Mono', monospace; font-size:0.55rem; color:#64748b; letter-spacing:0.1em;">EXP ${frameNumber}</span>
          </div>

          <div class="film-cell-sprockets bottom">
            <div class="sprocket-perfs-track">
              <span class="sprocket-perf"></span>
              <span class="sprocket-perf"></span>
              <span class="sprocket-perf"></span>
              <span class="sprocket-perf"></span>
              <span class="sprocket-perf"></span>
              <span class="sprocket-perf"></span>
              <span class="sprocket-perf"></span>
            </div>
            <span class="sprocket-edge-text">EASTMAN ●</span>
            <div class="sprocket-perfs-track">
              <span class="sprocket-perf"></span>
              <span class="sprocket-perf"></span>
              <span class="sprocket-perf"></span>
              <span class="sprocket-perf"></span>
              <span class="sprocket-perf"></span>
              <span class="sprocket-perf"></span>
              <span class="sprocket-perf"></span>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  initFilmRollRollingInteractions() {
    const stage = document.getElementById('filmSpiralStage');
    const rig = document.getElementById('filmSpiralRig');
    const cells = Array.from(document.querySelectorAll('.film-spiral-cell'));
    const scrubber = document.getElementById('filmScrubber');
    const btnRewind = document.getElementById('btnFilmRewind');
    const btnPlay = document.getElementById('btnFilmPlay');
    const btnFF = document.getElementById('btnFilmFF');
    const btnReset = document.getElementById('btnFilmReset');
    const btnSpotlightOpen = document.getElementById('btnSpotlightOpen');

    if (!stage || !rig || cells.length === 0) return;

    if (this._filmSpiralRafId) {
      cancelAnimationFrame(this._filmSpiralRafId);
      this._filmSpiralRafId = null;
    }

    // Geometry Configuration matching user's Image 2 stock photo & Image 3 sketch
    const isMobile = window.innerWidth <= 860;
    const Rx = isMobile ? 310.0 : 450.0;
    const Rz = isMobile ? 220.0 : 330.0;
    const pitch = isMobile ? 52.0 : 68.0;
    const du = isMobile ? 0.62 : 0.58;

    let currentAngle = 0.0;
    let targetAngle = 0.0;
    let isAutoRolling = false;
    let isDragging = false;
    let dragStartX = 0;
    let angleAtDragStart = 0;
    let lastActiveIdx = -1;

    // Cache cell data
    const cellData = cells.map(cell => ({
      el: cell,
      cellIdx: parseInt(cell.getAttribute('data-cell-idx'), 10),
      itemIdx: parseInt(cell.getAttribute('data-item-idx'), 10),
      id: cell.getAttribute('data-id')
    }));

    // Update Spotlight Bar details
    const updateSpotlight = (item) => {
      if (!item) return;
      const titleEl = document.getElementById('spotlightTitle');
      const posterContainer = document.getElementById('spotlightPosterContainer');
      const yearEl = document.getElementById('spotlightYear');
      const scoreEl = document.getElementById('spotlightScore');
      const favEl = document.getElementById('spotlightFav');
      const cryEl = document.getElementById('spotlightCry');
      if (titleEl) titleEl.textContent = item.title;
      if (posterContainer) {
        posterContainer.innerHTML = this.createPosterHTML(item, { className: 'spotlight-thumb-wrap', imgClass: 'spotlight-thumb', aspectRatio: '2/3' });
      }
      if (yearEl) yearEl.textContent = item.releaseYear || '';
      if (scoreEl) scoreEl.textContent = `★ IMDb ${item.externalScore?.rating || '8.5'}`;
      if (favEl) favEl.textContent = '★'.repeat(item.metrics?.favorite || 5);
      if (cryEl) {
        cryEl.innerHTML = item.emotionalImpact?.cried
          ? `<span style="color:#38bdf8; display:inline-flex; align-items:center; gap:0.2rem;">${icons.drop(12)} Cried</span>`
          : '';
      }
      if (btnSpotlightOpen) {
        btnSpotlightOpen.setAttribute('data-id', item.id);
      }
    };

    // Render loop: spring-lerp positioning of all cells along 3D helix
    const renderSpiral = () => {
      currentAngle += (targetAngle - currentAngle) * 0.12;

      let closestDist = Infinity;
      let closestCell = null;

      for (let i = 0; i < cellData.length; i++) {
        const item = cellData[i];
        const u = (item.cellIdx * du) - currentAngle;

        // Parametric coordinates of the 3D helix matching the sketch
        const bx = Rx * Math.sin(u);
        const by = -pitch * u - 10.0 * Math.sin(u);
        const bz = Rz * (Math.cos(u) - 1.0);

        // 3D rotations tangent to spiral
        const rotY = -u * (180.0 / Math.PI);
        const rotX = 14.0 + 8.0 * Math.cos(u);
        const rotZ = -5.0 * Math.sin(u);

        // Depth sorting and optical depth-of-field
        const zIndex = Math.round(1000 + bz);
        const scale = Math.max(0.48, 1.0 + bz / 720.0);
        const opacity = Math.max(0.32, 1.0 + bz / 520.0);
        const blur = Math.max(0, -bz * 0.0075);
        const isForeground = Math.abs(u) < 0.70 && bz > -140.0;

        item.el.style.transform = `translate3d(${bx.toFixed(1)}px, ${by.toFixed(1)}px, ${bz.toFixed(1)}px) rotateY(${rotY.toFixed(1)}deg) rotateX(${rotX.toFixed(1)}deg) rotateZ(${rotZ.toFixed(1)}deg) scale(${scale.toFixed(3)})`;
        item.el.style.zIndex = zIndex;
        item.el.style.opacity = opacity.toFixed(2);
        item.el.style.filter = `blur(${blur.toFixed(1)}px)`;
        item.el.classList.toggle('is-foreground', isForeground);

        const centerDist = Math.abs(u);
        if (centerDist < closestDist) {
          closestDist = centerDist;
          closestCell = item;
        }
      }

      // Update spotlight if center title changed
      if (closestCell && closestCell.itemIdx !== lastActiveIdx) {
        lastActiveIdx = closestCell.itemIdx;
        const cardEl = closestCell.el;
        const id = cardEl.getAttribute('data-id');
        const title = cardEl.getAttribute('title');
        const score = cardEl.querySelector('.film-cell-rating')?.textContent || '';
        const year = cardEl.querySelector('.film-cell-sub span')?.textContent || '';
        const poster = cardEl.querySelector('img')?.src || '';
        updateSpotlight({
          id,
          title,
          posterUrl: poster,
          releaseYear: year,
          externalScore: { rating: score.replace('★', '').trim() },
          metrics: { favorite: 5 }
        });
      }

      // Sync Scrubber slider
      if (scrubber && !isDragging) {
        const scrubVal = 500 + (targetAngle / (du * cellData.length)) * 500;
        scrubber.value = Math.min(1000, Math.max(0, scrubVal));
      }

      // Continue Auto-Roll if enabled
      if (isAutoRolling) {
        targetAngle += 0.006;
      }

      this._filmSpiralRafId = requestAnimationFrame(renderSpiral);
    };

    // Kick off animation loop
    this._filmSpiralRafId = requestAnimationFrame(renderSpiral);

    // Mouse Drag on Stage
    stage.addEventListener('mousedown', (e) => {
      if (e.target.closest('button')) return;
      isDragging = true;
      dragStartX = e.clientX;
      angleAtDragStart = targetAngle;
      stage.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStartX;
      targetAngle = angleAtDragStart - dx * 0.0035;
    });

    window.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        if (stage) stage.style.cursor = 'grab';
      }
    });

    // Touch Support for mobile
    let touchStartX = 0;
    stage.addEventListener('touchstart', (e) => {
      if (e.touches.length > 0) {
        isDragging = true;
        touchStartX = e.touches[0].clientX;
        angleAtDragStart = targetAngle;
      }
    }, { passive: true });

    stage.addEventListener('touchmove', (e) => {
      if (!isDragging || e.touches.length === 0) return;
      const dx = e.touches[0].clientX - touchStartX;
      targetAngle = angleAtDragStart - dx * 0.004;
    }, { passive: true });

    stage.addEventListener('touchend', () => {
      isDragging = false;
    });

    // Mouse Wheel
    stage.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      targetAngle += delta * 0.0015;
    }, { passive: false });

    // Step Buttons
    if (btnRewind) {
      btnRewind.addEventListener('click', () => {
        targetAngle -= du;
      });
    }

    if (btnFF) {
      btnFF.addEventListener('click', () => {
        targetAngle += du;
      });
    }

    if (btnReset) {
      btnReset.addEventListener('click', () => {
        const nearestFrame = Math.round(targetAngle / du);
        targetAngle = nearestFrame * du;
      });
    }

    // Scrubber Slider
    if (scrubber) {
      scrubber.addEventListener('input', () => {
        const norm = (Number(scrubber.value) - 500) / 500;
        targetAngle = norm * (du * cellData.length);
      });
    }

    // Auto Roll Button
    if (btnPlay) {
      btnPlay.addEventListener('click', () => {
        isAutoRolling = !isAutoRolling;
        btnPlay.classList.toggle('active', isAutoRolling);
        const playIcon = btnPlay.querySelector('.play-icon');
        const playLabel = btnPlay.querySelector('.play-label');
        if (isAutoRolling) {
          if (playLabel) playLabel.textContent = 'PAUSE';
          if (playIcon) playIcon.innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
        } else {
          if (playLabel) playLabel.textContent = 'AUTO ROLL';
          if (playIcon) playIcon.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"/>';
        }
      });
    }

    // Spotlight Action Button
    if (btnSpotlightOpen) {
      btnSpotlightOpen.addEventListener('click', () => {
        const id = btnSpotlightOpen.getAttribute('data-id');
        const targetCell = cells.find(c => c.getAttribute('data-id') === id);
        if (targetCell) targetCell.click();
      });
    }

    // Clicking any cell on the spiral:
    cells.forEach(cell => {
      cell.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        const cellIdx = parseInt(cell.getAttribute('data-cell-idx'), 10);
        const u = (cellIdx * du) - currentAngle;
        if (Math.abs(u) > 0.3) {
          targetAngle += u;
        }
      });
    });
  },

  // 2. THEME: 35mm Celluloid Film Frame Card
  createFilmFrameCardHTML(item, isAdmin, idx) {
    const didCry = Boolean(item.emotionalImpact?.cried);
    const favStars = '★'.repeat(item.metrics?.favorite || 5);
    const frameNumber = String(idx + 1).padStart(2, '0');

    return `
      <div class="film-frame-card" data-id="${item.id}">
        <!-- Top Sprockets -->
        <div class="film-sprockets-top">
          <div class="sprocket-hole"></div><div class="sprocket-hole"></div><div class="sprocket-hole"></div>
          <div class="sprocket-hole"></div><div class="sprocket-hole"></div><div class="sprocket-hole"></div>
          <div class="sprocket-hole"></div><div class="sprocket-hole"></div>
        </div>

        <div class="card-poster-wrapper" style="border: 1px solid #1a1a24; border-radius: 2px;">
          <span class="card-type-badge type-movie" style="font-family:'Cinzel', serif;">35MM FILM</span>
          ${didCry ? `<span class="card-cry-badge">${icons.drop(12)} Cried</span>` : ''}
          ${this.createPosterHTML(item, { aspectRatio: '2/3', imgClass: 'card-poster' })}
          <span class="card-status-pill status-${(item.status || 'Completed').toLowerCase().replace(/\s+/g, '')}">${item.status || 'Completed'}</span>
        </div>

        <div class="card-content" style="padding:0.85rem 0.25rem 0.25rem 0.25rem;">
          <div class="card-header-line">
            <h3 class="card-title" style="font-family:'Cinzel', serif;" title="${this.escapeHtml(item.title)}">${this.escapeHtml(item.title)}</h3>
            <span class="card-year">${item.releaseYear || ''}</span>
          </div>

          <div class="card-scores-row">
            <span class="card-stars">${favStars}</span>
            <span class="card-external-score">${item.externalScore?.source || 'IMDb'}: ${item.externalScore?.rating || '8.5'}</span>
          </div>

          ${item.review ? `
            <p class="card-review-snippet">"${this.escapeHtml(item.review)}"</p>
          ` : ''}

          <div class="card-footer">
            <span class="film-meta-stamp">KODAK · 24 FPS · FRAME #${frameNumber}</span>
            ${isAdmin ? `
              <div class="card-admin-actions">
                <button class="card-action-btn card-btn-edit">Edit</button>
                <button class="card-action-btn card-btn-del">Delete</button>
              </div>
            ` : ''}
          </div>
        </div>

        <!-- Bottom Sprockets -->
        <div class="film-sprockets-bottom">
          <div class="sprocket-hole"></div><div class="sprocket-hole"></div><div class="sprocket-hole"></div>
          <div class="sprocket-hole"></div><div class="sprocket-hole"></div><div class="sprocket-hole"></div>
          <div class="sprocket-hole"></div><div class="sprocket-hole"></div>
        </div>
      </div>
    `;
  },

  // 3. THEME: Manga Comic Panel Card
  createMangaPanelCardHTML(item, isAdmin, idx) {
    const didCry = Boolean(item.emotionalImpact?.cried);
    const sfxList = ['DON!', 'DOKI!', 'BAAM!', 'GOGO!', 'ZAZA!', 'SHING!'];
    const sfx = sfxList[idx % sfxList.length];

    return `
      <div class="manga-panel-card" data-id="${item.id}">
        <span class="manga-sfx-stamp">${sfx}</span>
        <div class="card-poster-wrapper" style="border-bottom: 3.5px solid #fff;">
          <span class="card-type-badge type-anime" style="font-family:'Bangers', cursive; font-size:0.85rem; letter-spacing:0.06em;">MANGA CUT</span>
          ${didCry ? `<span class="card-cry-badge" style="background:#000; border:2px solid #fff; font-family:'Bangers', cursive; display:inline-flex; align-items:center; gap:0.25rem;">${icons.drop(12)} TEARS</span>` : ''}
          ${this.createPosterHTML(item, { aspectRatio: '2/3', imgClass: 'card-poster' })}
          <span class="card-status-pill status-${(item.status || 'Completed').toLowerCase().replace(/\s+/g, '')}" style="font-family:'Bangers', cursive; font-size:0.82rem;">${item.status || 'Completed'}</span>
        </div>
        <div class="card-content">
          <div class="card-header-line">
            <h3 class="card-title">${this.escapeHtml(item.title)}</h3>
            <span class="card-year" style="font-family:'Bangers', cursive; font-size:0.95rem;">${item.releaseYear || ''}</span>
          </div>

          <div class="card-scores-row" style="font-family:'Bangers', cursive; font-size:0.95rem;">
            <span style="color:#f59e0b;">★ ${item.metrics?.favorite || 5} / 5</span>
            <span class="card-external-score" style="border:2px solid #fff; background:#000; color:#fff;">MAL: ${item.externalScore?.rating || '8.8'}</span>
          </div>

          ${item.review ? `
            <div style="background:#1e2433; border:2px solid #fff; padding:0.5rem; border-radius:4px; margin-bottom:0.75rem;">
              <p class="card-review-snippet" style="font-family:'Bangers', cursive; font-size:0.95rem; margin:0; color:#fff;">"${this.escapeHtml(item.review)}"</p>
            </div>
          ` : ''}

          <div class="card-footer" style="font-family:'Bangers', cursive; font-size:0.9rem;">
            <span style="color:#fda4af;">PANEL #${idx + 1}</span>
            ${isAdmin ? `
              <div class="card-admin-actions">
                <button class="card-action-btn card-btn-edit">EDIT</button>
                <button class="card-action-btn card-btn-del">DEL</button>
              </div>
            ` : `
              <span style="color:#fff;">READ MORE ›</span>
            `}
          </div>
        </div>
      </div>
    `;
  },

  // 4. THEME: Retro CRT Broadcast TV Card
  createCRTTVCardHTML(item, isAdmin, idx) {
    const didCry = Boolean(item.emotionalImpact?.cried);
    const channelNum = String(idx + 1).padStart(2, '0');
    const isNowPlaying = (item.status === 'In Progress');
    const tv = item.tvDetails || {};
    const network = tv.network || 'BROADCAST';
    const totalEps = tv.totalEpisodes || 10;
    const watchedEps = Number(tv.watchedEpisodes) || (item.status === 'Completed' ? totalEps : 6);
    const nextEp = tv.currentEpisode || `S01E0${Math.min(totalEps, watchedEps + 1)}`;
    const progressPercent = Math.min(100, Math.round((watchedEps / totalEps) * 100));

    // Per-season rating mini trend line SVG
    let trendSVG = '';
    if (tv.seasons && tv.seasons.length > 1) {
      const pts = tv.seasons.map((s, i) => {
        const x = 10 + (i / (tv.seasons.length - 1)) * 60;
        const normR = Math.max(7, Math.min(10, Number(s.rating) || 8.5));
        const y = 20 - ((normR - 7) / 3) * 16;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(' ');
      trendSVG = `
        <svg viewBox="0 0 80 24" width="80" height="24" style="vertical-align:middle;" title="Season rating trend">
          <polyline points="${pts}" fill="none" stroke="#60a5fa" stroke-width="2"/>
          ${tv.seasons.map((s, i) => {
            const x = 10 + (i / (tv.seasons.length - 1)) * 60;
            const normR = Math.max(7, Math.min(10, Number(s.rating) || 8.5));
            const y = 20 - ((normR - 7) / 3) * 16;
            return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.5" fill="#93c5fd"/>`;
          }).join('')}
        </svg>
      `;
    }

    return `
      <div class="crt-tv-card" data-id="${item.id}">
        ${isNowPlaying ? `
          <div class="tv-now-playing-banner">
            <span>● NOW PLAYING ON AIR</span>
            <span>LIVE FEED</span>
          </div>
        ` : ''}
        <span class="vhs-timecode-badge">PLAY ▶ CH-${channelNum}</span>
        <div class="card-poster-wrapper">
          <span class="card-type-badge type-tv" style="font-family:'VT323', monospace; font-size:0.95rem; z-index:3;">${network}</span>
          ${didCry ? `<span class="card-cry-badge" style="z-index:3;">${icons.drop(12)} Cried</span>` : ''}
          ${this.createPosterHTML(item, { className: 'crt-tv-poster-box', imgClass: 'card-poster', aspectRatio: '2/3' })}
          <span class="card-status-pill status-${(item.status || 'Completed').toLowerCase().replace(/\s+/g, '')}" style="font-family:'VT323', monospace; font-size:0.95rem; z-index:3;">
            ${(item.status || 'AIRING').toUpperCase()}
          </span>
        </div>
        <div class="card-content">
          <div class="card-header-line">
            <h3 class="card-title" title="${this.escapeHtml(item.title)}">${this.escapeHtml(item.title)}</h3>
            <span class="card-year" style="font-family:'VT323', monospace; font-size:1.05rem;">(${item.releaseYear || ''})</span>
          </div>

          <!-- Episode tracker info & quick +1 button -->
          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:0.35rem; font-family:'VT323', monospace; font-size:1.05rem;">
            <span style="color:#93c5fd;">PROGRESS: ${watchedEps}/${totalEps} EPS</span>
            <button type="button" class="tv-next-up-btn btn-plus-one-ep" data-id="${item.id}" title="Quickly mark next episode watched">
              <span>+1 EP</span>
            </button>
          </div>
          <div style="width:100%; height:4px; background:rgba(255,255,255,0.08); border-radius:2px; overflow:hidden; margin-top:0.25rem;">
            <div style="width:${progressPercent}%; height:100%; background:linear-gradient(90deg, #3b82f6, #60a5fa);"></div>
          </div>

          <div class="card-scores-row" style="font-family:'VT323', monospace; font-size:1.05rem; margin-top:0.4rem; justify-content:space-between;">
            <span style="color:#f59e0b;">★ ${item.metrics?.favorite || 5}.0</span>
            <span class="card-external-score" style="color:#93c5fd;">IMDb: ${item.externalScore?.rating || '9.0'}</span>
            <span style="color:#cbd5e1; font-size:0.95rem;">NEXT: ${nextEp}</span>
          </div>

          ${trendSVG ? `
            <div style="display:flex; align-items:center; justify-content:space-between; margin-top:0.25rem; font-family:'VT323', monospace; font-size:0.95rem; color:#94a3b8;">
              <span>SEASON RATINGS:</span>
              ${trendSVG}
            </div>
          ` : ''}

          ${item.review ? `
            <p class="card-review-snippet" style="font-family:'VT323', monospace; font-size:0.95rem; -webkit-line-clamp:2;">"${this.escapeHtml(item.review)}"</p>
          ` : ''}

          <div class="card-footer" style="font-family:'VT323', monospace; font-size:0.95rem;">
            <span style="color:#60a5fa;">AUDIO: STEREO</span>
            <div class="card-admin-actions">
              <button type="button" class="card-action-btn card-btn-fix" data-id="${item.id}" title="Fix Poster Art">Art</button>
              ${isAdmin ? `
                <button type="button" class="card-action-btn card-btn-edit">Edit</button>
                <button type="button" class="card-action-btn card-btn-del">Delete</button>
              ` : `
                <button type="button" class="btn-episodes-guide" data-id="${item.id}" style="background:none; border:none; color:#34d399; font-family:'VT323', monospace; font-size:1rem; cursor:pointer;">
                  [SEASONS // GUIDE]
                </button>
              `}
            </div>
          </div>
        </div>
      </div>
    `;
  },

  // TV Stats HUD Updater
  renderTVStatsHUD(hudStats, counts) {
    const elEpisodes = document.getElementById('tvStatEpisodes');
    const elHours = document.getElementById('tvStatHours');
    const elCompleted = document.getElementById('tvStatCompleted');
    const elRating = document.getElementById('tvStatRating');

    if (elEpisodes) elEpisodes.textContent = hudStats.totalEpisodes;
    if (elHours) elHours.textContent = `${hudStats.totalHours}h`;
    if (elCompleted) elCompleted.textContent = hudStats.completedCount;
    if (elRating) elRating.textContent = hudStats.avgRating;

    if (counts) {
      const cAll = document.getElementById('tvCountAll');
      const cWatch = document.getElementById('tvCountWatching');
      const cComp = document.getElementById('tvCountCompleted');
      const cPlan = document.getElementById('tvCountPlan');
      const cDrop = document.getElementById('tvCountDropped');
      if (cAll) cAll.textContent = counts.all || 0;
      if (cWatch) cWatch.textContent = counts.watching || counts.inProgress || 0;
      if (cComp) cComp.textContent = counts.completed || 0;
      if (cPlan) cPlan.textContent = counts.plan || 0;
      if (cDrop) cDrop.textContent = counts.dropped || 0;
    }
  },

  // Dense TV Table View
  renderTVTableView(shows = [], onCardClick, onEdit, onDelete, onFixPoster, onPlusOne, isAdmin) {
    const container = document.getElementById('mediaContainer');
    if (!container) return;

    container.className = 'media-table-view';
    const rowsHTML = shows.map(item => {
      const tv = item.tvDetails || {};
      const network = tv.network || 'BROADCAST';
      const totalEps = tv.totalEpisodes || 10;
      const watched = Number(tv.watchedEpisodes) || (item.status === 'Completed' ? totalEps : 6);
      const nextEp = tv.currentEpisode || `S01E0${Math.min(totalEps, watched + 1)}`;
      const status = item.status || 'Completed';

      return `
        <tr class="tv-table-row" data-id="${item.id}">
          <td style="width: 44px; padding: 0.4rem;">
            <div style="width: 36px; aspect-ratio: 2/3;">
              ${this.createPosterHTML(item, { aspectRatio: '2/3', imgClass: 'table-thumb' })}
            </div>
          </td>
          <td style="font-weight: 700; color: #fff; cursor: pointer;" class="cell-title">
            ${this.escapeHtml(item.title)}
            <span style="font-size:0.7rem; color: #94a3b8; margin-left: 0.35rem;">(${item.releaseYear || ''})</span>
          </td>
          <td><span style="color: #93c5fd; background: rgba(59,130,246,0.15); padding: 0.15rem 0.4rem; border-radius: 3px;">${network}</span></td>
          <td><span style="color: #60a5fa;">${watched}/${totalEps} Eps</span></td>
          <td><span style="color: #cbd5e1;">${nextEp}</span></td>
          <td><span style="color: #fbbf24;">★ ${item.metrics?.favorite || 5}.0</span></td>
          <td><span class="card-status-pill status-${status.toLowerCase().replace(/\s+/g, '')}">[${status.toUpperCase()}]</span></td>
          <td style="text-align: right;">
            <button type="button" class="tv-next-up-btn btn-table-plus-ep" data-id="${item.id}" title="Add 1 episode">+1 Ep</button>
            <button type="button" class="card-action-btn card-btn-fix" data-id="${item.id}" title="Fix Poster">Cover</button>
            ${isAdmin ? `
              <button type="button" class="card-action-btn card-btn-edit" data-id="${item.id}">Edit</button>
              <button type="button" class="card-action-btn card-btn-del" data-id="${item.id}">Del</button>
            ` : `
              <button type="button" class="card-action-btn cell-inspect" data-id="${item.id}">View</button>
            `}
          </td>
        </tr>
      `;
    }).join('');

    container.innerHTML = `
      <div class="dense-game-table-wrap">
        <table class="dense-game-table" style="font-family:'VT323', monospace; font-size:1.05rem;">
          <thead>
            <tr>
              <th>Art</th>
              <th>Channel / Title</th>
              <th>Network</th>
              <th>Episodes Watched</th>
              <th>Next Up</th>
              <th>Rating</th>
              <th>Status</th>
              <th style="text-align:right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHTML}
          </tbody>
        </table>
      </div>
    `;

    container.querySelectorAll('.tv-table-row .cell-title, .tv-table-row .cell-inspect').forEach(el => {
      el.addEventListener('click', () => {
        const tr = el.closest('tr');
        const id = tr.getAttribute('data-id');
        const item = shows.find(m => m.id === id);
        if (item && onCardClick) onCardClick(item);
      });
    });

    container.querySelectorAll('.btn-table-plus-ep').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        const item = shows.find(m => m.id === id);
        if (item && onPlusOne) onPlusOne(item);
      });
    });

    container.querySelectorAll('.card-btn-fix').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        const item = shows.find(m => m.id === id);
        if (item && onFixPoster) onFixPoster(item);
      });
    });

    if (isAdmin) {
      container.querySelectorAll('.card-btn-edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = btn.getAttribute('data-id');
          const item = shows.find(m => m.id === id);
          if (item && onEdit) onEdit(item);
        });
      });
      container.querySelectorAll('.card-btn-del').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = btn.getAttribute('data-id');
          const item = shows.find(m => m.id === id);
          if (item && onDelete) onDelete(item);
        });
      });
    }
  },

  // TV Episode Tracker Modal Accordion
  renderTVEpisodeAccordion(item, onToggleEpisode) {
    const titleEl = document.getElementById('tvModalTitle');
    const metaBar = document.getElementById('tvModalMetaBar');
    const container = document.getElementById('tvSeasonsAccordion');
    if (!container) return;

    if (titleEl) titleEl.textContent = `${item.title} — Episode Tracker`;

    const tv = item.tvDetails || {};
    const network = tv.network || 'BROADCAST';
    const totalEps = tv.totalEpisodes || 10;
    const watchedEps = Number(tv.watchedEpisodes) || 6;
    const pct = Math.min(100, Math.round((watchedEps / totalEps) * 100));

    if (metaBar) {
      metaBar.innerHTML = `
        <div style="font-size:0.85rem; color:#cbd5e1;">
          <strong style="color:#fff;">${network}</strong> · ${watchedEps} of ${totalEps} episodes watched (${pct}%)
        </div>
        <div style="width:160px; height:6px; background:rgba(255,255,255,0.1); border-radius:3px; overflow:hidden;">
          <div style="width:${pct}%; height:100%; background:linear-gradient(90deg, #3b82f6, #60a5fa);"></div>
        </div>
      `;
    }

    const seasons = tv.seasons && tv.seasons.length > 0 ? tv.seasons : [
      { seasonNumber: 1, title: 'Season 1', episodesCount: totalEps, watchedCount: watchedEps, rating: 9.0 }
    ];

    container.innerHTML = seasons.map((season, sIdx) => {
      const epCount = season.episodesCount || 10;
      const sWatched = Math.min(epCount, Number(season.watchedCount) || (sIdx === 0 ? watchedEps : 0));
      const sPct = Math.min(100, Math.round((sWatched / epCount) * 100));

      const epButtons = [];
      for (let ep = 1; ep <= epCount; ep++) {
        const isWatched = ep <= sWatched;
        epButtons.push(`
          <button type="button" class="tv-ep-btn ${isWatched ? 'is-watched' : ''}" 
                  data-season="${season.seasonNumber}" data-ep="${ep}" 
                  title="Season ${season.seasonNumber} Episode ${ep} (${isWatched ? 'Watched' : 'Unwatched'})">
            E${ep}
          </button>
        `);
      }

      return `
        <div class="tv-season-row" data-season-idx="${sIdx}">
          <div class="tv-season-header">
            <div>
              <strong style="color:#fff; font-size:0.95rem;">${season.title || `Season ${season.seasonNumber}`}</strong>
              <span style="font-size:0.75rem; color:#94a3b8; margin-left:0.5rem;">${sWatched}/${epCount} Watched</span>
            </div>
            <div style="display:flex; align-items:center; gap:0.75rem;">
              <span style="color:#f59e0b; font-size:0.78rem;">★ ${season.rating || '9.0'}</span>
              <span style="font-size:0.75rem; color:#60a5fa;">${sPct}%</span>
            </div>
          </div>
          <div class="tv-episode-grid">
            ${epButtons.join('')}
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.tv-ep-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const seasonNum = parseInt(btn.getAttribute('data-season'), 10);
        const epNum = parseInt(btn.getAttribute('data-ep'), 10);
        if (onToggleEpisode) onToggleEpisode(seasonNum, epNum);
      });
    });
  },

  // 5. THEME: 3D Bookshelf Standing Book Card
  createBookshelfCardHTML(item, isAdmin, idx) {
    const author = item.bookDetails?.author || item.author || 'Author';
    const pages = item.bookDetails?.pages || item.pages || 0;

    return `
      <div class="standing-book-card" data-id="${item.id}">
        <div class="book-ribbon-tag" title="Bookmarked"></div>
        ${this.createPosterHTML(item, { aspectRatio: '2/3', imgClass: 'book-cover-3d' })}
        <div style="padding:0.75rem 0.25rem 0 0.25rem; font-family:'Crimson Pro', Georgia, serif;">
          <h4 style="font-family:'Cinzel', serif; font-size:0.95rem; font-weight:700; color:#fff; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
            ${this.escapeHtml(item.title)}
          </h4>
          <div style="font-size:0.85rem; font-style:italic; color:#fbbf24; margin-top:2px;">
            by ${this.escapeHtml(author)}
          </div>
          <div style="font-size:0.78rem; color:var(--text-dim); display:flex; justify-content:space-between; margin-top:4px;">
            <span>${pages ? `${pages} pages` : 'Classic'}</span>
            <span style="color:#f59e0b;">★ ${item.metrics?.favorite || 5}</span>
          </div>
          ${isAdmin ? `
            <div class="card-admin-actions" style="margin-top:0.5rem; justify-content:flex-end;">
              <button class="card-action-btn card-btn-edit">Edit</button>
              <button class="card-action-btn card-btn-del">Delete</button>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  },

  createCardHTML(item, isAdmin) {
    const typeLabel = item.type === 'game' ? 'Game' : item.type === 'anime' ? 'Anime' : item.type === 'tv' ? 'Series' : item.type === 'book' ? 'Book' : 'Movie';
    const typeClass = `type-${item.type === 'series' ? 'tv' : item.type}`;
    const statusClass = (item.status || 'Completed').toLowerCase().replace(/\s+/g, '');
    const didCry = Boolean(item.emotionalImpact?.cried);

    const favStars = '★'.repeat(item.metrics?.favorite || 5) + '☆'.repeat(5 - (item.metrics?.favorite || 5));

    let specificStatsHTML = '';
    if (item.type === 'game') {
      const hours = item.gameDetails?.hoursPlayed || 0;
      const finished = item.gameDetails?.timesFinished || 0;
      specificStatsHTML = `
        <div class="card-game-stats">
          <span style="display:inline-flex; align-items:center; gap:0.25rem;">
            ${icons.clock(12)} ${hours} hrs
          </span>
          <span>•</span>
          <span style="display:inline-flex; align-items:center; gap:0.25rem;">
            ${icons.trophy(12)} ${finished}x finished
          </span>
        </div>
      `;
    } else if (item.type === 'book') {
      const author = item.bookDetails?.author || item.author || '';
      const pages = item.bookDetails?.pages || item.pages || 0;
      specificStatsHTML = `
        <div style="font-size:0.78rem; color:var(--accent-amber); margin-bottom:0.6rem; display:flex; justify-content:space-between; align-items:center;">
          <span style="display:inline-flex; align-items:center; gap:0.25rem;">
            ${icons.user(12)} ${this.escapeHtml(author)}
          </span>
          ${pages ? `<span style="display:inline-flex; align-items:center; gap:0.25rem;">${icons.book(12)} ${pages}p</span>` : ''}
        </div>
      `;
    }

    const yap = item.metrics?.yapFactor || 3;
    const retention = item.metrics?.retention || 3;

    return `
      <div class="media-card" data-id="${item.id}">
        <div class="card-poster-wrapper">
          <span class="card-type-badge ${typeClass}">${typeLabel}</span>
          ${didCry ? `<span class="card-cry-badge" style="display:inline-flex; align-items:center; gap:0.25rem;">${icons.drop(12)} Cried</span>` : ''}
          ${this.createPosterHTML(item, { aspectRatio: '2/3', imgClass: 'card-poster' })}
          <span class="card-status-pill status-${statusClass}">${item.status || 'Completed'}</span>
        </div>
        <div class="card-content">
          <div class="card-header-line">
            <h3 class="card-title" title="${this.escapeHtml(item.title)}">${this.escapeHtml(item.title)}</h3>
            <span class="card-year">${item.releaseYear || ''}</span>
          </div>

          <div class="card-scores-row">
            <span class="card-stars" title="Favorite: ${item.metrics?.favorite || 5}/5">${favStars}</span>
            ${item.externalScore?.rating && item.externalScore.rating !== 'N/A' ? `
              <span class="card-external-score">${item.externalScore.source}: ${item.externalScore.rating}</span>
            ` : ''}
          </div>

          ${specificStatsHTML}

          <div class="card-metrics-grid">
            <div class="card-metric-item">
              <span class="metric-label-micro">Yap Factor</span>
              <span class="metric-val-micro" style="display:inline-flex; align-items:center; gap:0.25rem;">
                ${icons.messageSquare(12)} ${yap}/5
              </span>
            </div>
            <div class="card-metric-item">
              <span class="metric-label-micro">Retention</span>
              <span class="metric-val-micro" style="display:inline-flex; align-items:center; gap:0.25rem;">
                ${icons.brain(12)} ${retention}/5
              </span>
            </div>
          </div>

          ${item.review ? `
            <p class="card-review-snippet">"${this.escapeHtml(item.review)}"</p>
          ` : ''}

          <div class="card-footer">
            <span class="card-discovery">${item.discoverySource ? this.escapeHtml(item.discoverySource) : 'Logged'}</span>
            ${isAdmin ? `
              <div class="card-admin-actions">
                <button class="card-action-btn card-btn-edit" title="Edit entry">Edit</button>
                <button class="card-action-btn card-btn-del" title="Delete entry">Delete</button>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  },

  createListItemHTML(item, isAdmin) {
    const favStars = '★'.repeat(item.metrics?.favorite || 5);
    const didCry = Boolean(item.emotionalImpact?.cried);

    return `
      <div class="media-list-item" data-id="${item.id}">
        <div style="width:48px; height:48px; flex-shrink:0;">
          ${this.createPosterHTML(item, { aspectRatio: '1/1', imgClass: 'list-thumb' })}
        </div>
        <div class="list-info-main">
          <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
            <span class="list-title">${this.escapeHtml(item.title)}</span>
            <span class="card-year">(${item.releaseYear || ''})</span>
            ${didCry ? `<span style="display:inline-flex; align-items:center; gap:0.2rem; font-size:0.75rem; color:#38bdf8;">${icons.drop(12)} Cried</span>` : ''}
          </div>
          <div class="list-meta">
            <span style="color:#f59e0b;">${favStars}</span>
            <span>•</span>
            <span style="text-transform:uppercase;">${item.type}</span>
            <span>•</span>
            <span>Status: ${item.status || 'Completed'}</span>
            <span>•</span>
            <span>Yap: ${item.metrics?.yapFactor || 3}/5</span>
            ${item.type === 'game' ? `<span>• ${icons.clock(12)} ${item.gameDetails?.hoursPlayed || 0} hrs</span>` : ''}
            ${item.type === 'book' ? `<span>• ${icons.book(12)} ${item.bookDetails?.pages || item.pages || 0}p</span>` : ''}
          </div>
        </div>
        ${isAdmin ? `
          <div class="card-admin-actions">
            <button class="card-action-btn card-btn-edit">Edit</button>
            <button class="card-action-btn card-btn-del">Delete</button>
          </div>
        ` : ''}
      </div>
    `;
  },

  // ===================================================================
  // External Search Results
  // ===================================================================
  renderSearchResults(results, isAdmin, onAddClick) {
    const container = document.getElementById('searchResultsContainer');
    if (!container) return;

    if (!results || results.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-icon" style="color:var(--text-dim); display:flex; justify-content:center; margin-bottom:1rem;">
            ${icons.search(44)}
          </div>
          <h3 class="empty-title">No Search Results Found</h3>
          <p class="empty-desc">Try another keyword or click "+ Add Custom Media Manually".</p>
        </div>
      `;
      return;
    }

    container.innerHTML = results.map(item => {
      const year = item.releaseYear ? `(${item.releaseYear})` : '';
      const score = item.externalScore?.rating && item.externalScore.rating !== 'N/A' 
        ? `${item.externalScore.source}: ${item.externalScore.rating}`
        : '';
      const sourceChip = item.discoverySource 
        ? `<div class="search-card-source-chip">${this.escapeHtml(item.discoverySource.replace('Review link (', '').replace(')', ''))}</div>`
        : '';

      return `
        <div class="search-result-card" data-title="${this.escapeHtml(item.title)}">
          ${this.createPosterHTML(item, { aspectRatio: '2/3', imgClass: 'search-card-poster' })}
          <div class="search-card-body">
            ${sourceChip}
            <h4 class="search-card-title">${this.escapeHtml(item.title)}</h4>
            <div class="search-card-meta">
              <span>${year}</span>
              ${score ? `<span class="card-external-score">${score}</span>` : ''}
            </div>
            ${item.author ? `<div style="font-size:0.78rem; color:var(--accent-amber); margin-bottom:0.5rem; display:flex; align-items:center; gap:0.25rem;">${icons.user(12)} ${this.escapeHtml(item.author)}</div>` : ''}
            <div class="search-card-actions">
              ${isAdmin ? `
                <button class="btn-add-search-item" data-id="${item.id}">+ ADD TO LOG</button>
              ` : `
                <button class="btn-disabled-login" title="Login as Admin to add to log" style="display:flex; align-items:center; justify-content:center; gap:0.35rem;">
                  ${icons.lock(13)} Admin to Add
                </button>
              `}
            </div>
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.btn-add-search-item').forEach((btn, idx) => {
      btn.addEventListener('click', () => {
        const item = results[idx];
        if (item) onAddClick(item);
      });
    });

    container.querySelectorAll('.btn-disabled-login').forEach(btn => {
      btn.addEventListener('click', () => {
        document.getElementById('btnAdminLogin')?.click();
      });
    });
  },

  // ===================================================================
  // Modals (Log Modal, Detail Modal, Admin Modal)
  // ===================================================================
  openLogModal(item = null) {
    const modal = document.getElementById('logModal');
    if (!modal) return;

    // Reset URL auto-fill inputs
    const inputUrl = document.getElementById('inputAutoFillUrl');
    if (inputUrl) inputUrl.value = item?.sourceUrl || '';
    const statusMsg = document.getElementById('extractStatusMsg');
    if (statusMsg) {
      statusMsg.style.display = 'none';
      statusMsg.textContent = '';
    }

    const isEdit = Boolean(item && item.createdAt);
    document.getElementById('logModalTitle').textContent = isEdit ? 'Edit Media Entry' : 'Log New Media';

    document.getElementById('mediaId').value = isEdit ? (item?.id || '') : '';
    document.getElementById('mediaTitle').value = item?.title || '';
    document.getElementById('mediaType').value = item?.type || 'movie';
    document.getElementById('mediaYear').value = item?.releaseYear || new Date().getFullYear();
    document.getElementById('mediaPosterUrl').value = item?.posterUrl || '';
    document.getElementById('mediaExternalSource').value = item?.externalScore?.source || (item?.type === 'book' ? 'Goodreads' : 'IMDb');
    document.getElementById('mediaExternalScore').value = item?.externalScore?.rating || '';

    const status = item?.status || 'Completed';
    document.querySelectorAll('.status-opt-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-val') === status);
    });

    document.getElementById('mediaDiscoverySource').value = item?.discoverySource || 'Self-discovery';
    document.getElementById('mediaRecommendedBy').value = item?.recommendedBy || '';

    const socialTags = Array.isArray(item?.socialContext) ? item.socialContext : ['Solo'];
    document.querySelectorAll('.social-tag-btn').forEach(btn => {
      btn.classList.toggle('active', socialTags.includes(btn.getAttribute('data-val')));
    });

    const dateInput = document.getElementById('mediaDateExperienced');
    if (dateInput) {
      dateInput.value = item?.dateExperienced || new Date().toISOString().slice(0, 10);
    }

    const favLevel = item?.metrics?.favorite ?? 5;
    this.updateStarRating(favLevel);

    const enjoymentVal = item?.metrics?.enjoyment ?? 5;
    this.setSliderVal('sliderEnjoyment', enjoymentVal, 'valEnjoyment', this.getEnjoymentLabel(enjoymentVal));

    const retentionVal = item?.metrics?.retention ?? 4;
    this.setSliderVal('sliderRetention', retentionVal, 'valRetention', this.getRetentionLabel(retentionVal));

    const yapVal = item?.metrics?.yapFactor ?? 4;
    this.setSliderVal('sliderYap', yapVal, 'valYap', this.getYapLabel(yapVal));

    const cryToggle = document.getElementById('toggleCried');
    if (cryToggle) cryToggle.checked = Boolean(item?.emotionalImpact?.cried);

    const currentType = item?.type || 'movie';
    const gameSection = document.getElementById('gameFieldsSection');
    const bookSection = document.getElementById('bookFieldsSection');

    if (gameSection) gameSection.style.display = currentType === 'game' ? 'flex' : 'none';
    if (bookSection) bookSection.style.display = currentType === 'book' ? 'flex' : 'none';

    document.getElementById('gameHoursPlayed').value = item?.gameDetails?.hoursPlayed ?? 0;
    document.getElementById('gameTimesFinished').value = item?.gameDetails?.timesFinished ?? (currentType === 'game' && status === 'Completed' ? 1 : 0);

    document.getElementById('bookAuthor').value = item?.bookDetails?.author || item?.author || '';
    document.getElementById('bookPages').value = item?.bookDetails?.pages || item?.pages || 0;
    document.getElementById('bookFormat').value = item?.bookDetails?.format || 'Paperback';

    document.getElementById('mediaReview').value = item?.review || item?.synopsis || '';

    modal.classList.add('active');
  },

  closeLogModal() {
    document.getElementById('logModal')?.classList.remove('active');
  },

  openDetailModal(item, isAdmin, onEdit, onDelete, onFixPoster) {
    const modal = document.getElementById('detailModal');
    if (!modal || !item) return;

    const didCry = Boolean(item.emotionalImpact?.cried);
    const favStars = '★'.repeat(item.metrics?.favorite || 5) + '☆'.repeat(5 - (item.metrics?.favorite || 5));
    const socialTags = Array.isArray(item.socialContext) ? item.socialContext.join(', ') : (item.socialContext || 'Solo');
    const modalBox = modal.querySelector('.modal-box');

    // -------------------------------------------------------------
    // BESPOKE MODAL THEME 1: ANIME MANGA CUTOUT & SPEECH BUBBLE
    // -------------------------------------------------------------
    if (item.type === 'anime') {
      if (modalBox) modalBox.style.maxWidth = '840px';
      modal.querySelector('.modal-title').innerHTML = `
        <span style="font-family:'Bangers', cursive; font-size:1.4rem; letter-spacing:0.06em; color:#f43f5e;">
          MANGA PANEL ARCHIVE // ${this.escapeHtml(item.title)}
        </span>
      `;
      modal.querySelector('.modal-body').innerHTML = `
        <div class="manga-modal-layout">
          <div>
            <div class="manga-cutout-frame">
              ${this.createPosterHTML(item, { aspectRatio: '2/3' })}
            </div>
            <div style="font-family:'Bangers', cursive; font-size:1.2rem; text-align:center; margin-top:1rem; color:#f43f5e; letter-spacing:0.05em;">
              ${favStars} (FAVORITE ${item.metrics?.favorite || 5}/5)
            </div>
            <div style="display:flex; justify-content:center; gap:0.4rem; margin-top:0.5rem; flex-wrap:wrap;">
              ${(item.genres || []).map(g => `<span style="font-family:'Bangers', cursive; font-size:0.85rem; background:#111; color:#fda4af; border:1px solid #f43f5e; padding:0.15rem 0.5rem; border-radius:3px;">${g}</span>`).join('')}
            </div>
          </div>

          <div class="manga-speech-bubble">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:0.5rem;">
              <h2 style="font-family:'Bangers', cursive; font-size:1.85rem; letter-spacing:0.04em; margin-bottom:0.25rem; color:#000; line-height:1.2;">
                ${this.escapeHtml(item.title)} (${item.releaseYear || ''})
              </h2>
              <span style="font-family:'Bangers', cursive; background:#f43f5e; color:#fff; padding:0.2rem 0.6rem; border:2px solid #000; font-size:0.9rem; box-shadow:2px 2px 0px #000; white-space:nowrap;">
                MAL ★ ${item.externalScore?.rating || '8.8'}
              </span>
            </div>

            <div style="font-family:'Bangers', cursive; font-size:0.95rem; color:#e11d48; margin-bottom:0.75rem; letter-spacing:0.04em; display:flex; align-items:center; flex-wrap:wrap; gap:0.35rem;">
              STATUS: ${(item.status || 'COMPLETED').toUpperCase()} ${didCry ? ` · <span style="display:inline-flex; align-items:center; gap:0.2rem;">${icons.drop(13)} TEARS WERE SHED</span>` : ''} · SOCIAL: ${socialTags.toUpperCase()}
            </div>

            <p class="manga-dialogue-text">
              "${this.escapeHtml(item.review || 'No dialogue or personal review notes logged for this anime episode yet.')}"
            </p>

            <div class="manga-metric-pill-row">
              <div class="manga-metric-chip">
                <span>YAP FACTOR:</span>
                <span style="color:#e11d48; font-size:1.05rem;">${item.metrics?.yapFactor || 4}/5</span>
              </div>
              <div class="manga-metric-chip">
                <span>RETENTION:</span>
                <span style="color:#2563eb; font-size:1.05rem;">${item.metrics?.retention || 4}/5</span>
              </div>
              <div class="manga-metric-chip">
                <span>DISCOVERY:</span>
                <span style="color:#059669;">${item.discoverySource || 'Self'}</span>
              </div>
              <div class="manga-metric-chip">
                <span>EXPERIENCED:</span>
                <span style="color:#7c3aed;">${item.dateExperienced || 'Recent'}</span>
              </div>
            </div>
          </div>
        </div>
      `;
      this.attachDetailModalActions(modal, item, isAdmin, onEdit, onDelete, onFixPoster);
      modal.classList.add('active');
      return;
    }

    // -------------------------------------------------------------
    // BESPOKE MODAL THEME 2: 3D ANIMATED UNFOLDING BOOK
    // -------------------------------------------------------------
    if (item.type === 'book') {
      if (modalBox) modalBox.style.maxWidth = '840px';
      modal.querySelector('.modal-title').innerHTML = `
        <span style="font-family:'Cinzel', serif; font-size:1.15rem; color:#fbbf24;">
          LITERARY FOLIO // ${this.escapeHtml(item.title)}
        </span>
      `;
      const author = item.bookDetails?.author || item.author || 'Author Unknown';
      const pages = item.bookDetails?.pages || item.pages || 0;
      const format = item.bookDetails?.format || 'Paperback';

      modal.querySelector('.modal-body').innerHTML = `
        <div class="book-unfold-modal">
          <div class="book-spine-crease"></div>

          <!-- Left Page: Cover & Title Page -->
          <div class="book-left-page">
            <div style="width:160px; box-shadow: -4px 6px 15px rgba(0,0,0,0.4); border-left:4px solid #3d2010; border-radius:3px 6px 6px 3px; overflow:hidden;">
              ${this.createPosterHTML(item, { aspectRatio: '2/3' })}
            </div>
            <h3 class="book-parchment-title">${this.escapeHtml(item.title)}</h3>
            <div class="book-parchment-author">Written by ${this.escapeHtml(author)}</div>
            <div style="font-family:'Crimson Pro', Georgia, serif; font-size:0.95rem; color:#653308;">
              Published ${item.releaseYear || 'N/A'} · ${pages ? `${pages} Pages` : ''} · ${format}
            </div>
            <div style="margin-top:0.75rem; color:#b45309; font-size:1.1rem;">
              ${favStars}
            </div>
            <div style="font-size:0.85rem; font-weight:600; color:#92400e; margin-top:4px;">
              Goodreads: ${item.externalScore?.rating || '4.2'} / 5.0
            </div>
          </div>

          <!-- Right Page: Reader's Journal & Notes -->
          <div class="book-right-page">
            <div>
              <div style="font-family:'Cinzel', serif; font-size:1.1rem; border-bottom:1px solid #c9b690; padding-bottom:0.35rem; margin-bottom:0.75rem; color:#3d2010; font-weight:700;">
                READER'S MARGINALIA
              </div>
              <p class="book-parchment-notes">
                "${this.escapeHtml(item.review || 'No handwritten journal entries recorded for this volume.')}"
              </p>
            </div>

            <div style="margin-top:1.5rem; padding-top:0.75rem; border-top:1px solid #d8c7a6; font-size:0.9rem; color:#5c3511; display:grid; grid-template-columns:1fr 1fr; gap:0.5rem;">
              <div>Status: <strong>${item.status || 'Read'}</strong></div>
              <div>Retention: <strong>${item.metrics?.retention || 4}/5</strong></div>
              <div>Yap Level: <strong>${item.metrics?.yapFactor || 4}/5</strong></div>
              <div>Date Logged: <strong>${item.dateExperienced || 'Recent'}</strong></div>
            </div>
          </div>
        </div>
      `;
      this.attachDetailModalActions(modal, item, isAdmin, onEdit, onDelete, onFixPoster);
      modal.classList.add('active');
      return;
    }

    // -------------------------------------------------------------
    // BESPOKE MODAL THEME 3: PC GAMING HUD / INVENTORY MODAL
    // -------------------------------------------------------------
    if (item.type === 'game') {
      if (modalBox) modalBox.style.maxWidth = '780px';
      modal.querySelector('.modal-title').innerHTML = `
        <span style="font-family:'Share Tech Mono', monospace; font-size:1.15rem; color:#34d399; letter-spacing:0.08em;">
          SYSTEM // INVENTORY // ${this.escapeHtml(item.title).toUpperCase()}
        </span>
      `;
      const hours = item.gameDetails?.hoursPlayed || 0;
      const finished = item.gameDetails?.timesFinished || 0;

      modal.querySelector('.modal-body').innerHTML = `
        <div style="display:grid; grid-template-columns:220px 1fr; gap:1.5rem; font-family:'Share Tech Mono', monospace; background:rgba(15,23,42,0.9); padding:1.25rem; border-radius:8px; border:1px solid #10b981;">
          <div>
            <div style="border-radius:4px; border:1px solid #10b981; box-shadow:0 0 15px rgba(16,185,129,0.3); overflow:hidden;">
              ${this.createPosterHTML(item, { aspectRatio: '3/4' })}
            </div>
            <div style="margin-top:0.75rem; color:#34d399; font-size:0.85rem; text-align:center;">
              METASCORE: ${item.externalScore?.rating || '90+'}
            </div>
            <div style="color:#f59e0b; text-align:center; font-size:1.1rem; margin-top:2px;">
              ${favStars}
            </div>
          </div>
          <div>
            <h2 style="font-family:'Share Tech Mono', monospace; font-size:1.6rem; color:#fff; margin-bottom:0.5rem;">
              ${this.escapeHtml(item.title)}
            </h2>
            <div style="color:#10b981; font-size:0.85rem; margin-bottom:1rem;">
              RELEASE: ${item.releaseYear || 'N/A'} · QUEST STATUS: ${(item.status || 'COMPLETED').toUpperCase()}
            </div>

            <div style="background:#090d16; border:1px solid rgba(16,185,129,0.3); padding:0.85rem; border-radius:6px; margin-bottom:1rem; display:grid; grid-template-columns:1fr 1fr; gap:0.65rem; font-size:0.85rem;">
              <div>HOURS LOGGED: <strong style="color:#34d399;">${hours} HRS</strong></div>
              <div>CLEARS: <strong style="color:#34d399;">${finished}x FINISHED</strong></div>
              <div>ENJOYMENT: <strong style="color:#34d399;">${item.metrics?.enjoyment || 5}/5</strong></div>
              <div>YAP FACTOR: <strong style="color:#34d399;">${item.metrics?.yapFactor || 5}/5</strong></div>
            </div>

            <div style="color:var(--text-muted); font-size:0.85rem; line-height:1.5;">
              <span style="color:#10b981; font-weight:700;">// PLAYER LOG:</span>
              <p style="margin-top:0.35rem; color:#e2e8f0;">"${this.escapeHtml(item.review || 'No mission debrief recorded.')}"</p>
            </div>
          </div>
        </div>
      `;
      this.attachDetailModalActions(modal, item, isAdmin, onEdit, onDelete, onFixPoster);
      modal.classList.add('active');
      return;
    }

    // -------------------------------------------------------------
    // BESPOKE MODAL THEME 4: 35MM CINEMA SCREENING ARCHIVE
    // -------------------------------------------------------------
    if (item.type === 'movie') {
      if (modalBox) modalBox.style.maxWidth = '840px';
      modal.querySelector('.modal-title').innerHTML = `
        <span style="font-family:'Cinzel', serif; font-size:1.25rem; letter-spacing:0.06em; color:#fbbf24;">
          CINEMA ARCHIVE // 35MM CELLULOID REEL
        </span>
      `;
      modal.querySelector('.modal-body').innerHTML = `
        <div style="display:grid; grid-template-columns: 260px 1fr; gap:2rem; align-items:start;">
          <div>
            <div style="position:relative; border:4px solid #000; box-shadow:0 0 25px rgba(251, 191, 36, 0.3), 0 15px 35px rgba(0,0,0,0.8); border-radius:4px; overflow:hidden;">
              <div style="background:#08090d; padding:4px 8px; display:flex; justify-content:space-between; border-bottom:1px solid rgba(255,255,255,0.1); font-family:'Share Tech Mono', monospace; font-size:0.65rem; color:#fbbf24;">
                <span>● 35MM KODAK 5063</span>
                <span>EXP 24</span>
              </div>
              ${this.createPosterHTML(item, { aspectRatio: '2/3' })}
              <div style="background:#08090d; padding:4px 8px; display:flex; justify-content:space-between; border-top:1px solid rgba(255,255,255,0.1); font-family:'Share Tech Mono', monospace; font-size:0.65rem; color:#94a3b8;">
                <span>01:42:18:04</span>
                <span>COLOR 70MM</span>
              </div>
            </div>
            <div style="text-align:center; margin-top:1rem; font-family:'Cinzel', serif; font-size:1.15rem; color:#f59e0b;">
              ${favStars}
            </div>
          </div>

          <div style="display:flex; flex-direction:column; gap:0.75rem;">
            <div style="border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:0.75rem;">
              <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:0.5rem;">
                <h2 style="font-family:'Cinzel', serif; font-size:1.8rem; margin:0 0 0.25rem 0; color:#fff; letter-spacing:0.04em;">
                  ${this.escapeHtml(item.title)}
                </h2>
                <span style="font-family:'Share Tech Mono', monospace; background:#1e2436; color:#fbbf24; border:1px solid #fbbf24; padding:0.2rem 0.5rem; font-size:0.85rem; border-radius:2px; white-space:nowrap;">
                  ★ IMDb ${item.externalScore?.rating || '8.5'}
                </span>
              </div>
              <div style="font-family:'Share Tech Mono', monospace; font-size:0.82rem; color:#94a3b8; display:flex; align-items:center; flex-wrap:wrap; gap:0.4rem;">
                <span>RELEASED ${item.releaseYear || ''} · STATUS: ${(item.status || 'Completed').toUpperCase()}</span>
                ${didCry ? `<span style="color:#38bdf8; display:inline-flex; align-items:center; gap:0.25rem;">${icons.drop(13)} TEARS WERE SHED</span>` : ''}
              </div>
            </div>

            <div style="display:flex; gap:0.4rem; flex-wrap:wrap;">
              ${(item.genres || []).map(g => `<span class="film-genre-tag" style="font-size:0.75rem; padding:0.15rem 0.5rem; border-color:#fbbf24; color:#fbbf24;">${g}</span>`).join('')}
            </div>

            <div style="background:rgba(255,255,255,0.03); border-left:3px solid #fbbf24; padding:0.85rem 1rem; border-radius:0 4px 4px 0; margin-top:0.25rem;">
              <p style="font-family:'Crimson Pro', Georgia, serif; font-size:1.1rem; font-style:italic; line-height:1.5; color:#e2e8f0; margin:0;">
                "${this.escapeHtml(item.review || 'No screening notes logged for this cinematic experience.')}"
              </p>
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.6rem; margin-top:0.5rem; font-family:'Share Tech Mono', monospace; font-size:0.8rem;">
              <div style="background:#0f121d; border:1px solid #232738; padding:0.5rem 0.75rem; border-radius:4px; display:flex; justify-content:space-between;">
                <span style="color:#94a3b8;">YAP FACTOR:</span>
                <span style="color:#f43f5e; font-weight:bold;">${item.metrics?.yapFactor || 4}/5</span>
              </div>
              <div style="background:#0f121d; border:1px solid #232738; padding:0.5rem 0.75rem; border-radius:4px; display:flex; justify-content:space-between;">
                <span style="color:#94a3b8;">RETENTION:</span>
                <span style="color:#38bdf8; font-weight:bold;">${item.metrics?.retention || 4}/5</span>
              </div>
              <div style="background:#0f121d; border:1px solid #232738; padding:0.5rem 0.75rem; border-radius:4px; display:flex; justify-content:space-between;">
                <span style="color:#94a3b8;">DISCOVERY:</span>
                <span style="color:#10b981;">${item.discoverySource || 'Self'}</span>
              </div>
              <div style="background:#0f121d; border:1px solid #232738; padding:0.5rem 0.75rem; border-radius:4px; display:flex; justify-content:space-between;">
                <span style="color:#94a3b8;">SOCIAL:</span>
                <span style="color:#fbbf24;">${socialTags}</span>
              </div>
            </div>
          </div>
        </div>
      `;
      this.attachDetailModalActions(modal, item, isAdmin, onEdit, onDelete, onFixPoster);
      modal.classList.add('active');
      return;
    }

    // -------------------------------------------------------------
    // DEFAULT/TV STANDARD MODAL
    // -------------------------------------------------------------
    if (modalBox) modalBox.style.maxWidth = '760px';
    modal.querySelector('.modal-title').textContent = 'Entry Details';

    const detailPosterEl = document.getElementById('detailPoster');
    if (detailPosterEl && detailPosterEl.parentElement) {
      detailPosterEl.parentElement.innerHTML = this.createPosterHTML(item, { aspectRatio: '2/3', imgClass: 'detail-poster-img' });
    }
    document.getElementById('detailTitle').textContent = item.title;
    document.getElementById('detailYear').textContent = item.releaseYear ? `(${item.releaseYear})` : '';
    document.getElementById('detailTypeBadge').textContent = (item.type === 'tv' ? 'SERIES' : item.type).toUpperCase();
    document.getElementById('detailStatusBadge').textContent = item.status || 'Completed';

    const cryBadge = document.getElementById('detailCryBadge');
    if (cryBadge) cryBadge.style.display = didCry ? 'inline-flex' : 'none';

    document.getElementById('detailStars').textContent = favStars;
    document.getElementById('detailExternalScore').textContent = item.externalScore?.rating 
      ? `${item.externalScore.source}: ${item.externalScore.rating}`
      : 'No external score';

    document.getElementById('detailEnjoyment').textContent = `${item.metrics?.enjoyment || 5}/5 (${this.getEnjoymentLabel(item.metrics?.enjoyment || 5)})`;
    document.getElementById('detailRetention').textContent = `${item.metrics?.retention || 4}/5 (${this.getRetentionLabel(item.metrics?.retention || 4)})`;
    document.getElementById('detailYap').textContent = `${item.metrics?.yapFactor || 4}/5 (${this.getYapLabel(item.metrics?.yapFactor || 4)})`;

    document.getElementById('detailDiscovery').textContent = item.discoverySource 
      ? `${item.discoverySource} ${item.recommendedBy ? `(By ${item.recommendedBy})` : ''}`
      : 'Self-discovery';
    document.getElementById('detailSocial').textContent = socialTags;
    document.getElementById('detailDate').textContent = item.dateExperienced || 'Not specified';

    const gameBlock = document.getElementById('detailGameBlock');
    if (gameBlock) {
      if (item.type === 'game') {
        gameBlock.style.display = 'block';
        document.getElementById('detailGameHours').textContent = `${item.gameDetails?.hoursPlayed || 0} hours`;
        document.getElementById('detailGameFinished').textContent = `${item.gameDetails?.timesFinished || 0} times`;
      } else {
        gameBlock.style.display = 'none';
      }
    }

    const bookBlock = document.getElementById('detailBookBlock');
    if (bookBlock) {
      if (item.type === 'book') {
        bookBlock.style.display = 'block';
        document.getElementById('detailBookAuthor').textContent = item.bookDetails?.author || item.author || 'Unknown';
        document.getElementById('detailBookPages').textContent = `${item.bookDetails?.pages || item.pages || 0} pages`;
        document.getElementById('detailBookFormat').textContent = item.bookDetails?.format || 'Paperback';
      } else {
        bookBlock.style.display = 'none';
      }
    }

    const reviewEl = document.getElementById('detailReview');
    if (reviewEl) reviewEl.textContent = item.review || 'No personal review logged for this title.';

    this.attachDetailModalActions(modal, item, isAdmin, onEdit, onDelete, onFixPoster);
    modal.classList.add('active');
  },

  attachDetailModalActions(modal, item, isAdmin, onEdit, onDelete, onFixPoster) {
    const adminActions = modal.querySelector('#detailAdminActions');
    if (adminActions) {
      adminActions.style.display = isAdmin ? 'flex' : 'none';
      
      const editBtn = modal.querySelector('#btnDetailEdit');
      if (editBtn) {
        editBtn.onclick = () => {
          this.closeDetailModal();
          onEdit(item);
        };
      }

      const delBtn = modal.querySelector('#btnDetailDelete');
      if (delBtn) {
        delBtn.onclick = () => {
          this.closeDetailModal();
          onDelete(item);
        };
      }

      let fixBtn = modal.querySelector('#btnDetailFixPoster');
      if (!fixBtn) {
        fixBtn = document.createElement('button');
        fixBtn.id = 'btnDetailFixPoster';
        fixBtn.className = 'card-action-btn card-btn-fix';
        fixBtn.style.padding = '0.45rem 0.85rem';
        fixBtn.textContent = 'Fix Poster';
        adminActions.prepend(fixBtn);
      }
      fixBtn.onclick = () => {
        this.closeDetailModal();
        if (onFixPoster) onFixPoster(item);
      };
    }

    // Ensure close buttons in header and footer always close
    modal.querySelectorAll('.modal-close-btn, .modal-cancel-btn').forEach(btn => {
      btn.onclick = () => {
        this.closeDetailModal();
      };
    });
  },

  closeDetailModal() {
    document.getElementById('detailModal')?.classList.remove('active');
  },

  renderFixPosterPreview(item, customUrl = null) {
    const previewBox = document.getElementById('fixPosterPreviewBox');
    if (!previewBox || !item) return;
    const previewItem = { ...item };
    if (customUrl !== null) previewItem.posterUrl = customUrl;
    previewBox.innerHTML = this.createPosterHTML(previewItem, { aspectRatio: '2/3' });
  },

  openAdminModal() {
    const modal = document.getElementById('adminModal');
    if (!modal) return;
    document.getElementById('adminPasswordInput').value = '';
    document.getElementById('adminLoginError').style.display = 'none';
    modal.classList.add('active');
    setTimeout(() => { document.getElementById('adminPasswordInput')?.focus(); }, 100);
  },

  closeAdminModal() {
    document.getElementById('adminModal')?.classList.remove('active');
  },

  getEnjoymentLabel(val) {
    const labels = {
      1: "Regretted watching/reading",
      2: "Mediocre / Slog",
      3: "Solid & Good",
      4: "Truly Great Experience",
      5: "Peak Fiction / Masterpiece"
    };
    return labels[val] || `${val}/5`;
  },

  getRetentionLabel(val) {
    const labels = {
      1: "Faded blur",
      2: "Vague outline",
      3: "Key plot points vivid",
      4: "Most scenes & moments intact",
      5: "Crystal clear photographic detail"
    };
    return labels[val] || `${val}/5`;
  },

  getYapLabel(val) {
    const labels = {
      1: "Never mention it",
      2: "Mentioned once or twice",
      3: "Bring up when topic arises",
      4: "Passionate evangelist",
      5: "Unstoppable Yap God"
    };
    return labels[val] || `${val}/5`;
  },

  setSliderVal(sliderId, val, labelId, text) {
    const slider = document.getElementById(sliderId);
    const label = document.getElementById(labelId);
    if (slider) slider.value = val;
    if (label) label.textContent = `${val}/5 • ${text}`;
  },

  updateStarRating(val) {
    document.querySelectorAll('.star-btn').forEach(btn => {
      const starVal = Number(btn.getAttribute('data-val'));
      btn.classList.toggle('active', starVal <= val);
    });
    const hiddenFav = document.getElementById('mediaFavoriteLevel');
    if (hiddenFav) hiddenFav.value = val;
  },

  showToast(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const iconSvg = type === 'success' 
      ? icons.check(16) 
      : type === 'warning' 
      ? icons.alertCircle(16) 
      : type === 'error' 
      ? icons.cross(16) 
      : icons.search(16);

    toast.innerHTML = `<span style="display:inline-flex; align-items:center;">${iconSvg}</span><span>${this.escapeHtml(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
};
