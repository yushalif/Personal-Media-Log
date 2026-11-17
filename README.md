# ✦ Media Log — Personal Distraction-Free Media Tracker

A complete, responsive, single-user personal media tracking web application for **Movies & TV**, **Anime**, and **Video Games** with a clean, dark-mode, distraction-free UI.

---

## 🌟 Key Features

### 1. Databaseless Storage & Git-as-a-Backend
- **Zero SQL / NoSQL database overhead:** All entries are stored in a single [`data/media-log.json`](data/media-log.json) file inside the Git repository.
- **Public Read Flow:** Public visitors load `data/media-log.json` in read-only mode to browse, search, filter, and view personal metrics.
- **Admin Write Flow:** Adding, editing, or deleting an entry triggers `/api/save-media`, which commits the updated JSON array directly to the GitHub repository using the GitHub Contents REST API (`PUT /repos/{owner}/{repo}/contents/data/media-log.json`).
- **Local / Preview Fallback:** Works immediately out-of-the-box before GitHub credentials are configured. In local dev, it writes straight to disk `data/media-log.json`; in static preview, it seamlessly syncs with `localStorage`.

### 2. Single-User Admin Authentication
- Public visitors can browse, inspect ratings, and view stats without registering.
- Clicking the subtle **Admin (🔒)** button in the navbar opens an authentication modal.
- Verifies against the `ADMIN_PASSWORD` environment variable (default: `Celluloid-35mm-Odyssey#24` for local dev) via `/api/auth`.
- Authenticated state unlocks `+ Add Media`, external search result `+ ADD TO LOG` buttons, and `Edit` / `Delete` actions on media cards.

### 3. Unified External Media Search
- Real-time search across three entertainment mediums:
  - **Movies & TV:** Queries **TMDB API** for posters, overviews, and release dates, and **OMDb API** for IMDb / Rotten Tomatoes ratings.
  - **Anime:** Direct integration with **Jikan API (MyAnimeList)** for anime covers, MAL scores, genres, and synopsis (**no API key required**).
  - **Video Games:** Queries **RAWG API** for high-res cover art, platforms, and Metacritic scores.
- Includes a smart client fallback catalog so you can search and test immediately even before setting up API keys, plus a manual **"+ Add Custom Media"** option.

### 4. Custom Personal Logging Metrics
Structured logging modal captures unique personal data:
- **Status:** `Completed`, `In Progress`, `Plan to Watch/Play`, `Dropped`
- **Discovery Source:** `Self-discovery`, `Friend recommendation`, `YouTube / TikTok`, `Reddit / Forum`, `Random browse`, `Other` + *Recommended by / Notes*
- **Social Context:** Multi-select tags (`Solo`, `With Family`, `With Friends`, `With Partner`)
- **Date Experienced:** Interactive date picker
- **1–5 Personal Metric Sliders / Selectors:**
  - `Favorite Level` (1–5 interactive star rating)
  - `Enjoyment` (1–5: *Regretted* → *Peak Fiction*)
  - `Memory Retention` ("How much do I remember?" 1–5: *Faded blur* → *Crystal clear photographic detail*)
  - `Yap Factor` ("How much do I talk about this?" 1–5: *Never mention* → *Unstoppable Yap God 🔥*)
- **Emotional Impact:** `Did I cry?` (💧 Interactive glowing toggle)
- **Game-Specific Fields** (dynamically shown for Video Games):
  - `Hours Played` (numeric input)
  - `Times Finished` (counter with `−` and `+` controls)
- **Personal Review & Notes:** Markdown-friendly notes textarea.

