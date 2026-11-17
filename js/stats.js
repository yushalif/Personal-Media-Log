/**
 * Media Log - Stats Calculation Module
 * Computes dashboard metrics: total items, movies, shows, anime, games, books,
 * games finished, total hours played, total pages read, cry count, and yap index.
 * Generates data for Year in Review charts, Heatmaps, and Backlogs.
 */

export const statsService = {
  calculate(items = []) {
    const total = items.length;
    let moviesCount = 0;
    let tvCount = 0;
    let animeCount = 0;
    let gamesCount = 0;
    let booksCount = 0;

    let gamesFinished = 0;
    let totalHoursPlayed = 0;
    let totalPagesRead = 0;
    let cryCount = 0;
    let favoritesCount = 0;
    let totalYap = 0;
    let totalRetention = 0;

    items.forEach(item => {
      // Type breakdown
      if (item.type === 'movie') moviesCount++;
      else if (item.type === 'tv' || item.type === 'series') tvCount++;
      else if (item.type === 'anime') animeCount++;
      else if (item.type === 'game') gamesCount++;
      else if (item.type === 'book') booksCount++;

      // Game specific
      if (item.type === 'game') {
        const hours = Number(item.gameDetails?.hoursPlayed) || 0;
        const finishedTimes = Number(item.gameDetails?.timesFinished) || 0;
        totalHoursPlayed += hours;
        if (finishedTimes > 0 || item.status === 'Completed') {
          gamesFinished += (finishedTimes > 0 ? finishedTimes : 1);
        }
      }

      // Book specific
      if (item.type === 'book') {
        const pages = Number(item.bookDetails?.pages) || 0;
        if (item.status === 'Completed') {
          totalPagesRead += pages;
        }
      }

      // Emotional impact (Did I cry?)
      if (item.emotionalImpact?.cried === true) {
        cryCount++;
      }

      // Favorite level (5-star items)
      const fav = Number(item.metrics?.favorite) || 0;
      if (fav >= 5) {
        favoritesCount++;
      }

      // Yap & Retention sums
      const yap = Number(item.metrics?.yapFactor) || 0;
      const ret = Number(item.metrics?.retention) || 0;
      totalYap += yap;
      totalRetention += ret;
    });

    const avgYap = total > 0 ? (totalYap / total).toFixed(1) : '0.0';
    const avgRetention = total > 0 ? (totalRetention / total).toFixed(1) : '0.0';

    return {
      total,
      moviesCount,
      tvCount,
      animeCount,
      gamesCount,
      booksCount,
      gamesFinished,
      totalHoursPlayed,
      totalPagesRead,
      cryCount,
      favoritesCount,
      avgYap,
      avgRetention
    };
  },

  renderStatsBar(items = []) {
    const stats = this.calculate(items);

    const elTotal = document.getElementById('statTotalItems');
    const elBreakdown = document.getElementById('statBreakdown');
    const elGamesFinished = document.getElementById('statGamesFinished');
    const elHoursPlayed = document.getElementById('statHoursPlayed');
    const elHoursDays = document.getElementById('statHoursDays');
    const elCryCount = document.getElementById('statCryCount');
    const elFavorites = document.getElementById('statFavorites');
    const elYapAvg = document.getElementById('statYapAvg');
    const elCatBar = document.getElementById('statCategoryBar');

    if (elTotal) elTotal.textContent = stats.total;
    if (elBreakdown) {
      elBreakdown.textContent = `${stats.moviesCount} Movies • ${stats.tvCount} Series • ${stats.animeCount} Anime • ${stats.gamesCount} Games • ${stats.booksCount} Books`;
    }
    if (elGamesFinished) elGamesFinished.textContent = stats.gamesFinished;
    if (elHoursPlayed) elHoursPlayed.textContent = `${stats.totalHoursPlayed}h`;
    if (elHoursDays) {
      const days = (stats.totalHoursPlayed / 24).toFixed(1);
      elHoursDays.textContent = `~${days} days logged`;
    }
    if (elCryCount) elCryCount.textContent = stats.cryCount;
    if (elFavorites) elFavorites.textContent = stats.favoritesCount;
    if (elYapAvg) elYapAvg.textContent = `${stats.avgYap}/5`;

    // Mini category-split progress bar
    if (elCatBar) {
      if (stats.total > 0) {
        const pMovie = ((stats.moviesCount / stats.total) * 100).toFixed(1);
        const pTv = ((stats.tvCount / stats.total) * 100).toFixed(1);
        const pAnime = ((stats.animeCount / stats.total) * 100).toFixed(1);
        const pGame = ((stats.gamesCount / stats.total) * 100).toFixed(1);
        const pBook = ((stats.booksCount / stats.total) * 100).toFixed(1);

        elCatBar.innerHTML = `
          <div class="cat-segment cat-seg-movie" style="width:${pMovie}%;" title="Movies: ${stats.moviesCount} (${pMovie}%)"></div>
          <div class="cat-segment cat-seg-tv" style="width:${pTv}%;" title="Shows: ${stats.tvCount} (${pTv}%)"></div>
          <div class="cat-segment cat-seg-anime" style="width:${pAnime}%;" title="Anime: ${stats.animeCount} (${pAnime}%)"></div>
          <div class="cat-segment cat-seg-game" style="width:${pGame}%;" title="Games: ${stats.gamesCount} (${pGame}%)"></div>
          <div class="cat-segment cat-seg-book" style="width:${pBook}%;" title="Books: ${stats.booksCount} (${pBook}%)"></div>
        `;
      } else {
        elCatBar.innerHTML = '';
      }
    }
  },

  // ===================================================================
  // Year in Review Data Generation
  // ===================================================================
  getYearInReview(items = [], targetYear = null) {
    const currentYear = targetYear || new Date().getFullYear();
    const monthlyCounts = new Array(12).fill(0);
    const ratingDist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const categoryCounts = { movie: 0, tv: 0, anime: 0, game: 0, book: 0 };
    let totalInYear = 0;

    items.forEach(item => {
      const dStr = item.dateExperienced || item.createdAt;
      let d = dStr ? new Date(dStr) : null;
      if (!d || isNaN(d.getTime())) {
        d = new Date(); // fallback
      }

      if (d.getFullYear() === currentYear || !targetYear) {
        totalInYear++;
        const monthIdx = d.getMonth();
        monthlyCounts[monthIdx]++;

        const fav = Math.max(1, Math.min(5, Math.round(Number(item.metrics?.favorite) || 4)));
        ratingDist[fav] = (ratingDist[fav] || 0) + 1;

        const t = (item.type === 'series') ? 'tv' : (item.type || 'movie');
        if (categoryCounts[t] !== undefined) {
          categoryCounts[t]++;
        }
      }
    });

    return {
      year: currentYear,
      totalInYear,
      monthlyCounts,
      ratingDist,
      categoryCounts
    };
  },

  // ===================================================================
  // Activity Heatmap: Matrix of past 16 weeks
  // ===================================================================
  getActivityHeatmap(items = [], weeks = 16) {
    const daysCount = weeks * 7;
    const now = new Date();
    // Normalize to midnight
    const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startDate = new Date(endDate.getTime() - (daysCount - 1) * 24 * 60 * 60 * 1000);

    // Map date string 'YYYY-MM-DD' -> count
    const dateMap = {};
    items.forEach(item => {
      const dStr = item.dateExperienced || item.createdAt;
      if (dStr) {
        const d = new Date(dStr);
        if (!isNaN(d.getTime())) {
          const key = d.toISOString().slice(0, 10);
          dateMap[key] = (dateMap[key] || 0) + 1;
        }
      }
    });

    const columns = [];
    let currentDay = new Date(startDate.getTime());

    for (let w = 0; w < weeks; w++) {
      const col = [];
      for (let d = 0; d < 7; d++) {
        const key = currentDay.toISOString().slice(0, 10);
        const count = dateMap[key] || 0;
        let level = 0;
        if (count >= 4) level = 4;
        else if (count >= 3) level = 3;
        else if (count >= 2) level = 2;
        else if (count >= 1) level = 1;

        col.push({
          date: key,
          count,
          level
        });

        currentDay.setDate(currentDay.getDate() + 1);
      }
      columns.push(col);
    }

    return columns;
  },

  // ===================================================================
  // Backlog Queue (Next 5 planned items)
  // ===================================================================
  getBacklogQueue(items = [], limit = 5) {
    const planned = items.filter(m => m.status === 'Plan to Watch/Play' || m.status === 'Plan to Watch/Read');
    return planned.slice(0, limit);
  },

  // ===================================================================
  // On This Day in Media History
  // ===================================================================
  getOnThisDay(items = []) {
    const today = new Date();
    const curMonth = today.getMonth();
    const curDate = today.getDate();
    const curYear = today.getFullYear();

    return items.filter(item => {
      const dStr = item.dateExperienced;
      if (!dStr) return false;
      const d = new Date(dStr);
      if (isNaN(d.getTime())) return false;
      return d.getMonth() === curMonth && d.getDate() === curDate && d.getFullYear() < curYear;
    });
  },

  // ===================================================================
  // Gaming Stats HUD Helper
  // ===================================================================
  getGamingHUDStats(games = []) {
    let totalHours = 0;
    let clears = 0;
    let scoresSum = 0;
    let scoresCount = 0;
    let platformCounts = {};
    let longestGame = null;
    let longestHours = -1;

    games.forEach(g => {
      const h = Number(g.gameDetails?.hoursPlayed) || 0;
      const c = Number(g.gameDetails?.timesFinished) || 0;
      totalHours += h;
      clears += (c > 0 ? c : (g.status === 'Completed' ? 1 : 0));

      const plat = g.gameDetails?.platform || g.platform || 'PC';
      platformCounts[plat] = (platformCounts[plat] || 0) + h;

      const score = Number(g.externalScore?.rating);
      if (!isNaN(score) && score > 0) {
        scoresSum += score;
        scoresCount++;
      }

      if (h > longestHours) {
        longestHours = h;
        longestGame = g;
      }
    });

    let topPlatform = '—';
    let maxPlatHours = 0;
    for (const [p, hrs] of Object.entries(platformCounts)) {
      if (hrs > maxPlatHours) {
        maxPlatHours = hrs;
        topPlatform = p;
      }
    }
    if (games.length > 0 && topPlatform === '—') {
      topPlatform = games[0].gameDetails?.platform || 'PC';
    }

    const avgScore = scoresCount > 0 ? Math.round(scoresSum / scoresCount) : 0;

    return {
      totalHours,
      clears,
      avgScore,
      topPlatform,
      longestGame: longestGame ? `${longestGame.title} (${longestHours}h)` : 'None'
    };
  },

  // ===================================================================
  // TV Shows Stats HUD Helper
  // ===================================================================
  getTVHUDStats(shows = []) {
    let totalEpisodes = 0;
    let completedCount = 0;
    let totalRuntimeHours = 0;
    let ratingSum = 0;
    let ratingCount = 0;

    shows.forEach(s => {
      const watched = Number(s.tvDetails?.watchedEpisodes) || (s.status === 'Completed' ? (s.tvDetails?.totalEpisodes || 0) : 0);
      totalEpisodes += watched;
      totalRuntimeHours += Math.round(watched * 0.85); // average ~50min per ep

      if (s.status === 'Completed') completedCount++;

      const r = Number(s.externalScore?.rating) || (s.metrics?.favorite ? Number(s.metrics.favorite * 2) : 0);
      if (!isNaN(r) && r > 0) {
        ratingSum += r;
        ratingCount++;
      }
    });

    const avgRating = ratingCount > 0 ? (ratingSum / ratingCount).toFixed(1) : '0.0';

    return {
      totalEpisodes,
      totalHours: totalRuntimeHours,
      completedCount,
      avgRating
    };
  }
};
