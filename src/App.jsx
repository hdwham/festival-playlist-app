import { useState, useEffect } from "react";
import lineup from "./lineup.json";

const CLIENT_ID = "40f2e99c46024d56a243727dbb07ffb4";
const REDIRECT_URI = "https://localhost:5173/callback";
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

function App() {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);

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
    fetch("https://api.spotify.com/v1/me", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.json())
      .then(data => setUser(data));
  }, [token]);

  async function loginWithSpotify() {
    const verifier = generateRandomString(64);
    const challenge = await generateCodeChallenge(verifier);
    localStorage.setItem("code_verifier", verifier);
    const authUrl = `https://accounts.spotify.com/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(SCOPES)}&code_challenge=${challenge}&code_challenge_method=S256`;
    window.location.href = authUrl;
  }

  return (
    <div style={{ fontFamily: "sans-serif", maxWidth: "800px", margin: "0 auto", padding: "40px 20px" }}>
      <h1 style={{ color: "#1DB954" }}>BottleRock 2026</h1>
      <p>Connect your Spotify to see which artists you already know!</p>
      {!token ? (
        <button
          onClick={loginWithSpotify}
          style={{ background: "#1DB954", color: "white", border: "none", padding: "14px 28px", borderRadius: "25px", fontSize: "16px", cursor: "pointer" }}
        >
          Connect Spotify
        </button>
      ) : (
        <div style={{ background: "#f0faf4", padding: "12px 20px", borderRadius: "12px", display: "inline-block" }}>
          Connected as <strong>{user?.display_name}</strong>
        </div>
      )}
      <h2 style={{ marginTop: "40px" }}>Full Lineup</h2>
      {["Friday", "Saturday", "Sunday"].map(day => (
        <div key={day}>
          <h3 style={{ color: "#1DB954" }}>{day}</h3>
          {lineup.filter(a => a.day === day).map(artist => (
            <div key={artist.name} style={{ padding: "8px 12px", margin: "4px 0", background: "#f5f5f5", borderRadius: "8px" }}>
              {artist.headliner ? <strong>{artist.name}</strong> : artist.name}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export default App;