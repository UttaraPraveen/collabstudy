// utils/contentModeration.js
// Gemini-powered content moderation + YouTube summarization
// Uses gemini-2.0-flash — FREE tier (get a fresh key at aistudio.google.com/app/apikey)

const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

const getGeminiUrl = () =>
  `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${import.meta.env.VITE_GEMINI_API_KEY}`;

// ─────────────────────────────────────────────────────────────
// QUOTA CIRCUIT BREAKER
// Tracks 429/403 failures so we stop hammering a dead key and
// immediately fail-closed instead of making a doomed network call.
// ─────────────────────────────────────────────────────────────

const _quotaBreaker = {
  trippedUntil: 0,   // epoch ms — 0 means not tripped
  retryAfterMs: 60_000, // default back-off: 1 min

  isTripped() {
    return Date.now() < this.trippedUntil;
  },

  trip(retryAfterSeconds = 60) {
    this.retryAfterMs = retryAfterSeconds * 1000;
    this.trippedUntil = Date.now() + this.retryAfterMs;
    console.warn(
      `[contentModeration] Gemini quota breaker tripped. ` +
      `Requests blocked for ${retryAfterSeconds}s.`
    );
  },

  reset() {
    this.trippedUntil = 0;
  },
};

// ─────────────────────────────────────────────────────────────
// GEMINI API CALLER
// ─────────────────────────────────────────────────────────────

// Custom error so callers can tell quota/auth failures apart from network blips.
// We use a plain object tag (name + httpStatus) instead of a class so that
// instanceof checks survive Vite HMR re-evaluation.
function makeGeminiApiError(message, httpStatus, retryAfterSeconds) {
  const err = new Error(message);
  err.name = "GeminiApiError";
  err.httpStatus = httpStatus;
  err.retryAfterSeconds = retryAfterSeconds ?? null;
  return err;
}

function isGeminiApiError(err) {
  return err?.name === "GeminiApiError";
}

function isQuotaOrAuthError(err) {
  return isGeminiApiError(err) && (err.httpStatus === 429 || err.httpStatus === 403);
}

async function callGemini(prompt, maxOutputTokens = 600) {
  // Short-circuit immediately if the breaker is tripped — no network call.
  if (_quotaBreaker.isTripped()) {
    throw makeGeminiApiError(
      "Gemini quota circuit breaker is open — skipping request.",
      429,
      null
    );
  }

  let res;
  try {
    res = await fetch(getGeminiUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens,
          temperature: 0.2,
        },
      }),
    });
  } catch (networkErr) {
    // Pure network failure (no internet, DNS, CORS preflight abort, etc.)
    // Re-throw as a plain Error so callers can distinguish it from API errors.
    throw new Error(`Gemini network error: ${networkErr.message}`);
  }

  // Parse body regardless of status so we can read the error message.
  let data;
  try {
    data = await res.json();
  } catch {
    // Non-JSON body (e.g. 502 HTML gateway error)
    throw makeGeminiApiError(
      `Gemini returned non-JSON response (HTTP ${res.status})`,
      res.status,
      null
    );
  }

  if (!res.ok || data.error) {
    const errMsg = data.error?.message ?? `HTTP ${res.status}`;
    console.error("Gemini API Error:", data.error ?? { status: res.status });

    // Parse Retry-After from the error message if Gemini embeds it.
    // e.g. "Please retry in 12.03s."
    const retryMatch = errMsg.match(/retry in ([0-9.]+)s/i);
    const retryAfterSeconds = retryMatch ? Math.ceil(parseFloat(retryMatch[1])) + 5 : 65;

    if (res.status === 429 || res.status === 403) {
      _quotaBreaker.trip(retryAfterSeconds);
    }

    throw makeGeminiApiError(errMsg, res.status, retryAfterSeconds);
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  const clean = text.replace(/```json\s*|```\s*/g, "").trim();
  return clean;
}

