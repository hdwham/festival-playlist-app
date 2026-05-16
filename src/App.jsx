import { useState, useEffect } from "react";
import lineup from "./lineup.json";

const CLIENT_ID = "40f2e99c46024d56a243727dbb07ffb4";
const REDIRECT_URI = "https://festival-playlist-app-phi.vercel.app/callback";
const SCOPES = "user-library-read user-top-read playlist-modify-public playlist-modify-private";

const COLORS = ["#FF6B6B","#FFD93D","#6BCB77","#4D96FF","#FF6FC8","#FF9F1C","#A78BFA","#34D399"];

async function generateCodeChallenge(codeVerifier) {
  const data = new TextEncoder().encode(codeVerifier);
  const digest = await window.crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function generateRandomString(length) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
}

async function fetchWithToken(url, token) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  return res.json();
}

async function fetchAllSavedTracks(token) {
  try {
    const first = await fetchWithToken("https://api.spotify.com/v1/me/tracks?limit=50", token);
    if (!first || !first.items) return [];
    const offsets = [];
    for (let i = 50; i < first.total; i += 50) offsets.push(i);
    const pages = await Promise.all(offsets.map(o =>
      fetchWithToken(`https://api.spotify.com/v1/me/tracks?limit=50&offset=${o}`, token).catch(() => ({ items: [] }))
    ));
    return [...first.items, ...pages.flatMap(p => p.items || [])];
  } catch { return []; }
}

async function fetchAllPlaylistTracks(token, userId) {
  try {
    const data = await fetchWithToken("https://api.spotify.com/v1/me/playlists?limit=50", token);
    if (!data?.items) return [];
    const mine = data.items.filter(p => p.owner.id === userId);
    const results = await Promise.all(mine.map(async p => {
      try {
        const res = await fetch(`https://api.spotify.com/v1/playlists/${p.id}/tracks?limit=100`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) return [];
        const d = await res.json();
        return d.items?.filter(i => i?.track) || [];
      } catch { return []; }
    }));
    return results.flat();
  } catch { return []; }
}

