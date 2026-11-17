#!/usr/bin/env python3
"""
Media Log - Local Development Server
Provides static file serving and implements the /api/auth, /api/save-media,
and /api/search-media endpoints locally with direct disk sync to data/media-log.json.
Compatible with Python 3.8+ with zero external dependencies.
"""

import os
import sys
import json
import base64
import time
import socket
import urllib.request
import urllib.parse
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

# Load .env file if present
env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
if os.path.exists(env_path):
    with open(env_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())

PORT = int(os.environ.get("PORT", 3000))
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "Celluloid-35mm-Odyssey#24")
DATA_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "media-log.json")

# GitHub configuration (optional in local dev)
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "")
GITHUB_OWNER = os.environ.get("GITHUB_OWNER", "")
GITHUB_REPO = os.environ.get("GITHUB_REPO", "")
GITHUB_BRANCH = os.environ.get("GITHUB_BRANCH", "main")

# External API keys
TMDB_API_KEY = os.environ.get("TMDB_API_KEY", "")
OMDB_API_KEY = os.environ.get("OMDB_API_KEY", "")
RAWG_API_KEY = os.environ.get("RAWG_API_KEY", "")


def verify_token(auth_header):
    if not auth_header or not auth_header.startswith("Bearer "):
        return False
    token = auth_header[7:]
    try:
        decoded = base64.b64decode(token).decode("utf-8")
        parts = decoded.split(":")
        if len(parts) == 3 and parts[2] == "medialog-admin":
            expires_at = int(parts[1])
            if expires_at > (time.time() * 1000):
                return True
    except Exception:
        pass
    return False


