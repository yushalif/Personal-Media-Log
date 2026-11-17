// Vercel Serverless Function: /api/search-media
// Unified search endpoint for Movies, Anime, and Video Games
// Securely uses TMDB_API_KEY, OMDB_API_KEY, and RAWG_API_KEY server-side

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { q = '', type = 'movie' } = req.query;
  const query = q.trim();

  if (!query) {
    return res.status(200).json({ results: [] });
  }

  const TMDB_API_KEY = process.env.TMDB_API_KEY || req.query.tmdbKey || req.headers['x-tmdb-key'] || '';
  const OMDB_API_KEY = process.env.OMDB_API_KEY || req.query.omdbKey || req.headers['x-omdb-key'] || '';
  const RAWG_API_KEY = process.env.RAWG_API_KEY || req.query.rawgKey || req.headers['x-rawg-key'] || '';

  try {
    // 1. ANIME (Jikan API + Kitsu API fallback - Both keyless)
    if (type === 'anime') {
      try {
        const jikanUrl = `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=15&sfw=true`;
        const jikanRes = await fetch(jikanUrl, {
          headers: { 'User-Agent': 'MediaLogApp/1.0' }
        });

        if (jikanRes.ok) {
          const jikanData = await jikanRes.json();
          const list = jikanData.data || [];
          if (list.length > 0) {
            const results = list.map(item => {
              const year = item.year || (item.aired?.from ? new Date(item.aired.from).getFullYear() : null);
              return {
                id: `mal-${item.mal_id}`,
                title: item.title_english || item.title,
                originalTitle: item.title,
                type: 'anime',
                releaseYear: year || 2023,
                posterUrl: item.images?.webp?.large_image_url || item.images?.jpg?.large_image_url || item.images?.jpg?.image_url || '',
                externalScore: {
                  source: 'MAL',
                  rating: item.score ? String(item.score) : 'N/A'
                },
                synopsis: item.synopsis || '',
                genres: (item.genres || []).map(g => g.name),
                status: item.status || ''
              };
            });
            return res.status(200).json({ results, source: 'jikan' });
          }
        }
      } catch (e) {
        console.warn('Jikan error, falling back to Kitsu:', e.message);
      }

      // Kitsu API Fallback (Free & keyless)
      try {
        const kitsuUrl = `https://kitsu.io/api/edge/anime?filter[text]=${encodeURIComponent(query)}&page[limit]=12`;
        const kitsuRes = await fetch(kitsuUrl, {
          headers: { 'Accept': 'application/vnd.api+json', 'User-Agent': 'MediaLogApp/1.0' }
        });
        if (kitsuRes.ok) {
          const kitsuData = await kitsuRes.json();
          const list = kitsuData.data || [];
          if (list.length > 0) {
            const results = list.map(item => {
              const attr = item.attributes || {};
              const year = attr.startDate ? new Date(attr.startDate).getFullYear() : null;
              const poster = attr.posterImage?.large || attr.posterImage?.original || attr.posterImage?.medium || '';
              return {
                id: `kitsu-${item.id}`,
                title: attr.canonicalTitle || attr.titles?.en || attr.titles?.en_jp || 'Anime',
                originalTitle: attr.titles?.ja_jp || '',
                type: 'anime',
                releaseYear: year,
                posterUrl: poster,
                externalScore: {
                  source: 'Kitsu',
                  rating: attr.averageRating ? `${(Number(attr.averageRating) / 10).toFixed(1)}/10` : 'N/A'
                },
                synopsis: attr.synopsis || '',
                genres: ['Anime']
              };
            });
            return res.status(200).json({ results, source: 'kitsu' });
          }
        }
      } catch (kitsuErr) {
        console.warn('Kitsu error:', kitsuErr.message);
      }
    }

    // 2. VIDEO GAMES (RAWG if key provided, else Steam Store API - Free & keyless)
    if (type === 'game') {
      if (RAWG_API_KEY) {
        try {
          const rawgUrl = `https://api.rawg.io/api/games?key=${RAWG_API_KEY}&search=${encodeURIComponent(query)}&page_size=15`;
          const rawgRes = await fetch(rawgUrl);
          if (rawgRes.ok) {
            const rawgData = await rawgRes.json();
            const results = (rawgData.results || []).map(item => {
              const year = item.released ? new Date(item.released).getFullYear() : null;
              const platforms = (item.platforms || []).map(p => p.platform?.name).filter(Boolean);
              return {
                id: `rawg-${item.id}`,
                title: item.name,
                type: 'game',
                releaseYear: year || null,
                posterUrl: item.background_image || '',
                externalScore: {
                  source: 'Metacritic',
                  rating: item.metacritic ? String(item.metacritic) : 'N/A'
                },
                platforms: platforms.slice(0, 4),
                genres: (item.genres || []).map(g => g.name)
              };
            });
            if (results.length > 0) {
              return res.status(200).json({ results, source: 'rawg' });
            }
          }
        } catch (rawgErr) {
          console.warn('RAWG error, falling back to Steam:', rawgErr.message);
        }
      }

      // Live Steam Store Search (Free, keyless, returns official high-res 600x900 covers)
      try {
        const steamUrl = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(query)}&l=english&cc=US`;
        const steamRes = await fetch(steamUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        if (steamRes.ok) {
          const steamData = await steamRes.json();
          const items = steamData.items || [];
          if (items.length > 0) {
            const results = items.slice(0, 15).map(item => {
              const appId = item.id;
              // Official high-res vertical 600x900 library capsule cover
              const poster = `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/library_600x900_2x.jpg`;
              const platforms = [];
              if (item.platforms?.windows) platforms.push('PC');
              if (item.platforms?.mac) platforms.push('Mac');
              if (item.platforms?.linux) platforms.push('Steam Deck');

              return {
                id: `steam-${appId}`,
                title: item.name,
                type: 'game',
                releaseYear: null,
                posterUrl: poster,
                externalScore: {
                  source: item.metascore ? 'Metacritic' : 'Steam',
                  rating: item.metascore ? String(item.metascore) : 'Verified'
                },
                platforms: platforms.length > 0 ? platforms : ['PC'],
                genres: ['Video Game'],
                synopsis: `Available on Steam (App ID: ${appId}).`
              };
            });
            return res.status(200).json({ results, source: 'steam' });
          }
        }
      } catch (steamErr) {
        console.warn('Steam search error:', steamErr.message);
      }
    }

    // 3. TV SHOWS (TVMaze - Free & keyless)
    if (type === 'tv') {
      try {
        const tvUrl = `https://api.tvmaze.com/search/shows?q=${encodeURIComponent(query)}`;
        const tvRes = await fetch(tvUrl);
        if (tvRes.ok) {
          const tvData = await tvRes.json();
          if (Array.isArray(tvData) && tvData.length > 0) {
            const results = tvData.slice(0, 15).map(item => {
              const show = item.show || {};
              const year = show.premiered ? new Date(show.premiered).getFullYear() : null;
              const poster = show.image?.original || show.image?.medium || '';
              const rating = show.rating?.average ? String(show.rating.average) : 'N/A';
              const cleanSummary = show.summary ? show.summary.replace(/<[^>]+>/g, '').trim() : '';

              return {
                id: `tvmaze-${show.id}`,
                title: show.name,
                type: 'tv',
                releaseYear: year,
                posterUrl: poster,
                externalScore: {
                  source: 'TVMaze',
                  rating: rating !== 'N/A' ? `${rating}/10` : 'N/A'
                },
                genres: show.genres || ['Drama'],
                synopsis: cleanSummary,
                tvDetails: {
                  network: show.network?.name || show.webChannel?.name || 'Broadcast',
                  status: show.status || 'Ended'
                }
              };
            });
            return res.status(200).json({ results, source: 'tvmaze' });
          }
        }
      } catch (tvErr) {
        console.warn('TVMaze error:', tvErr.message);
      }
    }

    // 4. BOOKS (OpenLibrary - Free & keyless)
    if (type === 'book') {
      try {
        const openLibUrl = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=12`;
        const openLibRes = await fetch(openLibUrl, {
          headers: { 'User-Agent': 'MediaLogApp/1.0' }
        });
        if (openLibRes.ok) {
          const data = await openLibRes.json();
          const docs = data.docs || [];
          if (docs.length > 0) {
            const results = docs.map(doc => {
              const coverId = doc.cover_i;
              const poster = coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : '';
              const authors = doc.author_name || [];
              const author = Array.isArray(authors) ? authors[0] : (authors || 'Unknown Author');
              const pages = doc.number_of_pages_median || 350;
              const year = doc.first_publish_year || null;

              return {
                id: `book-${doc.key?.replace(/\//g, '-') || Date.now()}`,
                title: doc.title,
                type: 'book',
                releaseYear: year,
                posterUrl: poster,
                externalScore: {
                  source: 'OpenLibrary',
                  rating: doc.ratings_average ? Number(doc.ratings_average).toFixed(1) : '4.0'
                },
                author,
                pages,
                bookDetails: {
                  author,
                  pages,
                  format: 'Paperback'
                },
                genres: doc.subject ? doc.subject.slice(0, 3) : ['Fiction'],
                synopsis: `By ${author}. First published in ${year || 'N/A'}.`
              };
            });
            return res.status(200).json({ results, source: 'openlibrary' });
          }
        }
      } catch (bookErr) {
        console.warn('OpenLibrary error:', bookErr.message);
      }
    }

    // 5. MOVIES (TMDB / OMDb)
    if (type === 'movie' || type === 'tv') {
      if (TMDB_API_KEY) {
        const tmdbUrl = `https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&include_adult=false&page=1`;
        const tmdbRes = await fetch(tmdbUrl);
        if (tmdbRes.ok) {
          const tmdbData = await tmdbRes.json();
          const filtered = (tmdbData.results || []).filter(item => item.media_type === 'movie' || item.media_type === 'tv');
          
          const results = filtered.slice(0, 15).map(item => {
            const isMovie = item.media_type === 'movie';
            const dateStr = isMovie ? item.release_date : item.first_air_date;
            const year = dateStr ? new Date(dateStr).getFullYear() : null;
            const title = isMovie ? item.title : item.name;
            const poster = item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : '';
            const rating = item.vote_average ? item.vote_average.toFixed(1) : 'N/A';

            return {
              id: `tmdb-${item.id}`,
              title,
              type: 'movie',
              releaseYear: year || null,
              posterUrl: poster,
              externalScore: {
                source: 'TMDB',
                rating: rating !== 'N/A' ? `${rating}/10` : 'N/A'
              },
              synopsis: item.overview || '',
              mediaSubtype: item.media_type
            };
          });

          return res.status(200).json({ results, source: 'tmdb' });
        }
      }

      if (OMDB_API_KEY) {
        const omdbUrl = `https://www.omdbapi.com/?s=${encodeURIComponent(query)}&apikey=${OMDB_API_KEY}`;
        const omdbRes = await fetch(omdbUrl);
        if (omdbRes.ok) {
          const omdbData = await omdbRes.json();
          if (omdbData.Search) {
            const results = omdbData.Search.map(item => ({
              id: `imdb-${item.imdbID}`,
              title: item.Title,
              type: 'movie',
              releaseYear: parseInt(item.Year, 10) || null,
              posterUrl: item.Poster !== 'N/A' ? item.Poster : '',
              externalScore: {
                source: 'IMDb',
                rating: 'Search Result'
              },
              synopsis: ''
            }));
            return res.status(200).json({ results, source: 'omdb' });
          }
        }
      }
    }

    // Fallback: If external API keys are not provided yet in environment
    return res.status(200).json({
      results: [],
      apiKeyMissing: true,
      message: `API key for ${type} is not configured in .env. Enter a TMDB or OMDb key to enable live movie search.`
    });
  } catch (err) {
    return res.status(500).json({ error: err.message, results: [] });
  }
}
