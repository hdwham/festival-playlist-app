import { useState, useEffect } from "react";
import lineup from "./lineup.json";

const CLIENT_ID = "40f2e99c46024d56a243727dbb07ffb4";
const REDIRECT_URI = "https://festival-playlist-app-phi.vercel.app/callback";
const SCOPES = "user-library-read user-top-read playlist-modify-public playlist-modify-private";

async function generateCodeChallenge(codeVerifier) {
  const data = new TextEncoder().encode(codeVerifier);
  const digest = await window.crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function generateRandomString(length) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function fetchWithToken(url, token) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  return res.json();
}

async function fetchAllSavedTracks(token) {
  const first = await fetchWithToken("https://api.spotify.com/v1/me/tracks?limit=50", token);
  const total = first.total;
  const offsets = [];
  for (let i = 50; i < total; i += 50) offsets.push(i);
  const pages = await Promise.all(
    offsets.map(offset => fetchWithToken(`https://api.spotify.com/v1/me/tracks?limit=50&offset=${offset}`, token))
  );
  return [...first.items, ...pages.flatMap(p => p.items)];
}

async function fetchAllSavedTracks(token) {
  try {
    const first = await fetchWithToken("https://api.spotify.com/v1/me/tracks?limit=50", token);
    if (!first || !first.items) return [];
    const total = first.total;
    const offsets = [];
    for (let i = 50; i < total; i += 50) offsets.push(i);
    const pages = await Promise.all(
      offsets.map(offset => fetchWithToken(`https://api.spotify.com/v1/me/tracks?limit=50&offset=${offset}`, token).catch(() => ({ items: [] })))
    );
    return [...first.items, ...pages.flatMap(p => p.items || [])];
  } catch (e) {
    console.error("Error fetching liked songs:", e);
    return [];
  }
}

function buildArtistMap(tracks) {
  const artistMap = {};
  tracks.forEach(item => {
    if (!item.track) return;
    item.track.artists.forEach(artist => {
      const name = artist.name.toLowerCase();
      if (!artistMap[name]) artistMap[name] = { songs: [], uris: [] };
      if (!artistMap[name].uris.includes(item.track.uri)) {
        artistMap[name].songs.push(item.track.name);
        artistMap[name].uris.push(item.track.uri);
      }
    });
  });
  return artistMap;
}

function App() {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [matches, setMatches] = useState({});
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code) {
      exchangeToken(code);
      window.history.replaceState({}, document.title, "/");
    }
  }, []);

  async function exchangeToken(code) {
    const verifier = localStorage.getItem("code_verifier");
    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
        code_verifier: verifier,
      }),
    });
    const data = await response.json();
    if (data.access_token) {
      setToken(data.access_token);
      localStorage.setItem("access_token", data.access_token);
    }
  }

  useEffect(() => {
    if (!token) return;
    fetchWithToken("https://api.spotify.com/v1/me", token).then(data => setUser(data));
  }, [token]);

  async function findMyArtists() {
    setLoading(true);
    setLoadingMessage("Scanning your liked songs...");
    const likedTracks = await fetchAllSavedTracks(token);

    setLoadingMessage("Scanning your playlists...");
    const playlistTracks = await fetchAllPlaylistTracks(token, user.id);

    setLoadingMessage("Finding matches...");
    const artistMap = buildArtistMap([...likedTracks, ...playlistTracks]);

    const found = {};
    lineup.forEach(artist => {
      const key = artist.name.toLowerCase();
      const variations = [
        key,
        key.replace(" and ", " & "),
        key.replace(" & ", " and "),
        key.split("(")[0].trim(),
      ];
      for (const v of variations) {
        if (artistMap[v]) {
          found[artist.name] = {
            songs: artistMap[v].songs,
            uris: artistMap[v].uris,
            day: artist.day,
            headliner: artist.headliner
          };
          break;
        }
      }
    });

    setMatches(found);
    setLoading(false);
    setLoadingMessage("");
  }

  const matchCount = Object.keys(matches).length;

  return (
    <div style={{ fontFamily: "sans-serif", maxWidth: "800px", margin: "0 auto", padding: "40px 20px" }}>
      <h1 style={{ color: "#1DB954" }}>🎵 BottleRock 2026</h1>
      <p>Connect your Spotify to see which artists you already know!</p>

      {!token ? (
        <button onClick={async () => {
          const verifier = generateRandomString(64);
          const challenge = await generateCodeChallenge(verifier);
          localStorage.setItem("code_verifier", verifier);
          const authUrl = `https://accounts.spotify.com/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(SCOPES)}&code_challenge=${challenge}&code_challenge_method=S256`;
          window.location.href = authUrl;
        }}
          style={{ background: "#1DB954", color: "white", border: "none", padding: "14px 28px", borderRadius: "25px", fontSize: "16px", cursor: "pointer" }}
        >
          Connect Spotify
        </button>
      ) : (
        <div>
          <div style={{ background: "#f0faf4", padding: "12px 20px", borderRadius: "12px", display: "inline-block", marginBottom: "16px" }}>
            ✅ Connected as <strong>{user?.display_name}</strong>
          </div>
          <br />
          <button onClick={findMyArtists} disabled={loading}
            style={{ background: "#1DB954", color: "white", border: "none", padding: "14px 28px", borderRadius: "25px", fontSize: "16px", cursor: "pointer", marginTop: "8px" }}
          >
            {loading ? loadingMessage : "Find My Artists"}
          </button>
        </div>
      )}

      {matchCount > 0 && (
        <div style={{ marginTop: "32px", background: "#f0faf4", padding: "20px", borderRadius: "12px" }}>
          <h2 style={{ color: "#1DB954", marginTop: 0 }}>You know {matchCount} artists playing BottleRock!</h2>
          {["Friday", "Saturday", "Sunday"].map(day => {
            const dayMatches = Object.entries(matches).filter(([, v]) => v.day === day);
            if (dayMatches.length === 0) return null;
            return (
              <div key={day}>
                <h3 style={{ color: "#1DB954" }}>{day}</h3>
                {dayMatches.map(([name, info]) => (
                  <div key={name} style={{ background: "white", borderRadius: "8px", padding: "12px 16px", marginBottom: "8px" }}>
                    <strong>{name}</strong> {info.headliner && "⭐"}
                    <div style={{ fontSize: "13px", color: "#666", marginTop: "4px" }}>
                      {info.songs.slice(0, 3).join(", ")}{info.songs.length > 3 ? ` +${info.songs.length - 3} more` : ""}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      <h2 style={{ marginTop: "40px" }}>Full Lineup</h2>
      {["Friday", "Saturday", "Sunday"].map(day => (
        <div key={day}>
          <h3 style={{ color: "#1DB954" }}>{day}</h3>
          {lineup.filter(a => a.day === day).map(artist => (
            <div key={artist.name} style={{ padding: "8px 12px", margin: "4px 0", background: matches[artist.name] ? "#f0faf4" : "#f5f5f5", borderRadius: "8px" }}>
              {artist.headliner ? <strong>{artist.name}</strong> : artist.name}
              {matches[artist.name] && " ✅"}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export default App;