class MediaLogHandler(SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def handle_one_request(self):
        try:
            super().handle_one_request()
        except (ConnectionResetError, ConnectionAbortedError, BrokenPipeError):
            self.close_connection = True

    def copyfile(self, source, outputfile):
        try:
            super().copyfile(source, outputfile)
        except (ConnectionResetError, ConnectionAbortedError, BrokenPipeError):
            pass

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path == "/api/search-media":
            self.handle_search_media(parsed.query)
            return

        # Default static file handler
        return super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        content_length = int(self.headers.get("Content-Length", 0))
        raw_body = self.rfile.read(content_length) if content_length > 0 else b"{}"
        
        try:
            body = json.loads(raw_body.decode("utf-8"))
        except Exception:
            body = {}

        if path == "/api/auth":
            self.handle_auth(body)
        elif path == "/api/save-media":
            self.handle_save_media(body)
        else:
            self.send_error(404, "Endpoint not found")

    def handle_auth(self, body):
        pwd = body.get("password", "")
        if not pwd:
            self.send_json(400, {"ok": False, "error": "Password required"})
            return

        if pwd == ADMIN_PASSWORD:
            now = int(time.time() * 1000)
            expires_at = now + (24 * 60 * 60 * 1000)
            token_payload = f"{now}:{expires_at}:medialog-admin"
            token = base64.b64encode(token_payload.encode("utf-8")).decode("utf-8")
            
            is_default = (ADMIN_PASSWORD == "admin123" and "ADMIN_PASSWORD" not in os.environ)
            self.send_json(200, {
                "ok": True,
                "token": f"Bearer {token}",
                "expiresAt": expires_at,
                "isDefaultPassword": is_default,
                "message": "Authenticated as Admin."
            })
        else:
            self.send_json(401, {
                "ok": False,
                "error": "Invalid password."
            })

    def handle_save_media(self, body):
        auth_header = self.headers.get("Authorization", "")
        if not verify_token(auth_header):
            self.send_json(401, {"ok": False, "error": "Unauthorized: Valid admin token required."})
            return

        action = body.get("action")
        item = body.get("item")
        target_id = body.get("id") or (item.get("id") if item else None)
        items = body.get("items")

        # Load existing data
        current_data = []
        if os.path.exists(DATA_FILE):
            try:
                with open(DATA_FILE, "r", encoding="utf-8") as f:
                    current_data = json.load(f)
            except Exception as e:
                print(f"Warning loading data file: {e}")
                current_data = []

        now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

        if action == "save" and item:
            existing_idx = next((i for i, m in enumerate(current_data) if m.get("id") == item.get("id")), -1)
            if existing_idx >= 0:
                current_data[existing_idx] = {**current_data[existing_idx], **item, "updatedAt": now_iso}
            else:
                new_item = {
                    **item,
                    "id": item.get("id") or f"item-{int(time.time() * 1000)}",
                    "createdAt": item.get("createdAt") or now_iso,
                    "updatedAt": now_iso
                }
                current_data.insert(0, new_item)
        elif action == "delete" and target_id:
            current_data = [m for m in current_data if m.get("id") != target_id]
        elif action == "replace" and isinstance(items, list):
            current_data = items
        else:
            self.send_json(400, {"ok": False, "error": "Invalid action or payload"})
            return

        # Write to disk
        try:
            os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
            with open(DATA_FILE, "w", encoding="utf-8") as f:
                json.dump(current_data, f, indent=2, ensure_ascii=False)
        except Exception as e:
            self.send_json(500, {"ok": False, "error": f"Failed writing to disk: {e}"})
            return

        # If GitHub credentials exist, sync to GitHub REST API as well
        synced_github = False
        commit_sha = None
        if GITHUB_TOKEN and GITHUB_OWNER and GITHUB_REPO:
            try:
                synced_github, commit_sha = self.commit_to_github(current_data, action, item, target_id)
            except Exception as e:
                print(f"GitHub sync notice: {e}")

        self.send_json(200, {
            "ok": True,
            "storage": "github" if synced_github else "local-file",
            "commitSha": commit_sha,
            "message": "Committed to GitHub!" if synced_github else "Saved directly to data/media-log.json",
            "data": current_data
        })

    def commit_to_github(self, data, action, item, target_id):
        # 1. Get SHA of existing file
        url = f"https://api.github.com/repos/{GITHUB_OWNER}/{GITHUB_REPO}/contents/data/media-log.json?ref={GITHUB_BRANCH}"
        req = urllib.request.Request(url, headers={
            "Authorization": f"Bearer {GITHUB_TOKEN}",
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "MediaLogApp/1.0"
        })
        file_sha = None
        try:
            with urllib.request.urlopen(req) as resp:
                res_data = json.loads(resp.read().decode())
                file_sha = res_data.get("sha")
        except urllib.error.HTTPError as e:
            if e.code != 404:
                raise e

        # 2. Commit update
        put_url = f"https://api.github.com/repos/{GITHUB_OWNER}/{GITHUB_REPO}/contents/data/media-log.json"
        content_bytes = json.dumps(data, indent=2, ensure_ascii=False).encode("utf-8")
        base64_content = base64.b64encode(content_bytes).decode("utf-8")
        
        msg = f"chore(media-log): update media [{action}]"
        if action == "save" and item:
            msg = f"feat(media-log): log {item.get('title', 'item')}"
        elif action == "delete":
            msg = f"chore(media-log): delete item {target_id}"

        payload = {
            "message": msg,
            "content": base64_content,
            "branch": GITHUB_BRANCH
        }
        if file_sha:
            payload["sha"] = file_sha

        put_req = urllib.request.Request(put_url, data=json.dumps(payload).encode("utf-8"), headers={
            "Authorization": f"Bearer {GITHUB_TOKEN}",
            "Accept": "application/vnd.github.v3+json",
            "Content-Type": "application/json",
            "User-Agent": "MediaLogApp/1.0"
        }, method="PUT")

        with urllib.request.urlopen(put_req) as resp:
            resp_data = json.loads(resp.read().decode())
            return True, resp_data.get("commit", {}).get("sha")

    def handle_search_media(self, query_string):
        params = urllib.parse.parse_qs(query_string)
        q = params.get("q", [""])[0].strip()
        mtype = params.get("type", ["movie"])[0].strip()

        if not q:
            self.send_json(200, {"results": []})
            return

        # Anime search via Jikan (and Kitsu fallback)
        if mtype == "anime":
            try:
                jikan_url = f"https://api.jikan.moe/v4/anime?q={urllib.parse.quote(q)}&limit=12&sfw=true"
                req = urllib.request.Request(jikan_url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
                with urllib.request.urlopen(req, timeout=4) as resp:
                    data = json.loads(resp.read().decode())
                    results = []
                    for item in data.get("data", []):
                        year = item.get("year")
                        if not year and item.get("aired", {}).get("from"):
                            year = item["aired"]["from"][:4]
                        images = item.get("images", {})
                        poster = (images.get("webp", {}).get("large_image_url") or
                                  images.get("jpg", {}).get("large_image_url") or
                                  images.get("jpg", {}).get("image_url") or "")
                        score = item.get("score")
                        results.append({
                            "id": f"mal-{item.get('mal_id')}",
                            "title": item.get("title_english") or item.get("title"),
                            "originalTitle": item.get("title"),
                            "type": "anime",
                            "releaseYear": int(year) if year else 2023,
                            "posterUrl": poster,
                            "externalScore": {"source": "MAL", "rating": str(score) if score else "N/A"},
                            "synopsis": item.get("synopsis") or "",
                            "genres": [g.get("name") for g in item.get("genres", [])]
                        })
                    if results:
                        self.send_json(200, {"results": results, "source": "jikan"})
                        return
            except Exception as e:
                print(f"Jikan server-side note: {e}")

            # Kitsu fallback
            try:
                kitsu_url = f"https://kitsu.io/api/edge/anime?filter[text]={urllib.parse.quote(q)}&page[limit]=10"
                req = urllib.request.Request(kitsu_url, headers={"Accept": "application/vnd.api+json", "User-Agent": "MediaLogApp/1.0"})
                with urllib.request.urlopen(req, timeout=4) as resp:
                    kdata = json.loads(resp.read().decode())
                    results = []
                    for a in kdata.get("data", []):
                        attr = a.get("attributes", {})
                        p = attr.get("posterImage", {})
                        poster = p.get("large") or p.get("original") or p.get("medium") or ""
                        sy = attr.get("startDate")
                        results.append({
                            "id": f"kitsu-{a.get('id')}",
                            "title": attr.get("canonicalTitle") or "Anime",
                            "type": "anime",
                            "releaseYear": int(sy[:4]) if sy and len(sy) >= 4 else 2023,
                            "posterUrl": poster,
                            "externalScore": {"source": "Kitsu", "rating": f"{float(attr.get('averageRating', 80))/10:.1f}/10" if attr.get("averageRating") else "N/A"},
                            "synopsis": attr.get("synopsis") or "",
                            "genres": ["Anime"]
                        })
                    if results:
                        self.send_json(200, {"results": results, "source": "kitsu"})
                        return
            except Exception as e:
                print(f"Kitsu server-side note: {e}")

        # TV Shows via TVMaze (Free & Keyless)
        if mtype == "tv":
            try:
                tv_url = f"https://api.tvmaze.com/search/shows?q={urllib.parse.quote(q)}"
                req = urllib.request.Request(tv_url, headers={"User-Agent": "Mozilla/5.0"})
                with urllib.request.urlopen(req, timeout=4) as resp:
                    data = json.loads(resp.read().decode())
                    results = []
                    for item in data:
                        show = item.get("show", {})
                        img = show.get("image") or {}
                        poster = img.get("original") or img.get("medium") or ""
                        prem = show.get("premiered")
                        year = int(prem[:4]) if prem and len(prem) >= 4 else None
                        rate = show.get("rating", {}).get("average")
                        results.append({
                            "id": f"tvmaze-{show.get('id')}",
                            "title": show.get("name"),
                            "type": "tv",
                            "releaseYear": year,
                            "posterUrl": poster,
                            "externalScore": {"source": "TVMaze", "rating": f"{rate}/10" if rate else "N/A"},
                            "genres": show.get("genres", ["Drama"]),
                            "synopsis": (show.get("summary", "") or "").replace("<p>", "").replace("</p>", "").replace("<b>", "").replace("</b>", "").strip()
                        })
                    if results:
                        self.send_json(200, {"results": results[:12], "source": "tvmaze"})
                        return
            except Exception as e:
                print(f"TVMaze error: {e}")

        # Movies & TV via TMDB
        if (mtype in ("movie", "tv")) and TMDB_API_KEY:
            try:
                tmdb_url = f"https://api.themoviedb.org/3/search/multi?api_key={TMDB_API_KEY}&query={urllib.parse.quote(q)}&include_adult=false"
                req = urllib.request.Request(tmdb_url)
                with urllib.request.urlopen(req, timeout=5) as resp:
                    data = json.loads(resp.read().decode())
                    results = []
                    for item in data.get("results", []):
                        if item.get("media_type") not in ("movie", "tv"):
                            continue
                        is_movie = item.get("media_type") == "movie"
                        title = item.get("title") if is_movie else item.get("name")
                        date_str = item.get("release_date") if is_movie else item.get("first_air_date")
                        year = int(date_str[:4]) if date_str and len(date_str) >= 4 else None
                        poster_path = item.get("poster_path")
                        poster = f"https://image.tmdb.org/t/p/w500{poster_path}" if poster_path else ""
                        vote = item.get("vote_average", 0)
                        results.append({
                            "id": f"tmdb-{item.get('id')}",
                            "title": title,
                            "type": "movie",
                            "releaseYear": year,
                            "posterUrl": poster,
                            "externalScore": {"source": "TMDB", "rating": f"{vote:.1f}/10" if vote else "N/A"},
                            "synopsis": item.get("overview", "")
                        })
                    self.send_json(200, {"results": results[:12], "source": "tmdb"})
                    return
            except Exception as e:
                print(f"TMDB error: {e}")

        # Games via RAWG (or Steam Store Search fallback - Free & keyless)
        if mtype == "game":
            if RAWG_API_KEY:
                try:
                    rawg_url = f"https://api.rawg.io/api/games?key={RAWG_API_KEY}&search={urllib.parse.quote(q)}&page_size=12"
                    req = urllib.request.Request(rawg_url)
                    with urllib.request.urlopen(req, timeout=5) as resp:
                        data = json.loads(resp.read().decode())
                        results = []
                        for item in data.get("results", []):
                            released = item.get("released")
                            year = int(released[:4]) if released and len(released) >= 4 else None
                            meta = item.get("metacritic")
                            results.append({
                                "id": f"rawg-{item.get('id')}",
                                "title": item.get("name"),
                                "type": "game",
                                "releaseYear": year,
                                "posterUrl": item.get("background_image", ""),
                                "externalScore": {"source": "Metacritic", "rating": str(meta) if meta else "N/A"},
                                "genres": [g.get("name") for g in item.get("genres", [])]
                            })
                        if results:
                            self.send_json(200, {"results": results, "source": "rawg"})
                            return
                except Exception as e:
                    print(f"RAWG error: {e}")

            # Live Steam Store Search (Official high-res 600x900 library capsule posters)
            try:
                steam_url = f"https://store.steampowered.com/api/storesearch/?term={urllib.parse.quote(q)}&l=english&cc=US"
                req = urllib.request.Request(steam_url, headers={"User-Agent": "Mozilla/5.0"})
                with urllib.request.urlopen(req, timeout=5) as resp:
                    data = json.loads(resp.read().decode())
                    results = []
                    for item in data.get("items", []):
                        app_id = item.get("id")
                        poster = f"https://cdn.akamai.steamstatic.com/steam/apps/{app_id}/library_600x900_2x.jpg"
                        meta = item.get("metascore")
                        results.append({
                            "id": f"steam-{app_id}",
                            "title": item.get("name"),
                            "type": "game",
                            "releaseYear": None,
                            "posterUrl": poster,
                            "externalScore": {"source": "Metacritic" if meta else "Steam", "rating": str(meta) if meta else "Verified"},
                            "platforms": ["PC"],
                            "genres": ["Video Game"],
                            "synopsis": f"Available on Steam (App ID: {app_id})."
                        })
                    if results:
                        self.send_json(200, {"results": results[:12], "source": "steam"})
                        return
            except Exception as e:
                print(f"Steam search error: {e}")

        # Books via OpenLibrary (no key needed)
        if mtype == "book":
            try:
                openlib_url = f"https://openlibrary.org/search.json?q={urllib.parse.quote(q)}&limit=10"
                req = urllib.request.Request(openlib_url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
                with urllib.request.urlopen(req, timeout=4) as resp:
                    data = json.loads(resp.read().decode())
                    results = []
                    for doc in data.get("docs", []):
                        cover_id = doc.get("cover_i")
                        poster = f"https://covers.openlibrary.org/b/id/{cover_id}-L.jpg" if cover_id else ""
                        authors = doc.get("author_name", [])
                        author = authors[0] if authors else "Unknown Author"
                        pages = doc.get("number_of_pages_median") or 350
                        year = doc.get("first_publish_year")
                        rating = doc.get("ratings_average")
                        results.append({
                            "id": f"book-{doc.get('key', '').replace('/', '-') or time.time()}",
                            "title": doc.get("title"),
                            "type": "book",
                            "releaseYear": year,
                            "posterUrl": poster,
                            "externalScore": {"source": "OpenLibrary", "rating": f"{rating:.1f}" if rating else "4.0"},
                            "author": author,
                            "pages": pages,
                            "bookDetails": {"author": author, "pages": pages, "format": "Paperback"},
                            "genres": doc.get("subject", [])[:3] if doc.get("subject") else ["Fiction"]
                        })
                    if results:
                        self.send_json(200, {"results": results, "source": "openlibrary"})
                        return
            except Exception as e:
                print(f"OpenLibrary note: {e}")

        # Fallback response (indicates client fallback should be used)
        self.send_json(200, {
            "results": [],
            "apiKeyMissing": True,
            "message": f"External API key for {mtype} not configured in environment. Client fallback active."
        })

    def send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


class DualStackServer(ThreadingHTTPServer):
    """Threading HTTPServer supporting both IPv4 and IPv6 dual-stack sockets."""
    address_family = socket.AF_INET6

    def server_bind(self):
        try:
            self.socket.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)
        except (AttributeError, OSError):
            pass
        super().server_bind()


if __name__ == "__main__":
    try:
        httpd = DualStackServer(("::", PORT), MediaLogHandler)
    except Exception as e:
        # Fallback to standard IPv4 if dual-stack is unavailable
        httpd = ThreadingHTTPServer(("", PORT), MediaLogHandler)
    
    httpd.daemon_threads = True
    print(f"=== Media Log Development Server Running ===")
    print(f"-> Local URL: http://localhost:{PORT}")
    print(f"-> Admin Password: {ADMIN_PASSWORD}")
    print(f"-> Data storage: {DATA_FILE}")
    print(f"-> GitHub sync: {'Configured' if GITHUB_TOKEN and GITHUB_OWNER and GITHUB_REPO else 'Disabled (Local disk mode)'}")
    print("Press Ctrl+C to stop.")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
        sys.exit(0)
