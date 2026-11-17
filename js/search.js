/**
 * Media Log - Unified External Media Search Module
 * Integrates:
 * - Movies & TV: TMDB / OMDb (with rich client fallback catalog)
 * - Anime: Jikan API (MyAnimeList - No API key required)
 * - Video Games: RAWG via /api/search-media (with rich client fallback catalog)
 * - Books: OpenLibrary API (No API key required) + rich fallback catalog
 */

// Curated anime fallback catalog
const FALLBACK_ANIME = [
  {
    id: "mal-199",
    title: "Spirited Away",
    originalTitle: "Sen to Chihiro no Kamikakushi",
    type: "anime",
    releaseYear: 2001,
    posterUrl: "https://cdn.myanimelist.net/images/anime/4/75923l.jpg",
    externalScore: { source: "MAL", rating: "8.53" },
    synopsis: "Stubborn, spoiled, and naive, 10-year-old Chihiro Ogino discovers an abandoned amusement park on the way to their new house.",
    genres: ["Animation", "Fantasy", "Adventure"]
  },
  {
    id: "mal-52991",
    title: "Frieren: Beyond Journey's End",
    originalTitle: "Sousou no Frieren",
    type: "anime",
    releaseYear: 2023,
    posterUrl: "https://cdn.myanimelist.net/images/anime/1015/138006l.jpg",
    externalScore: { source: "MAL", rating: "9.35" },
    synopsis: "During their decade-long quest, members of the hero's party defeated the Demon King and brought peace to the realm.",
    genres: ["Adventure", "Drama", "Fantasy"]
  },
  {
    id: "mal-42310",
    title: "Cyberpunk: Edgerunners",
    originalTitle: "Cyberpunk: Edgerunners",
    type: "anime",
    releaseYear: 2022,
    posterUrl: "https://cdn.myanimelist.net/images/anime/1860/126206l.jpg",
    externalScore: { source: "MAL", rating: "8.61" },
    synopsis: "In a dystopia riddled with corruption and cybernetic implants, a talented street kid named David strives to become an edgerunner.",
    genres: ["Action", "Sci-Fi"]
  },
  {
    id: "mal-32281",
    title: "Your Name (Kimi no Na wa)",
    originalTitle: "Kimi no Na wa.",
    type: "anime",
    releaseYear: 2016,
    posterUrl: "https://cdn.myanimelist.net/images/anime/5/87048l.jpg",
    externalScore: { source: "MAL", rating: "8.84" },
    synopsis: "Mitsuha Miyamizu, a high school girl, yearns to live the life of a boy in the bustling city of Tokyo.",
    genres: ["Romance", "Drama", "Supernatural"]
  },
  {
    id: "mal-16498",
    title: "Attack on Titan",
    originalTitle: "Shingeki no Kyojin",
    type: "anime",
    releaseYear: 2013,
    posterUrl: "https://cdn.myanimelist.net/images/anime/10/47347l.jpg",
    externalScore: { source: "MAL", rating: "8.55" },
    synopsis: "Young Eren Jaeger vows to cleanse the earth of the giant humanoid Titans.",
    genres: ["Action", "Suspense"]
  },
  {
    id: "mal-5114",
    title: "Fullmetal Alchemist: Brotherhood",
    originalTitle: "Hagane no Renkinjutsushi",
    type: "anime",
    releaseYear: 2009,
    posterUrl: "https://cdn.myanimelist.net/images/anime/1223/96541l.jpg",
    externalScore: { source: "MAL", rating: "9.10" },
    synopsis: "Two brothers search for a Philosopher's Stone after an attempt to revive their deceased mother goes wrong.",
    genres: ["Action", "Adventure", "Drama"]
  }
];

