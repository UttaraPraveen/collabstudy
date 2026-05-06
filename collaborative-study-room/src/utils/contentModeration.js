// utils/contentModeration.js
// Claude-powered content moderation + YouTube summarization

const ANTHROPIC_API = "/api.anthropic.com/v1/messages";
const MODEL = "claude-3-5-sonnet-20240620"; // FIXED: Valid Claude model

// FIXED: Added required headers helper for Anthropic API
const getAnthropicHeaders = () => ({
  "Content-Type": "application/json",
  "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY,
  "anthropic-version": "2023-06-01",
  "anthropic-dangerously-allow-browser": "true" // Required for React
});

// ─────────────────────────────────────────────────────────────
// YOUTUBE HELPERS
// ─────────────────────────────────────────────────────────────

export function extractYoutubeId(url) {
  // Only matches single video IDs — NOT playlists or channels
  const match = url.match(/(?:v=|youtu\.be\/|embed\/)([^&\n?#]{11})/);
  return match ? match[1] : null;
}

export function getYoutubeThumbnail(videoId) {
  return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
}

// ── Detect non-video YouTube URL types ───────────────────────
export function classifyYoutubeUrl(url) {
  try {
    const u = new URL(url);
    const path = u.pathname;
    const params = u.searchParams;

    // Playlist without a specific video
    if (params.has("list") && !params.has("v") && !url.includes("youtu.be")) {
      return { type: "playlist", allowed: false,
        reason: "Playlists are not allowed — please share a specific video instead." };
    }

    // Channel pages
    if (path.startsWith("/@") || path.startsWith("/c/") || path.startsWith("/channel/") || path.startsWith("/user/")) {
      return { type: "channel", allowed: false,
        reason: "YouTube channel pages are not allowed — please share a specific lecture or tutorial video." };
    }

    // YouTube Shorts
    if (path.startsWith("/shorts/")) {
      return { type: "shorts", allowed: false,
        reason: "YouTube Shorts are not allowed in study rooms. Please share a full lecture or tutorial video." };
    }

    // YouTube homepage / search / feed
    if (path === "/" || path.startsWith("/results") || path.startsWith("/feed")) {
      return { type: "homepage", allowed: false,
        reason: "Please share a direct link to a specific video, not the YouTube homepage or search." };
    }

    // Looks like a valid single video
    const videoId = extractYoutubeId(url);
    if (videoId) return { type: "video", allowed: true, videoId };

    // youtu.be links without an ID
    return { type: "unknown", allowed: false,
      reason: "Could not find a video in that YouTube link. Please paste a direct video URL." };
  } catch {
    return { type: "invalid", allowed: false, reason: "That doesn't look like a valid URL." };
  }
}

// Fetch basic video metadata via YouTube oEmbed (free, no API key needed)
export async function fetchYoutubeMetadata(url) {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
    );
    if (!res.ok) throw new Error("oEmbed failed");
    const data = await res.json();
    return {
      title:     data.title       || "Unknown Title",
      channel:   data.author_name || "Unknown Channel",
      thumbnail: data.thumbnail_url,
    };
  } catch {
    const id = extractYoutubeId(url);
    return {
      title:     "YouTube Video",
      channel:   "Unknown",
      thumbnail: id ? getYoutubeThumbnail(id) : null,
    };
  }
}

// ─────────────────────────────────────────────────────────────
// LINK MODERATION
// ─────────────────────────────────────────────────────────────

const BLOCKED_DOMAINS = [
  // Social media
  "instagram.com", "tiktok.com", "snapchat.com", "twitter.com",
  "x.com", "facebook.com", "threads.net", "pinterest.com",
  "twitch.tv", "discord.com", "telegram.org",
  // Streaming / entertainment
  "netflix.com", "primevideo.com", "hotstar.com", "hulu.com",
  "disneyplus.com", "zee5.com", "sonyliv.com", "jiocinema.com",
  "crunchyroll.com", "funimation.com",
  // Music / short video
  "spotify.com", "soundcloud.com", "gaana.com", "jiosaavn.com",
  // Adult
  "onlyfans.com", "pornhub.com", "xvideos.com", "xnxx.com",
  // Piracy
  "1337x.to", "thepiratebay.org", "rarbg.to", "fmovies.to",
  "123movies.com", "putlocker.com", "opensubtitles.org",
];

// These domains are trusted BUT still need YouTube-specific checks
// YouTube is intentionally NOT in this list anymore
const STUDY_DOMAINS_ALLOWLIST = [
  "arxiv.org", "scholar.google.com", "researchgate.net",
  "khanacademy.org", "coursera.org", "edx.org", "udemy.com",
  "nptel.ac.in", "swayam.gov.in",
  "mit.edu", "stanford.edu", "iitb.ac.in", "iitd.ac.in",
  "wikipedia.org", "britannica.com",
  "brilliant.org", "wolframalpha.com",
  "github.com", "stackoverflow.com", "geeksforgeeks.org",
  "docs.google.com", "drive.google.com",
  "sciencedirect.com", "jstor.org", "springer.com", "nature.com",
  "pubmed.ncbi.nlm.nih.gov", "ieee.org",
  "moodle.org", "notion.so",
];

function getDomain(url) {
  try { return new URL(url).hostname.replace("www.", ""); }
  catch { return ""; }
}

export function quickCheckUrl(url) {
  const domain = getDomain(url);

  // Hard block list
  if (BLOCKED_DOMAINS.some((b) => domain.includes(b))) {
    return { allowed: false, category: "blocked_domain",
      reason: "This site is not allowed in CLOCKEDIN study rooms." };
  }

  // Non-video YouTube URLs (playlists, channels, shorts) — check before allowlist
  if (domain.includes("youtube.com") || domain.includes("youtu.be")) {
    const ytCheck = classifyYoutubeUrl(url);
    if (!ytCheck.allowed) return { allowed: false, category: `youtube_${ytCheck.type}`, reason: ytCheck.reason };
    // Valid single video → still needs AI check on title/content
    return { allowed: null, category: "youtube_video", reason: "Needs content review" };
  }

  // Known academic domain → fast pass
  if (STUDY_DOMAINS_ALLOWLIST.some((a) => domain.includes(a))) {
    return { allowed: true, category: "allowlisted", reason: "Trusted study resource." };
  }

  // Unknown domain → AI check
  return { allowed: null, category: "unknown", reason: "Needs review" };
}

// ── AI moderation for unknown URLs + YouTube video titles ────
export async function moderateUrlWithAI(url, title = "", description = "") {
  const isYoutube = url.includes("youtube.com") || url.includes("youtu.be");

  // FIXED: Syntax error in prompt template literals
  const prompt = `You are a content moderator for CLOCKEDIN, a study app used by Indian university and school students.

A student wants to add this ${isYoutube ? "YouTube video" : "link"} to their study room's resource library.
URL: ${url}
Title: "${title}"
${description ? `Description: ${description}` : ""}

Your job is to ALLOW anything that could genuinely help a student study, and only BLOCK content that is clearly non-educational.

${isYoutube ? `
ALLOW these YouTube videos (be generous — if it looks educational, allow it):
- Lectures, tutorials, explanations for ANY academic subject
- Coding tutorials, programming courses, tech explanations
- Science experiments, math problem solving, history documentaries
- Exam prep, revision videos, concept explanations
- TED talks or educational speeches on academic topics
- Documentary-style content about academic subjects
- Videos from known educational channels (Khan Academy, Veritasium, 3Blue1Brown, NPTEL, Unacademy, BYJU's, Crash Course, Kurzgesagt, MIT OpenCourseWare, etc.)

ONLY BLOCK these (must be very obvious, not ambiguous):
- Full movies or TV show episodes (title clearly says "Full Movie", "Full Episode", "Season X Episode Y")
- Pure music videos or songs (title says "Official MV", "Official Audio", "Lyrics Video")
- Gaming let's plays or pure sports match highlights with zero educational content
- Pure entertainment vlogs, prank videos, or reality TV clips

If a title could plausibly be educational — ALLOW IT. Students and their host can remove it manually if needed.
` : `
ALLOW any link useful for studying:
- Articles, blogs, documentation, tools, calculators
- Academic resources, research papers, textbooks
- Productivity and study tools

ONLY BLOCK if OBVIOUSLY one of these:
- Adult/NSFW content
- Piracy or illegal download sites
- Pure entertainment with zero study value (gaming sites, dating apps)
`}

Respond ONLY with valid JSON, no other text:
{
  "allowed": true or false,
  "confidence": "high" | "medium" | "low",
  "category": "lecture" | "tutorial" | "reference" | "tool" | "movie" | "music" | "entertainment" | "adult" | "piracy" | "other",
  "reason": "one short sentence shown to the student only if allowed is false"
}`;

  try {
    const res = await fetch(ANTHROPIC_API, {
      method: "POST",
      headers: getAnthropicHeaders(), // FIXED: Uses API Key
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 200,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data  = await res.json();
    
    // Catch API errors (like quota exceeded) returned as JSON
    if (data.error) {
      console.error("Anthropic API Error:", data.error);
      throw new Error(data.error.message);
    }
    
    const text  = data.content?.[0]?.text || "{}";
    const clean = text.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  } catch (err) {
    console.error("AI moderation failed:", err);
    // Fail open on API error — don't punish students for network issues
    return { allowed: true, confidence: "low", category: "other",
      reason: "Could not verify content, but allowed through. Host can remove if inappropriate." };
  }
}

// ─────────────────────────────────────────────────────────────
// DOCUMENT MODERATION
// ─────────────────────────────────────────────────────────────

export async function moderateDocument(filename, description = "", subject = "") {
  const ext = filename.split(".").pop().toLowerCase();
  const name = filename.toLowerCase();

  // Block executables and scripts immediately
  const BLOCKED_EXTS = ["exe","bat","sh","cmd","msi","apk","dmg","js","php","py","rb","jar","vbs","ps1"];
  if (BLOCKED_EXTS.includes(ext)) {
    return { allowed: false, category: "blocked_filetype",
      reason: `Files of type .${ext} are not allowed for security reasons.` };
  }

  // Only allow academic file types
  const ALLOWED_EXTS = ["pdf","doc","docx","ppt","pptx","xls","xlsx","txt","md","png","jpg","jpeg","csv","svg"];
  if (!ALLOWED_EXTS.includes(ext)) {
    return { allowed: false, category: "unsupported_filetype",
      reason: `File type .${ext} is not supported. Please upload PDF, Word, PowerPoint, Excel, or image files.` };
  }

  // Client-side keyword check on filename before spending an API call
  const SUSPICIOUS_KEYWORDS = [
    "movie","film","episode","season","s0","e0","1080p","720p","480p","bluray","dvdrip","x264","x265","hevc",
    "crack","keygen","patch","serial","license","nulled","torrent","magnet",
    "xxx","adult","porn","nsfw","leaked","nude",
  ];
  const hasSuspiciousName = SUSPICIOUS_KEYWORDS.some((kw) => name.includes(kw));
  if (hasSuspiciousName) {
    return { allowed: false, category: "suspicious_filename",
      reason: "This filename looks like it may not be study material. Please rename and try again, or only upload academic files." };
  }

  // AI check for edge cases
  const prompt = `You are a strict content moderator for CLOCKEDIN, a university study app.

A student wants to upload this file to a study room:
Filename: ${filename}
Subject: ${subject || "General"}
Description: ${description || "(none provided)"}

CLOCKEDIN only allows genuine academic study material. Reject if the filename or description suggests:
- A pirated or legally downloaded movie, TV show, or series (PDFs named after films, subtitle files, etc.)
- Music albums or lyrics sheets
- Personal photos, memes, or unrelated images
- Cracked software, game ROMs, or hacking tools
- Adult content of any kind
- Completely personal files (bank statements, IDs, etc.)

Allow: lecture notes, textbook chapters, past papers, lab reports, research papers, study guides, diagrams, code reference sheets, assignment templates.

Respond ONLY with valid JSON:
{
  "allowed": true or false,
  "reason": "one sentence shown to the user only if rejected"
}`;

  try {
    const res = await fetch(ANTHROPIC_API, {
      method: "POST",
      headers: getAnthropicHeaders(), // FIXED: Uses API Key
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 150,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data  = await res.json();
    
    if (data.error) throw new Error(data.error.message);
    
    const text  = data.content?.[0]?.text || "{}";
    const clean = text.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  } catch (err) {
    console.error("Document moderation failed:", err);
    return { allowed: true, reason: "" }; // fail open for documents
  }
}

// ─────────────────────────────────────────────────────────────
// YOUTUBE SUMMARIZER
// ─────────────────────────────────────────────────────────────

// utils/contentModeration.js

// ... (keep the rest of your existing contentModeration.js code at the top)

// ─────────────────────────────────────────────────────────────
// YOUTUBE UNIFIED CHECKER & SUMMARIZER
// ─────────────────────────────────────────────────────────────

export async function analyzeYoutubeContent(url, title, channel, subject = "") {
  const prompt = `You are a strict content moderator and study assistant for CLOCKEDIN, a university study app.

A student wants to add this YouTube video to their study room's resource library:
Title: "${title}"
Channel: "${channel}"
URL: ${url}
Room subject: ${subject || "General"}

First, determine if this video is genuinely educational or study-related. 
ALLOW: Lectures, tutorials, documentaries, academic concepts, coding, exam prep, science.
BLOCK: Music videos, movies, gaming let's plays, entertainment vlogs, pranks, sports highlights.

If it is NOT study-related, set "isStudyRelated" to false and provide a short "reason" why it was blocked. You can leave the summary fields empty.

If it IS study-related, set "isStudyRelated" to true, "reason" to "", and generate a concise study summary to help students.

Respond ONLY with valid JSON matching this exact structure:
{
  "isStudyRelated": boolean,
  "reason": "Short explanation if rejected, else empty string",
  "summary": {
    "overview": "2-3 sentences describing what this video covers and who it's for",
    "keyPoints": ["concept 1", "concept 2", "concept 3"],
    "noteTip": "One specific tip for taking notes on this type of content",
    "estimatedLevel": "Beginner" | "Intermediate" | "Advanced",
    "studyRelevance": "High" | "Medium" | "Low"
  }
}`;

  try {
    const res = await fetch(ANTHROPIC_API, {
      method: "POST",
      headers: getAnthropicHeaders(),
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 600, // Slightly higher to accommodate the combined output
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data  = await res.json();
    
    if (data.error) throw new Error(data.error.message);
    
    const text  = data.content?.[0]?.text || "{}";
    const clean = text.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  } catch (err) {
    console.error("YouTube Analysis failed:", err);
    // Fail open if the API drops, so students aren't blocked by network issues.
    return {
      isStudyRelated: true,
      reason: "",
      summary: {
        overview: "AI summary temporarily unavailable due to a network error. Host can remove this video if inappropriate.",
        keyPoints: [],
        noteTip: "Verify the video content manually.",
        estimatedLevel: "Beginner",
        studyRelevance: "Medium"
      }
    };
  }
}