// ─────────────────────────────────────────────────────────────
// YOUTUBE HELPERS
// ─────────────────────────────────────────────────────────────

export function extractYoutubeId(url) {
  const match = url.match(/(?:v=|youtu\.be\/|embed\/)([^&\n?#]{11})/);
  return match ? match[1] : null;
}

export function getYoutubeThumbnail(videoId) {
  return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
}

export function classifyYoutubeUrl(url) {
  try {
    const u = new URL(url);
    const path = u.pathname;
    const params = u.searchParams;

    if (params.has("list") && !params.has("v") && !url.includes("youtu.be")) {
      return { type: "playlist", allowed: false, reason: "Playlists are not allowed — please share a specific video instead." };
    }
    if (path.startsWith("/@") || path.startsWith("/c/") || path.startsWith("/channel/") || path.startsWith("/user/")) {
      return { type: "channel", allowed: false, reason: "YouTube channel pages are not allowed — please share a specific lecture or tutorial video." };
    }
    if (path.startsWith("/shorts/")) {
      return { type: "shorts", allowed: false, reason: "YouTube Shorts are not allowed in study rooms. Please share a full lecture or tutorial video." };
    }
    if (path === "/" || path.startsWith("/results") || path.startsWith("/feed")) {
      return { type: "homepage", allowed: false, reason: "Please share a direct link to a specific video, not the YouTube homepage or search." };
    }
    const videoId = extractYoutubeId(url);
    if (videoId) return { type: "video", allowed: true, videoId };
    return { type: "unknown", allowed: false, reason: "Could not find a video in that YouTube link. Please paste a direct video URL." };
  } catch {
    return { type: "invalid", allowed: false, reason: "That doesn't look like a valid URL." };
  }
}

export async function fetchYoutubeMetadata(url) {
  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
    if (!res.ok) throw new Error("oEmbed failed");
    const data = await res.json();
    return { title: data.title || "Unknown Title", channel: data.author_name || "Unknown Channel", thumbnail: data.thumbnail_url };
  } catch {
    const id = extractYoutubeId(url);
    return { title: "YouTube Video", channel: "Unknown", thumbnail: id ? getYoutubeThumbnail(id) : null };
  }
}

// ─────────────────────────────────────────────────────────────
// LINK MODERATION
// ─────────────────────────────────────────────────────────────

const BLOCKED_DOMAINS = [
  "instagram.com","tiktok.com","snapchat.com","twitter.com","x.com","facebook.com","threads.net","pinterest.com",
  "twitch.tv","discord.com","telegram.org","netflix.com","primevideo.com","hotstar.com","hulu.com",
  "disneyplus.com","zee5.com","sonyliv.com","jiocinema.com","crunchyroll.com","funimation.com",
  "spotify.com","soundcloud.com","gaana.com","jiosaavn.com",
  "onlyfans.com","pornhub.com","xvideos.com","xnxx.com",
  "1337x.to","thepiratebay.org","rarbg.to","fmovies.to","123movies.com","putlocker.com","opensubtitles.org",
];

const STUDY_DOMAINS_ALLOWLIST = [
  "arxiv.org","scholar.google.com","researchgate.net","khanacademy.org","coursera.org","edx.org","udemy.com",
  "nptel.ac.in","swayam.gov.in","mit.edu","stanford.edu","iitb.ac.in","iitd.ac.in",
  "wikipedia.org","britannica.com","brilliant.org","wolframalpha.com",
  "github.com","stackoverflow.com","geeksforgeeks.org","docs.google.com","drive.google.com",
  "sciencedirect.com","jstor.org","springer.com","nature.com","pubmed.ncbi.nlm.nih.gov","ieee.org",
  "moodle.org","notion.so",
];

function getDomain(url) {
  try { return new URL(url).hostname.replace("www.", ""); }
  catch { return ""; }
}

export function quickCheckUrl(url) {
  const domain = getDomain(url);
  if (BLOCKED_DOMAINS.some((b) => domain.includes(b))) {
    return { allowed: false, category: "blocked_domain", reason: "This site is not allowed in CLOCKEDIN study rooms." };
  }
  if (domain.includes("youtube.com") || domain.includes("youtu.be")) {
    const ytCheck = classifyYoutubeUrl(url);
    if (!ytCheck.allowed) return { allowed: false, category: `youtube_${ytCheck.type}`, reason: ytCheck.reason };
    return { allowed: null, category: "youtube_video", reason: "Needs content review" };
  }
  if (STUDY_DOMAINS_ALLOWLIST.some((a) => domain.includes(a))) {
    return { allowed: true, category: "allowlisted", reason: "Trusted study resource." };
  }
  return { allowed: null, category: "unknown", reason: "Needs review" };
}

export async function moderateUrlWithAI(url, title = "", description = "") {
  const isYoutube = url.includes("youtube.com") || url.includes("youtu.be");
  const prompt = `You are a content moderator for CLOCKEDIN, a study app used by Indian university and school students.
A student wants to add this ${isYoutube ? "YouTube video" : "link"} to their study room.
URL: ${url}
Title: "${title}"
${description ? `Description: ${description}` : ""}
ALLOW anything study-related. ONLY BLOCK obvious non-educational content (movies, music videos, adult, piracy, pure entertainment vlogs).
Respond ONLY with valid JSON, no markdown fences:
{"allowed": true or false, "confidence": "high" | "medium" | "low", "category": "lecture" | "tutorial" | "reference" | "tool" | "movie" | "music" | "entertainment" | "adult" | "piracy" | "other", "reason": "one short sentence only if allowed is false"}`;

  try {
    const clean = await callGemini(prompt, 200);
    return JSON.parse(clean);
  } catch (err) {
    console.error("AI moderation failed:", err);
    if (isQuotaOrAuthError(err)) {
      return { allowed: false, confidence: "low", category: "other", reason: "Content moderation unavailable (API quota reached). Please try again later." };
    }
    return { allowed: true, confidence: "low", category: "other", reason: "Could not verify — host can remove if inappropriate." };
  }
}

// ─────────────────────────────────────────────────────────────
// DOCUMENT MODERATION
// ─────────────────────────────────────────────────────────────

export async function moderateDocument(filename, description = "", subject = "") {
  const ext = filename.split(".").pop().toLowerCase();
  const name = filename.toLowerCase();

  const BLOCKED_EXTS = ["exe","bat","sh","cmd","msi","apk","dmg","js","php","py","rb","jar","vbs","ps1"];
  if (BLOCKED_EXTS.includes(ext)) {
    return { allowed: false, category: "blocked_filetype", reason: `Files of type .${ext} are not allowed for security reasons.` };
  }

  const ALLOWED_EXTS = ["pdf","doc","docx","ppt","pptx","xls","xlsx","txt","md","png","jpg","jpeg","csv","svg"];
  if (!ALLOWED_EXTS.includes(ext)) {
    return { allowed: false, category: "unsupported_filetype", reason: `File type .${ext} is not supported. Please upload PDF, Word, PowerPoint, Excel, or image files.` };
  }

  const SUSPICIOUS_KEYWORDS = [
    "movie","film","episode","season","1080p","720p","480p","bluray","dvdrip","x264","x265","hevc",
    "crack","keygen","patch","nulled","torrent","magnet","xxx","adult","porn","nsfw","leaked","nude",
  ];
  if (SUSPICIOUS_KEYWORDS.some((kw) => name.includes(kw))) {
    return { allowed: false, category: "suspicious_filename", reason: "This filename looks like it may not be study material. Please rename and try again." };
  }

  const prompt = `You are a strict content moderator for CLOCKEDIN, a university study app.
Filename: ${filename} | Subject: ${subject || "General"} | Description: ${description || "(none)"}
Allow lecture notes, textbooks, past papers, lab reports, research papers, study guides, code reference sheets.
Reject movies, music, personal files, cracked software, adult content.
Respond ONLY with valid JSON, no markdown fences:
{"allowed": true or false, "reason": "one sentence only if rejected"}`;

  try {
    const clean = await callGemini(prompt, 150);
    return JSON.parse(clean);
  } catch (err) {
    console.error("Document moderation failed:", err);
    if (isQuotaOrAuthError(err)) {
      return { allowed: false, reason: "Content moderation unavailable (API quota reached). Please try again later." };
    }
    return { allowed: true, reason: "" };
  }
}

// ─────────────────────────────────────────────────────────────
// YOUTUBE UNIFIED CHECKER & SUMMARIZER
// ─────────────────────────────────────────────────────────────

// Keyword-based pre-filter to catch obvious music/entertainment before
// spending an API call — and to block even when the API is down.
const MUSIC_ENTERTAINMENT_SIGNALS = [
  // Artist/genre keywords common in music video titles
  "official music video", "official video", "official audio", "lyric video",
  "lyrics video", "visualizer", "ft.", "feat.", "audio only",
  // Common entertainment channels / formats
  "vevo", "mv", "m/v", "full movie", "full film", "trailer", "teaser",
  "behind the scenes", "reaction video", "let's play", "playthrough",
  "highlights", "best moments", "compilation", "fan cam", "fancam",
];

function looksLikeEntertainment(title, channel) {
  const combined = `${title} ${channel}`.toLowerCase();

  // Vevo channels are almost always music
  if (channel.toLowerCase().includes("vevo")) return true;

  // Title contains known music/entertainment patterns
  if (MUSIC_ENTERTAINMENT_SIGNALS.some((sig) => combined.includes(sig))) return true;

  return false;
}

export async function analyzeYoutubeContent(url, title, channel, subject = "") {
  // ── Pre-filter: catch obvious cases without spending an API call ──
  if (looksLikeEntertainment(title, channel)) {
    return {
      isStudyRelated: false,
      reason: "This looks like a music video or entertainment content, which is not allowed in study rooms.",
      summary: null,
    };
  }

  const prompt = `You are a strict content moderator and study assistant for CLOCKEDIN, a university study app.
Title: "${title}" | Channel: "${channel}" | URL: ${url} | Subject: ${subject || "General"}

Is this video genuinely educational?
ALLOW: Lectures, tutorials, documentaries, coding, exam prep, science, math, history, language learning.
BLOCK: Music videos, movies, gaming let's plays, entertainment vlogs, pranks, sports highlights, reality TV.

If NOT study-related: set isStudyRelated=false, provide reason, leave summary fields empty.
If study-related: set isStudyRelated=true, reason="", generate a concise study summary.

Respond ONLY with valid JSON, no markdown fences:
{"isStudyRelated": boolean, "reason": "explanation if rejected, else empty string", "summary": {"overview": "2-3 sentences on what this covers", "keyPoints": ["point 1", "point 2", "point 3"], "noteTip": "one note-taking tip", "estimatedLevel": "Beginner", "studyRelevance": "High"}}
estimatedLevel must be one of: "Beginner", "Intermediate", "Advanced"
studyRelevance must be one of: "High", "Medium", "Low"`;

  try {
    const clean = await callGemini(prompt, 700);
    return JSON.parse(clean);
  } catch (err) {
    console.error("YouTube Analysis failed:", err);

    // FAIL CLOSED on quota/auth — don't let music videos through on a dead key.
    if (isQuotaOrAuthError(err)) {
      return {
        isStudyRelated: false,
        reason:
          "Content moderation is temporarily unavailable (API quota reached). " +
          "Get a new free key at aistudio.google.com/app/apikey and update VITE_GEMINI_API_KEY.",
        summary: null,
      };
    }

    // FAIL CLOSED on all other errors too — safer default for a study app.
    // Only fail open if you explicitly want to allow unverified content.
    return {
      isStudyRelated: false,
      reason: "Could not verify this video due to a network error. Please try again shortly.",
      summary: null,
    };
  }
}