// Curated movie fallback catalog
const FALLBACK_MOVIES = [
  {
    title: "Interstellar",
    type: "movie",
    releaseYear: 2014,
    posterUrl: "https://m.media-amazon.com/images/M/MV5BYzdjMDAxZGItMjI2My00ODA1LTlkNzItOWFjMDU5ZDJlYWY3XkEyXkFqcGc@._V1_SX300.jpg",
    externalScore: { source: "IMDb", rating: "8.7" },
    genres: ["Sci-Fi", "Drama", "Adventure"],
    synopsis: "A farmer and ex-NASA pilot is tasked to pilot a spacecraft along with a team of researchers to find a new planet."
  },
  {
    title: "Dune: Part Two",
    type: "movie",
    releaseYear: 2024,
    posterUrl: "https://m.media-amazon.com/images/M/MV5BNTc0YmQxMjEtODI5MC00NjFiLTlkMWUtOGQ5NjFmYWUyZGJhXkEyXkFqcGc@._V1_SX300.jpg",
    externalScore: { source: "IMDb", rating: "8.6" },
    genres: ["Sci-Fi", "Action", "Adventure"],
    synopsis: "Paul Atreides unites with Chani and the Fremen while seeking revenge against conspirators."
  },
  {
    title: "Past Lives",
    type: "movie",
    releaseYear: 2023,
    posterUrl: "https://m.media-amazon.com/images/M/MV5BOTkzYmMxNTItZDA2NC00NGM0LWIyODMtMWYzMzRkMjIyMTE1XkEyXkFqcGc@._V1_SX300.jpg",
    externalScore: { source: "IMDb", rating: "7.8" },
    genres: ["Romance", "Drama"],
    synopsis: "Two deeply connected childhood friends are wrest apart after Nora's family emigrates from South Korea."
  },
  {
    title: "Blade Runner 2049",
    type: "movie",
    releaseYear: 2017,
    posterUrl: "https://m.media-amazon.com/images/M/MV5BNzA1Njg4NzYxOV5BMl5BanBnXkFtZTgwODk5NjU3MzI@._V1_SX300.jpg",
    externalScore: { source: "IMDb", rating: "8.0" },
    genres: ["Sci-Fi", "Action", "Drama"],
    synopsis: "Young Blade Runner K tracks down former Blade Runner Rick Deckard."
  },
  {
    title: "Arcane",
    type: "tv",
    releaseYear: 2021,
    posterUrl: "https://m.media-amazon.com/images/M/MV5BYzA2Nzk5MTAtNGYwNi00MmFiLWE0OGYtNDQyMmVhMjBkZTgwXkEyXkFqcGc@._V1_SX300.jpg",
    externalScore: { source: "IMDb", rating: "9.0" },
    genres: ["Animation", "Action", "Sci-Fi"],
    synopsis: "Set in utopian Piltover and the oppressed underground of Zaun."
  },
  {
    title: "Severance",
    type: "tv",
    releaseYear: 2022,
    posterUrl: "https://m.media-amazon.com/images/M/MV5BMjA3Njg0NTk4NF5BMl5BanBnXkFtZTgwNTU5Njg1MDE@._V1_SX300.jpg",
    externalScore: { source: "IMDb", rating: "8.7" },
    genres: ["Sci-Fi", "Thriller", "Drama"],
    synopsis: "Office workers whose memories have been surgically divided between their work and personal lives."
  },
  {
    title: "Breaking Bad",
    type: "tv",
    releaseYear: 2008,
    posterUrl: "https://m.media-amazon.com/images/M/MV5BMzU5ZGYzNmQtMTdhYy00OGRiLTg0NmQtYjVjNzliZTg1ZGE4XkEyXkFqcGc@._V1_SX300.jpg",
    externalScore: { source: "IMDb", rating: "9.5" },
    genres: ["Crime", "Drama", "Thriller"],
    synopsis: "A high school chemistry teacher diagnosed with inoperable lung cancer turns to manufacturing methamphetamine."
  }
];

// Curated games fallback catalog
const FALLBACK_GAMES = [
  {
    title: "DOOM Eternal",
    type: "game",
    releaseYear: 2020,
    posterUrl: "https://cdn.akamai.steamstatic.com/steam/apps/782330/library_600x900_2x.jpg",
    externalScore: { source: "Metacritic", rating: "88" },
    genres: ["Action", "FPS", "Sci-Fi"],
    platforms: ["PC", "PlayStation 5", "Xbox Series S/X"]
  },
  {
    title: "DOOM (2016)",
    type: "game",
    releaseYear: 2016,
    posterUrl: "https://cdn.akamai.steamstatic.com/steam/apps/379720/library_600x900_2x.jpg",
    externalScore: { source: "Metacritic", rating: "85" },
    genres: ["Action", "FPS", "Sci-Fi"],
    platforms: ["PC", "PlayStation 4", "Xbox One"]
  },
  {
    title: "Elden Ring",
    type: "game",
    releaseYear: 2022,
    posterUrl: "https://cdn.akamai.steamstatic.com/steam/apps/1245620/library_600x900_2x.jpg",
    externalScore: { source: "Metacritic", rating: "96" },
    genres: ["Action", "RPG", "Fantasy"],
    platforms: ["PC", "PlayStation 5", "Xbox Series S/X"]
  },
  {
    title: "Baldur's Gate 3",
    type: "game",
    releaseYear: 2023,
    posterUrl: "https://cdn.akamai.steamstatic.com/steam/apps/1086940/library_600x900_2x.jpg",
    externalScore: { source: "Metacritic", rating: "96" },
    genres: ["RPG", "Fantasy", "Action"],
    platforms: ["PC", "PlayStation 5", "Xbox Series S/X"]
  },
  {
    title: "Hollow Knight",
    type: "game",
    releaseYear: 2017,
    posterUrl: "https://cdn.akamai.steamstatic.com/steam/apps/367520/library_600x900_2x.jpg",
    externalScore: { source: "Metacritic", rating: "90" },
    genres: ["Action", "Adventure", "Platformer"],
    platforms: ["PC", "Nintendo Switch", "PlayStation 4"]
  },
  {
    title: "Cyberpunk 2077",
    type: "game",
    releaseYear: 2020,
    posterUrl: "https://cdn.akamai.steamstatic.com/steam/apps/1091500/library_600x900_2x.jpg",
    externalScore: { source: "Metacritic", rating: "86" },
    genres: ["RPG", "Action", "Sci-Fi"],
    platforms: ["PC", "PlayStation 5", "Xbox Series S/X"]
  }
];