function buildArtistMap(tracks) {
  const map = {};
  tracks.forEach(item => {
    if (!item.track) return;
    item.track.artists.forEach(artist => {
      const name = artist.name.toLowerCase();
      if (!map[name]) map[name] = { songs: [], uris: [] };
      if (!map[name].uris.includes(item.track.uri)) {
        map[name].songs.push(item.track.name);
        map[name].uris.push(item.track.uri);
      }
    });
  });
  return map;
}

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;500;600&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: #0a0a0a;
    color: #fff;
    font-family: 'DM Sans', sans-serif;
    min-height: 100vh;
  }

  .hero {
    text-align: center;
    padding: 60px 20px 40px;
    position: relative;
    overflow: hidden;
  }

  .hero::before {
    content: '';
    position: absolute;
    top: -100px; left: -100px; right: -100px; bottom: -100px;
    background: radial-gradient(ellipse at 20% 50%, #FF6B6B22 0%, transparent 50%),
                radial-gradient(ellipse at 80% 20%, #4D96FF22 0%, transparent 50%),
                radial-gradient(ellipse at 60% 80%, #FFD93D22 0%, transparent 50%);
    pointer-events: none;
  }

  .festival-title {
    font-family: 'Bebas Neue', sans-serif;
    font-size: clamp(48px, 10vw, 100px);
    line-height: 0.9;
    letter-spacing: 2px;
    background: linear-gradient(135deg, #FF6B6B, #FFD93D, #6BCB77, #4D96FF);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    margin-bottom: 8px;
  }

  .festival-year {
    font-family: 'Bebas Neue', sans-serif;
    font-size: clamp(20px, 4vw, 36px);
    letter-spacing: 8px;
    color: #ffffff88;
    margin-bottom: 16px;
  }

  .festival-location {
    font-size: 13px;
    letter-spacing: 4px;
    text-transform: uppercase;
    color: #ffffff44;
    margin-bottom: 40px;
  }

  .connect-btn {
    background: #1DB954;
    color: #000;
    border: none;
    padding: 16px 36px;
    border-radius: 50px;
    font-family: 'DM Sans', sans-serif;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    letter-spacing: 0.5px;
    transition: transform 0.15s, box-shadow 0.15s;
    box-shadow: 0 0 30px #1DB95444;
  }

  .connect-btn:hover { transform: scale(1.04); box-shadow: 0 0 40px #1DB95466; }
  .connect-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }

  .connected-badge {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    background: #ffffff10;
    border: 1px solid #ffffff20;
    padding: 10px 20px;
    border-radius: 50px;
    font-size: 14px;
    color: #ffffffbb;
    margin-bottom: 16px;
  }

  .connected-badge strong { color: #1DB954; }

  .find-btn {
    background: #fff;
    color: #000;
    border: none;
    padding: 14px 32px;
    border-radius: 50px;
    font-family: 'DM Sans', sans-serif;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: transform 0.15s, background 0.15s;
    display: block;
    margin: 12px auto 0;
  }

  .find-btn:hover { transform: scale(1.04); background: #f0f0f0; }
  .find-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

  .results-section {
    max-width: 900px;
    margin: 0 auto;
    padding: 0 20px 60px;
  }

  .stats-bar {
    text-align: center;
    margin-bottom: 40px;
    padding: 30px;
    background: #ffffff08;
    border: 1px solid #ffffff15;
    border-radius: 20px;
  }

  .stats-bar h2 {
    font-family: 'Bebas Neue', sans-serif;
    font-size: clamp(28px, 5vw, 48px);
    letter-spacing: 2px;
    background: linear-gradient(90deg, #FF6B6B, #FFD93D);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    margin-bottom: 8px;
  }

  .stats-sub { color: #ffffff55; font-size: 13px; letter-spacing: 2px; text-transform: uppercase; }

  .playlist-btn {
    background: #1DB954;
    color: #000;
    border: none;
    padding: 14px 28px;
    border-radius: 50px;
    font-family: 'DM Sans', sans-serif;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    margin-top: 20px;
    transition: transform 0.15s;
    display: inline-block;
    text-decoration: none;
  }

  .playlist-btn:hover { transform: scale(1.04); }
  .playlist-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

  .day-section { margin-bottom: 48px; }

  .day-label {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 13px;
    letter-spacing: 6px;
    color: #ffffff44;
    text-transform: uppercase;
    margin-bottom: 16px;
    padding-bottom: 10px;
    border-bottom: 1px solid #ffffff10;
  }

  .artist-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 12px;
  }

  .artist-card {
    border-radius: 16px;
    padding: 18px;
    position: relative;
    overflow: hidden;
    transition: transform 0.2s;
    cursor: default;
  }

  .artist-card:hover { transform: translateY(-3px); }

  .artist-card-name {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 22px;
    letter-spacing: 1px;
    line-height: 1.1;
    margin-bottom: 10px;
    color: #000;
  }

  .song-count-badge {
    display: inline-block;
    background: #00000025;
    color: #000;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 1px;
    padding: 3px 10px;
    border-radius: 20px;
    margin-bottom: 10px;
    text-transform: uppercase;
  }

  .song-list {
    font-size: 11px;
    color: #00000077;
    line-height: 1.6;
  }

  .song-list span { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  .headliner-star {
    position: absolute;
    top: 12px; right: 14px;
    font-size: 16px;
    opacity: 0.5;
  }

  .full-lineup-section {
    max-width: 900px;
    margin: 0 auto;
    padding: 0 20px 80px;
  }

  .section-title {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 13px;
    letter-spacing: 6px;
    color: #ffffff33;
    text-transform: uppercase;
    margin-bottom: 24px;
  }

  .lineup-day { margin-bottom: 36px; }

  .lineup-day-label {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 11px;
    letter-spacing: 5px;
    color: #ffffff33;
    margin-bottom: 12px;
  }

  .lineup-artists {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .lineup-pill {
    padding: 6px 14px;
    border-radius: 50px;
    font-size: 13px;
    font-weight: 500;
    border: 1px solid #ffffff15;
    background: #ffffff08;
    color: #ffffff66;
    transition: all 0.2s;
  }

  .lineup-pill.matched {
    border-color: #1DB95444;
    background: #1DB95415;
    color: #1DB954;
  }

  .lineup-pill.headliner {
    font-size: 15px;
    font-weight: 600;
    color: #ffffffcc;
    border-color: #ffffff30;
    background: #ffffff12;
  }

  .lineup-pill.headliner.matched {
    color: #6BCB77;
    border-color: #6BCB7766;
    background: #6BCB7715;
  }

  .loading-text {
    text-align: center;
    padding: 20px;
    color: #ffffff55;
    font-size: 13px;
    letter-spacing: 3px;
    text-transform: uppercase;
    animation: pulse 1.5s ease-in-out infinite;
  }

  @keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }

  .divider {
    border: none;
    border-top: 1px solid #ffffff08;
    margin: 48px auto;
    max-width: 900px;
  }
`;

export default function App() {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [matches, setMatches] = useState({});
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [playlistUrl, setPlaylistUrl] = useState(null);
  const [playlistLoading, setPlaylistLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code) { exchangeToken(code); window.history.replaceState({}, document.title, "/"); }
  }, []);

  async function exchangeToken(code) {
    const verifier = localStorage.getItem("code_verifier");
    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: CLIENT_ID, grant_type: "authorization_code", code, redirect_uri: REDIRECT_URI, code_verifier: verifier }),
    });
    const data = await res.json();
    if (data.access_token) { setToken(data.access_token); localStorage.setItem("access_token", data.access_token); }
  }

  useEffect(() => {
    if (!token) return;
    fetchWithToken("https://api.spotify.com/v1/me", token).then(setUser);
  }, [token]);

  async function findMyArtists() {
    setLoading(true); setPlaylistUrl(null);
    setLoadingMessage("Scanning liked songs...");
    const liked = await fetchAllSavedTracks(token);
    setLoadingMessage("Scanning your playlists...");
    const playlist = await fetchAllPlaylistTracks(token, user.id);
    setLoadingMessage("Finding matches...");
    const artistMap = buildArtistMap([...liked, ...playlist]);
    const found = {};
    lineup.forEach(artist => {
      const key = artist.name.toLowerCase();
      const vars = [key, key.replace(" and ", " & "), key.replace(" & ", " and "), key.split("(")[0].trim()];
      for (const v of vars) {
        if (artistMap[v]) { found[artist.name] = { ...artistMap[v], day: artist.day, headliner: artist.headliner }; break; }
      }
    });
    setMatches(found); setLoading(false); setLoadingMessage("");
  }

  async function buildPlaylist() {
    setPlaylistLoading(true);
    const allUris = Object.values(matches).flatMap(m => m.uris);
    const createRes = await fetch("https://api.spotify.com/v1/me/playlists", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "My BottleRock 2026", description: "Songs from my library by artists playing BottleRock 2026", public: false })
    });
    const playlist = await createRes.json();
    for (let i = 0; i < allUris.length; i += 100) {
      await fetch(`https://api.spotify.com/v1/playlists/${playlist.id}/tracks`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ uris: allUris.slice(i, i + 100) })
      });
    }
    setPlaylistUrl(playlist.external_urls?.spotify);
    setPlaylistLoading(false);
  }

  const matchCount = Object.keys(matches).length;
  const totalSongs = Object.values(matches).reduce((a, m) => a + m.songs.length, 0);

  return (
    <>
      <style>{styles}</style>

      <div className="hero">
        <div className="festival-title">BottleRock</div>
        <div className="festival-year">NAPA VALLEY · 2026</div>
        <div className="festival-location">May 22 – 24 · Napa, California</div>

        {!token ? (
          <button className="connect-btn" onClick={async () => {
            const verifier = generateRandomString(64);
            const challenge = await generateCodeChallenge(verifier);
            localStorage.setItem("code_verifier", verifier);
            window.location.href = `https://accounts.spotify.com/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(SCOPES)}&code_challenge=${challenge}&code_challenge_method=S256`;
          }}>
            Connect Spotify
          </button>
        ) : (
          <div>
            <div className="connected-badge">
              <span>✓</span>
              <span>Connected as <strong>{user?.display_name}</strong></span>
            </div>
            <button className="find-btn" onClick={findMyArtists} disabled={loading}>
              {loading ? loadingMessage : "Find My Artists"}
            </button>
          </div>
        )}
      </div>

      {loading && <div className="loading-text">{loadingMessage}</div>}

      {matchCount > 0 && (
        <div className="results-section">
          <div className="stats-bar">
            <h2>You know {matchCount} artists · {totalSongs} songs</h2>
            <div className="stats-sub">from your Spotify library</div>
            {!playlistUrl ? (
              <button className="playlist-btn" onClick={buildPlaylist} disabled={playlistLoading}>
                {playlistLoading ? "Building..." : "🎵 Build My BottleRock 2026 Playlist"}
              </button>
            ) : (
              <a className="playlist-btn" href={playlistUrl} target="_blank" rel="noreferrer">
                ✅ Open Playlist in Spotify →
              </a>
            )}
          </div>

          {["Friday", "Saturday", "Sunday"].map((day, di) => {
            const dayMatches = Object.entries(matches).filter(([, v]) => v.day === day);
            if (!dayMatches.length) return null;
            return (
              <div className="day-section" key={day}>
                <div className="day-label">{day}</div>
                <div className="artist-grid">
                  {dayMatches.map(([name, info], i) => {
                    const color = COLORS[(di * 3 + i) % COLORS.length];
                    return (
                      <div className="artist-card" key={name} style={{ background: color }}>
                        {info.headliner && <span className="headliner-star">★</span>}
                        <div className="artist-card-name">{name}</div>
                        <div className="song-count-badge">{info.songs.length} song{info.songs.length !== 1 ? "s" : ""}</div>
                        <div className="song-list">
                          {info.songs.slice(0, 4).map((s, si) => <span key={si}>{s}</span>)}
                          {info.songs.length > 4 && <span>+{info.songs.length - 4} more</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <hr className="divider" />

      <div className="full-lineup-section">
        <div className="section-title">Full Lineup</div>
        {["Friday", "Saturday", "Sunday"].map(day => (
          <div className="lineup-day" key={day}>
            <div className="lineup-day-label">{day}</div>
            <div className="lineup-artists">
              {lineup.filter(a => a.day === day).map(artist => (
                <div key={artist.name} className={`lineup-pill ${artist.headliner ? "headliner" : ""} ${matches[artist.name] ? "matched" : ""}`}>
                  {artist.name}{matches[artist.name] ? " ✓" : ""}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}