### 5. Dashboard, Filtering & Stats Bar
- **Top Stats Bar:** Live counters for Total Logged, Total Games Finished, Total Hours Played, Cry Count (Tear-jerkers), 5-Star Favorites, and Average Yap Factor.
- **Controls & Filters:**
  - Real-time instant search across titles, personal thoughts, and recommendation tags
  - Media type filters: `All`, `Movies & TV`, `Anime`, `Video Games`
  - Status filter: `Completed`, `In Progress`, etc.
  - `💧 Made Me Cry` instant filter toggle
  - Discovery Source filter
  - Sort by: `Date Experienced (Newest/Oldest)`, `Favorite Level`, `Yap Factor`, `Memory Retention`, `Hours Played`, `Title (A-Z)`
  - View modes: **Poster Grid** and **Compact List**.

---

## 📁 Project Structure

```text
Media Centre/
├── api/
│   ├── auth.js            # Vercel Serverless Function: validates ADMIN_PASSWORD
│   ├── save-media.js      # Serverless Function: commits to GitHub Contents REST API
│   └── search-media.js    # Serverless Function: proxies TMDB, OMDb, and RAWG APIs safely
├── css/
│   └── styles.css         # Dark-mode distraction-free design system
├── data/
│   └── media-log.json     # The single databaseless source of truth
├── js/
│   ├── api.js             # Data loading, GitHub API commit & localStorage fallback
│   ├── app.js             # Application controller, filters, sorting & event routing
│   ├── search.js          # Unified search (Jikan, TMDB, RAWG, and client fallbacks)
│   ├── stats.js           # Dashboard metrics & calculations
│   └── ui.js              # Modals, sliders, card rendering, and toast system
├── index.html             # Single-Page Application interface
├── server.py              # Zero-dependency local dev server (Python 3)
├── vercel.json            # Vercel serverless deployment routing
├── .env.example           # Environment template
└── README.md              # Documentation
```

---

## 🚀 Getting Started (Local Development)

### Prerequisites
- Python 3.8+ (standard installation) OR Deno / Node.js. Zero external dependencies required.

### 1. Clone & Enter Project Directory
```bash
cd "Media Centre"
```

### 2. Configure Environment (Optional for local dev)
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
*(If you don't create `.env`, the app defaults to `Celluloid-35mm-Odyssey#24` for the Admin password and saves data directly to `data/media-log.json` on disk).*

### 3. Start Local Server
Run with Python:
```bash
python server.py
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## ☁️ Deployment

### Deploy to Vercel (Recommended)
1. Push this repository to your GitHub account:
   ```bash
   git init
   git add .
   git commit -m "feat: initial commit of Media Log"
   git remote add origin https://github.com/<your-username>/<your-repo-name>.git
   git push -u origin main
   ```
2. Import the project into **[Vercel](https://vercel.com)**.
3. Under **Project Settings > Environment Variables**, add:
   - `ADMIN_PASSWORD`: Your secret admin password
   - `GITHUB_TOKEN`: A GitHub Personal Access Token (classic `repo` scope or fine-grained `Contents: Read and write`)
   - `GITHUB_OWNER`: Your GitHub username (e.g. `octocat`)
   - `GITHUB_REPO`: Your repository name (e.g. `media-log`)
   - `GITHUB_BRANCH`: `main`
   - `TMDB_API_KEY`: *(Optional)* Your TMDB API key
   - `OMDB_API_KEY`: *(Optional)* Your OMDb API key
   - `RAWG_API_KEY`: *(Optional)* Your RAWG API key
4. Deploy!
   - Public visitors will read `data/media-log.json` directly from the deployed assets.
   - When you log in with your Admin password and add/edit entries, `/api/save-media` commits updates directly back to GitHub!

---

## 🔑 Generating a GitHub Personal Access Token
To let the app commit updates to your repository:
1. Go to **GitHub Settings > Developer Settings > Personal Access Tokens > Tokens (classic)**.
2. Click **Generate new token**.
3. Select scope: **`repo`** (Full control of private repositories).
4. Copy the generated token (`ghp_...`) and paste it as `GITHUB_TOKEN` in your environment.

---

## 📄 License
MIT License. Free to use and customize for your personal media tracking!