// Curated books fallback catalog
const FALLBACK_BOOKS = [
  {
    title: "Dune",
    type: "book",
    releaseYear: 1965,
    posterUrl: "https://covers.openlibrary.org/b/id/11153217-L.jpg",
    externalScore: { source: "Goodreads", rating: "4.26" },
    author: "Frank Herbert",
    pages: 688,
    genres: ["Sci-Fi", "Adventure", "Philosophy"],
    synopsis: "Set on the desert planet Arrakis, Dune tells the story of Paul Atreides and the battle for the universe's most vital spice."
  },
  {
    title: "Project Hail Mary",
    type: "book",
    releaseYear: 2021,
    posterUrl: "https://covers.openlibrary.org/b/id/10522030-L.jpg",
    externalScore: { source: "Goodreads", rating: "4.52" },
    author: "Andy Weir",
    pages: 496,
    genres: ["Sci-Fi", "Adventure"],
    synopsis: "Ryland Grace is the sole survivor on a desperate, last-chance mission to save humanity from an extinction-level catastrophe."
  },
  {
    title: "Tomorrow, and Tomorrow, and Tomorrow",
    type: "book",
    releaseYear: 2022,
    posterUrl: "https://covers.openlibrary.org/b/id/12716104-L.jpg",
    externalScore: { source: "Goodreads", rating: "4.18" },
    author: "Gabrielle Zevin",
    pages: 416,
    genres: ["Fiction", "Drama", "Romance"],
    synopsis: "Two friends, often in love, but never lovers, become creative partners and create blockbuster video games."
  },
  {
    title: "The Way of Kings",
    type: "book",
    releaseYear: 2010,
    posterUrl: "https://covers.openlibrary.org/b/id/12863795-L.jpg",
    externalScore: { source: "Goodreads", rating: "4.66" },
    author: "Brandon Sanderson",
    pages: 1007,
    genres: ["Fantasy", "Epic"],
    synopsis: "Roshar is a world of stone and storms. War rages on the Shattered Plains as ancient Radiants begin to awaken."
  },
  {
    title: "1984",
    type: "book",
    releaseYear: 1949,
    posterUrl: "https://covers.openlibrary.org/b/id/7222246-L.jpg",
    externalScore: { source: "Goodreads", rating: "4.19" },
    author: "George Orwell",
    pages: 328,
    genres: ["Dystopian", "Sci-Fi", "Classics"],
    synopsis: "Winston Smith lives in a society of total surveillance under the watchful gaze of Big Brother."
  },
  {
    title: "Neuromancer",
    type: "book",
    releaseYear: 1984,
    posterUrl: "https://covers.openlibrary.org/b/id/8235116-L.jpg",
    externalScore: { source: "Goodreads", rating: "3.91" },
    author: "William Gibson",
    pages: 271,
    genres: ["Cyberpunk", "Sci-Fi"],
    synopsis: "Case was the sharpest data-thief in the matrix, until ex-employers crippled his nervous system."
  }
];

