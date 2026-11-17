// Vercel Serverless Function: /api/extract-url
// Extracts metadata (Title, Year, Type, Poster, Score, Synopsis)
// from Rotten Tomatoes, IMDb, Metacritic, IGN, Steam, MyAnimeList, Google, and general review links.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const rawUrl = req.query.url || req.body?.url;
  if (!rawUrl || typeof rawUrl !== 'string') {
    return res.status(400).json({ ok: false, error: 'URL parameter required' });
  }

  let targetUrl = rawUrl.trim();
  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    targetUrl = 'https://' + targetUrl;
  }

  const lowerUrl = targetUrl.toLowerCase();

  try {
    // 1. Steam Store URL
    const steamMatch = targetUrl.match(/store\.steampowered\.com\/app\/(\d+)/i);
    if (steamMatch) {
      const appId = steamMatch[1];
      const steamApiUrl = `https://store.steampowered.com/api/appdetails?appids=${appId}&l=english`;
      const sRes = await fetch(steamApiUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (sRes.ok) {
        const sData = await sRes.json();
        const appInfo = sData[appId]?.data;
        if (appInfo) {
          const poster = `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/library_600x900_2x.jpg`;
          const releaseStr = appInfo.release_date?.date || '';
          const yearMatch = releaseStr.match(/\b(19\d\d|20\d\d)\b/);
          const meta = appInfo.metacritic?.score;

          return res.status(200).json({
            ok: true,
            source: 'Steam',
            item: {
              id: `steam-${appId}`,
              title: appInfo.name,
              type: 'game',
              releaseYear: yearMatch ? parseInt(yearMatch[1], 10) : null,
              posterUrl: poster,
              externalScore: {
                source: meta ? 'Metacritic' : 'Steam',
                rating: meta ? String(meta) : 'Verified'
              },
              synopsis: appInfo.short_description || '',
              genres: (appInfo.genres || []).map(g => g.description),
              platforms: ['PC'],
              gameDetails: { hoursPlayed: 0, timesFinished: 0 },
              discoverySource: 'Review link (Steam)',
              originalUrl: targetUrl
            }
          });
        }
      }
    }

    // 2. MyAnimeList URL
    const malMatch = targetUrl.match(/myanimelist\.net\/anime\/(\d+)/i);
    if (malMatch) {
      const malId = malMatch[1];
      const jikanApiUrl = `https://api.jikan.moe/v4/anime/${malId}`;
      const jRes = await fetch(jikanApiUrl, { headers: { 'User-Agent': 'MediaLogApp/1.0' } });
      if (jRes.ok) {
        const jData = await jRes.json();
        const anime = jData.data;
        if (anime) {
          return res.status(200).json({
            ok: true,
            source: 'MyAnimeList',
            item: {
              id: `mal-${malId}`,
              title: anime.title_english || anime.title,
              originalTitle: anime.title,
              type: 'anime',
              releaseYear: anime.year || (anime.aired?.from ? new Date(anime.aired.from).getFullYear() : null),
              posterUrl: anime.images?.webp?.large_image_url || anime.images?.jpg?.large_image_url || '',
              externalScore: {
                source: 'MAL',
                rating: anime.score ? String(anime.score) : 'N/A'
              },
              synopsis: anime.synopsis || '',
              genres: (anime.genres || []).map(g => g.name),
              discoverySource: 'Review link (MyAnimeList)',
              originalUrl: targetUrl
            }
          });
        }
      }
    }

    // 3. IMDb URL (extract title, year, poster, ratings)
    const imdbMatch = targetUrl.match(/imdb\.com\/title\/(tt\d+)/i);
    if (imdbMatch) {
      const imdbId = imdbMatch[1];
      const omdbKey = process.env.OMDB_API_KEY || 'trilogy';
      try {
        const oRes = await fetch(`https://www.omdbapi.com/?i=${imdbId}&apikey=${omdbKey}`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (oRes.ok) {
          const omData = await oRes.json();
          if (omData.Response === 'True') {
            const yearMatch = (omData.Year || '').match(/\b(19\d\d|20\d\d)\b/);
            const mediaType = omData.Type === 'series' ? 'tv' : 'movie';
            const genres = (omData.Genre || '').split(',').map(s => s.trim()).filter(Boolean);
            return res.status(200).json({
              ok: true,
              source: 'IMDb',
              item: {
                id: `imdb-${imdbId}`,
                title: omData.Title,
                type: mediaType,
                releaseYear: yearMatch ? parseInt(yearMatch[1], 10) : null,
                posterUrl: omData.Poster !== 'N/A' ? omData.Poster : '',
                externalScore: { source: 'IMDb', rating: omData.imdbRating || 'N/A' },
                synopsis: omData.Plot || '',
                genres: genres,
                discoverySource: 'Review link (IMDb)',
                originalUrl: targetUrl
              }
            });
          }
        }
      } catch (e) {
        // Fallback to IMDb Suggestion API below
      }

      try {
        const suggRes = await fetch(`https://v2.sg.media-imdb.com/suggestion/t/${imdbId}.json`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (suggRes.ok) {
          const sData = await suggRes.json();
          const it = sData.d?.[0];
          if (it) {
            return res.status(200).json({
              ok: true,
              source: 'IMDb',
              item: {
                id: `imdb-${imdbId}`,
                title: it.l,
                type: (it.qid || '').toLowerCase().includes('tv') ? 'tv' : 'movie',
                releaseYear: it.y || null,
                posterUrl: it.i?.imageUrl || '',
                externalScore: { source: 'IMDb', rating: '8.0' },
                synopsis: it.s ? `Starring ${it.s}` : '',
                discoverySource: 'Review link (IMDb)',
                originalUrl: targetUrl
              }
            });
          }
        }
      } catch (e) {
        // Continue to universal scraper
      }
    }

    // 4. OpenLibrary URL
    const olMatch = targetUrl.match(/openlibrary\.org\/(works|books)\/([A-Za-z0-9]+)/i);
    if (olMatch) {
      const typeKey = olMatch[1];
      const olId = olMatch[2];
      const olApiUrl = `https://openlibrary.org/${typeKey}/${olId}.json`;
      const olRes = await fetch(olApiUrl, { headers: { 'User-Agent': 'MediaLogApp/1.0' } });
      if (olRes.ok) {
        const olData = await olRes.json();
        const coverId = Array.isArray(olData.covers) ? olData.covers[0] : null;
        const poster = coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : '';
        return res.status(200).json({
          ok: true,
          source: 'OpenLibrary',
          item: {
            id: `book-${olId}`,
            title: olData.title,
            type: 'book',
            releaseYear: olData.first_publish_date ? parseInt(olData.first_publish_date.match(/\b(19\d\d|20\d\d)\b/)?.[1] || 0, 10) : null,
            posterUrl: poster,
            externalScore: { source: 'OpenLibrary', rating: '4.0' },
            synopsis: typeof olData.description === 'string' ? olData.description : (olData.description?.value || ''),
            bookDetails: { author: 'Author', pages: 350, format: 'Paperback' },
            discoverySource: 'Review link (OpenLibrary)',
            originalUrl: targetUrl
          }
        });
      }
    }

    // 5. Universal OpenGraph + JSON-LD HTML Scraping for Rotten Tomatoes, Metacritic, IGN, Google, etc.
    const pageRes = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    if (!pageRes.ok) {
      throw new Error(`Failed to fetch page (${pageRes.status})`);
    }

    const html = await pageRes.text();

    // Site / Brand identification
    let siteName = 'Review Link';
    if (lowerUrl.includes('rottentomatoes.com')) siteName = 'Rotten Tomatoes';
    else if (lowerUrl.includes('imdb.com')) siteName = 'IMDb';
    else if (lowerUrl.includes('metacritic.com')) siteName = 'Metacritic';
    else if (lowerUrl.includes('ign.com')) siteName = 'IGN';
    else if (lowerUrl.includes('goodreads.com')) siteName = 'Goodreads';
    else if (lowerUrl.includes('google.com')) siteName = 'Google';

    let title = '';
    let posterUrl = '';
    let synopsis = '';
    let rating = 'N/A';
    let mediaType = 'movie';
    let year = null;
    let genres = [];

    // Parse JSON-LD scripts
    const ldRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/gis;
    let ldMatch;
    while ((ldMatch = ldRegex.exec(html)) !== null) {
      try {
        const ldData = JSON.parse(ldMatch[1].trim());
        const items = Array.isArray(ldData) ? ldData : [ldData];
        for (const d of items) {
          if (!d || typeof d !== 'object') continue;
          const sType = String(d['@type'] || '').toLowerCase();
          if (['movie', 'tvseries', 'videogame', 'book', 'creativework', 'product'].some(t => sType.includes(t))) {
            if (!title && (d.name || d.headline)) title = d.name || d.headline;
            if (!posterUrl && d.image) {
              posterUrl = typeof d.image === 'string' ? d.image : (d.image.url || '');
            }
            if (!synopsis && d.description) synopsis = d.description;
            if (d.genre) genres = Array.isArray(d.genre) ? d.genre : [String(d.genre)];
            if (d.aggregateRating?.ratingValue) {
              const val = String(d.aggregateRating.ratingValue);
              if (lowerUrl.includes('rottentomatoes')) {
                rating = `${val}%`;
              } else if (d.aggregateRating.bestRating === '100' || parseFloat(val) > 10) {
                rating = `${val}/100`;
              } else {
                rating = `${val}/10`;
              }
            }
            if (sType.includes('videogame')) mediaType = 'game';
            else if (sType.includes('tvseries')) mediaType = 'tv';
            else if (sType.includes('book')) mediaType = 'book';
            else if (sType.includes('movie')) mediaType = 'movie';

            if (d.datePublished) {
              const ym = String(d.datePublished).match(/\b(19\d\d|20\d\d)\b/);
              if (ym) year = parseInt(ym[1], 10);
            }
            break;
          }
        }
      } catch (e) {
        // Ignore JSON-LD parse errors
      }
    }

    // Parse Meta Tags fallback
    if (!title) {
      const ogTitleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i) ||
                           html.match(/<meta\s+content=["']([^"']+)["']\s+property=["']og:title["']/i);
      title = ogTitleMatch ? ogTitleMatch[1] : '';
      if (!title) {
        const tTag = html.match(/<title>([^<]+)<\/title>/i);
        title = tTag ? tTag[1] : 'Extracted Media';
      }
    }

    if (!posterUrl) {
      const ogImageMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i) ||
                           html.match(/<meta\s+content=["']([^"']+)["']\s+property=["']og:image["']/i) ||
                           html.match(/<meta\s+name=["']twitter:image["']\s+content=["']([^"']+)["']/i);
      posterUrl = ogImageMatch ? ogImageMatch[1] : '';
    }

    if (!synopsis) {
      const ogDescMatch = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i) ||
                          html.match(/<meta\s+content=["']([^"']+)["']\s+property=["']og:description["']/i) ||
                          html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
      synopsis = ogDescMatch ? ogDescMatch[1] : '';
    }

    // Clean up title
    title = title.replace(/\s*\|\s*(Rotten Tomatoes|Metacritic|IGN|IMDb|Goodreads).*$/i, '')
                 .replace(/\s*-\s*Rotten Tomatoes.*$/i, '')
                 .replace(/\s*-\s*IMDb.*$/i, '')
                 .replace(/\s*Reviews?\s*-\s*Metacritic.*$/i, '')
                 .trim();

    // Year detection if not already detected
    if (!year) {
      const yearMatch = title.match(/\((\d{4})\)/) || targetUrl.match(/\b(19\d\d|20\d\d)\b/);
      if (yearMatch) year = parseInt(yearMatch[1], 10);
    }
    title = title.replace(/\s*\(\d{4}\)/, '').trim();

    // Media Type detection from URL
    if (mediaType === 'movie') {
      if (lowerUrl.includes('/game/') || lowerUrl.includes('/games/') || lowerUrl.includes('ign.com/games') || lowerUrl.includes('metacritic.com/game')) {
        mediaType = 'game';
      } else if (lowerUrl.includes('/tv/') || lowerUrl.includes('/shows/') || lowerUrl.includes('tvmaze') || lowerUrl.includes('ign.com/tv')) {
        mediaType = 'tv';
      } else if (lowerUrl.includes('/anime/') || lowerUrl.includes('myanimelist') || lowerUrl.includes('kitsu.io')) {
        mediaType = 'anime';
      } else if (lowerUrl.includes('/book/') || lowerUrl.includes('/books/') || lowerUrl.includes('goodreads') || lowerUrl.includes('openlibrary')) {
        mediaType = 'book';
      }
    }

    // Score extraction from synopsis / description if still N/A
    if (rating === 'N/A' && synopsis) {
      const percentMatch = synopsis.match(/(\d{1,3})%/);
      const tenMatch = synopsis.match(/(\d{1,2}(?:\.\d)?)\/10\b/);
      const metaMatch = synopsis.match(/Metascore\s*(\d{1,3})\b/i);

      if (metaMatch) rating = `${metaMatch[1]}/100`;
      else if (percentMatch) rating = `${percentMatch[1]}%`;
      else if (tenMatch) rating = `${tenMatch[1]}/10`;
    }

    return res.status(200).json({
      ok: true,
      source: siteName,
      item: {
        id: `extracted-${Date.now()}`,
        title: title || 'Extracted Media',
        type: mediaType,
        releaseYear: year,
        posterUrl: posterUrl,
        externalScore: {
          source: siteName,
          rating: rating
        },
        synopsis: synopsis || '',
        genres: genres,
        discoverySource: `Review link (${siteName})`,
        originalUrl: targetUrl
      }
    });

  } catch (err) {
    console.error('Extract URL error:', err);
    return res.status(500).json({
      ok: false,
      error: err.message || 'Could not extract metadata from this link'
    });
  }
}
