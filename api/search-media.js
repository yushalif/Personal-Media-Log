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

  const {
    TMDB_API_KEY,
    OMDB_API_KEY,
    RAWG_API_KEY
  } = process.env;

  try {
    // 1. ANIME (Jikan API - No key needed)
    if (type === 'anime') {
      const jikanUrl = `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=15&sfw=true`;
      const jikanRes = await fetch(jikanUrl, {
        headers: { 'User-Agent': 'MediaLogApp/1.0' }
      });

      if (jikanRes.ok) {
        const jikanData = await jikanRes.json();
        const results = (jikanData.data || []).map(item => {
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

    // 2. MOVIES & TV (TMDB + OMDb)
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

      // If OMDB key is available without TMDB:
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

    // 3. VIDEO GAMES (RAWG)
    if (type === 'game') {
      if (RAWG_API_KEY) {
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
          return res.status(200).json({ results, source: 'rawg' });
        }
      }
    }

    // Fallback: If external API keys are not provided yet in environment
    return res.status(200).json({
      results: [],
      apiKeyMissing: true,
      message: `API key for ${type} is not configured in .env. Use client fallback or add keys.`
    });
  } catch (err) {
    return res.status(500).json({ error: err.message, results: [] });
  }
}