export const searchService = {
  async search(query, category = 'movie') {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    // 1. ANIME (Jikan API - MyAnimeList)
    if (category === 'anime') {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2500);

        const jikanUrl = `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=12&sfw=true`;
        const res = await fetch(jikanUrl, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.data) && data.data.length > 0) {
            return data.data.map(item => {
              const year = item.year || (item.aired?.from ? new Date(item.aired.from).getFullYear() : 2023);
              const poster = item.images?.webp?.large_image_url || item.images?.jpg?.large_image_url || item.images?.jpg?.image_url || '';
              return {
                id: `mal-${item.mal_id}`,
                title: item.title_english || item.title,
                originalTitle: item.title,
                type: 'anime',
                releaseYear: year,
                posterUrl: poster,
                externalScore: {
                  source: 'MAL',
                  rating: item.score ? String(item.score) : 'N/A'
                },
                synopsis: item.synopsis || '',
                genres: (item.genres || []).map(g => g.name)
              };
            });
          }
        }
      } catch (err) {
        console.warn('Jikan API unreachable, using fallback catalog:', err.message);
      }

      const animeMatches = FALLBACK_ANIME.filter(a => 
        a.title.toLowerCase().includes(q) || (a.originalTitle && a.originalTitle.toLowerCase().includes(q))
      );
      if (animeMatches.length > 0) return animeMatches;

      return [
        {
          id: `custom-anime-${Date.now()}`,
          title: query,
          type: 'anime',
          releaseYear: new Date().getFullYear(),
          posterUrl: '',
          externalScore: { source: 'MAL', rating: 'N/A' },
          synopsis: `Custom anime entry for "${query}".`
        },
        ...FALLBACK_ANIME.slice(0, 3)
      ];
    }

    // 2. BOOKS (OpenLibrary API - Free, no key required)
    if (category === 'book') {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        const openLibUrl = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=10`;
        const res = await fetch(openLibUrl, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.docs) && data.docs.length > 0) {
            return data.docs.map(doc => {
              const coverId = doc.cover_i;
              const poster = coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : '';
              const author = Array.isArray(doc.author_name) ? doc.author_name[0] : (doc.author_name || 'Unknown Author');
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
                genres: doc.subject ? doc.subject.slice(0, 3) : ["Fiction"],
                synopsis: `By ${author}. First published in ${year || 'N/A'}.`
              };
            });
          }
        }
      } catch (err) {
        console.warn('OpenLibrary API error, using fallback books:', err.message);
      }

      const bookMatches = FALLBACK_BOOKS.filter(b => 
        b.title.toLowerCase().includes(q) || (b.author && b.author.toLowerCase().includes(q))
      );
      if (bookMatches.length > 0) return bookMatches;

      return [
        {
          id: `custom-book-${Date.now()}`,
          title: query,
          type: 'book',
          releaseYear: new Date().getFullYear(),
          posterUrl: '',
          externalScore: { source: 'Goodreads', rating: 'N/A' },
          author: 'Author Name',
          pages: 350,
          bookDetails: { author: 'Author Name', pages: 350, format: 'Paperback' },
          synopsis: `Custom book entry for "${query}".`
        },
        ...FALLBACK_BOOKS.slice(0, 3)
      ];
    }

    // 3. Try backend API for Movies / TV / Games
    try {
      const res = await fetch(`/api/search-media?type=${category}&q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.results) && data.results.length > 0) {
          return data.results;
        }
      }
    } catch (apiErr) {
      // Backend not running or static preview
    }

    // 4. Movies & TV Fallback
    if (category === 'movie' || category === 'tv') {
      const matches = FALLBACK_MOVIES.filter(m => 
        m.title.toLowerCase().includes(q) || (m.synopsis && m.synopsis.toLowerCase().includes(q))
      );
      if (matches.length > 0) return matches;

      return [
        {
          id: `custom-movie-${Date.now()}`,
          title: query,
          type: category === 'tv' ? 'tv' : 'movie',
          releaseYear: new Date().getFullYear(),
          posterUrl: '',
          externalScore: { source: 'IMDb', rating: 'N/A' },
          synopsis: `Custom entry for "${query}".`
        },
        ...FALLBACK_MOVIES.slice(0, 3)
      ];
    }

    // 5. Games Fallback
    if (category === 'game') {
      const matches = FALLBACK_GAMES.filter(g => g.title.toLowerCase().includes(q));
      if (matches.length > 0) return matches;

      return [
        {
          id: `custom-game-${Date.now()}`,
          title: query,
          type: 'game',
          releaseYear: new Date().getFullYear(),
          posterUrl: '',
          externalScore: { source: 'Metacritic', rating: 'N/A' },
          platforms: ["PC", "Console"],
          synopsis: `Custom game entry for "${query}".`
        },
        ...FALLBACK_GAMES.slice(0, 3)
      ];
    }

    return [];
  }
};
