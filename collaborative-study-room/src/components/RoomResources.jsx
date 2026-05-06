// components/RoomResources.jsx
// Resource library with:
//   • AI content moderation (links + documents)
//   • YouTube video summarizer
//   • Host can delete flagged resources
//   • Inline summary cards on resource tiles

import { useState, useEffect } from "react";
import {
  collection, addDoc, onSnapshot, query,
  orderBy, deleteDoc, doc, serverTimestamp, updateDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import {
  quickCheckUrl,
  moderateUrlWithAI,
  moderateDocument,
  analyzeYoutubeContent,
  fetchYoutubeMetadata,
  extractYoutubeId,
  classifyYoutubeUrl,
  getYoutubeThumbnail,
} from "../utils/contentModeration";

// ─── Cloudinary upload ───────────────────────────────────────
const CLOUDINARY_URL  = `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/auto/upload`;
const UPLOAD_PRESET   = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

async function uploadToCloudinary(file, roomId) {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("upload_preset", UPLOAD_PRESET);
  fd.append("folder", `clockedin/rooms/${roomId}`);
  const res  = await fetch(CLOUDINARY_URL, { method: "POST", body: fd });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.secure_url;
}

// ─── Icons ───────────────────────────────────────────────────
const TYPE_ICONS = { pdf: "📄", link: "🔗", youtube: "▶", note: "📝", image: "🖼" };
const LEVEL_COLORS = { Beginner: "#22c55e", Intermediate: "#f59e0b", Advanced: "#ef4444" };

export default function RoomResources({ roomId, isHost = false }) {
  const { user } = useAuth();
  const [resources, setResources] = useState([]);
  const [showAdd,   setShowAdd]   = useState(false);
  const [filter,    setFilter]    = useState("all");
  const [expanded,  setExpanded]  = useState(null); // resource id with summary open

  // ── load resources ──
  useEffect(() => {
    if (!roomId) return;
    const q = query(
      collection(db, "resources"),
      orderBy("createdAt", "desc")
    );
    return onSnapshot(q, (snap) => {
      setResources(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((r) => r.roomId === roomId)
      );
    });
  }, [roomId]);

  const handleDelete = async (id) => {
    if (!window.confirm("Remove this resource?")) return;
    await deleteDoc(doc(db, "resources", id));
  };

  const filtered = filter === "all"
    ? resources
    : resources.filter((r) => r.type === filter);

  return (
    <div className="bg-white rounded-2xl shadow-md overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
        <h2 className="text-sm font-bold text-slate-800 tracking-wide">📁 Resource Library</h2>
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white px-3 py-1.5 rounded-lg transition"
        >
          {showAdd ? "✕ Cancel" : "+ Add"}
        </button>
      </div>

      {/* Add resource form */}
      {showAdd && (
        <AddResourceForm
          roomId={roomId}
          userId={user?.uid}
          userName={user?.displayName || "Student"}
          onClose={() => setShowAdd(false)}
        />
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 px-4 py-2 border-b border-slate-100 overflow-x-auto">
        {["all", "youtube", "pdf", "link", "note"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-[10px] font-bold uppercase tracking-wide px-3 py-1 rounded-full transition flex-shrink-0 ${
              filter === f
                ? "bg-purple-100 text-purple-700"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            {f === "all" ? "All" : TYPE_ICONS[f] + " " + f}
          </button>
        ))}
      </div>

      {/* Resource list */}
      <div className="divide-y divide-slate-50 max-h-[420px] overflow-y-auto">
        {filtered.length === 0 && (
          <div className="py-10 text-center text-slate-400 text-sm">
            No resources yet. Add PDFs, YouTube links, or notes!
          </div>
        )}

        {filtered.map((r) => (
          <ResourceRow
            key={r.id}
            resource={r}
            isHost={isHost}
            isOwner={r.uploadedBy?.uid === user?.uid}
            expanded={expanded === r.id}
            onToggleExpand={() => setExpanded(expanded === r.id ? null : r.id)}
            onDelete={() => handleDelete(r.id)}
          />
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ADD RESOURCE FORM — with moderation gate
// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
// ADD RESOURCE FORM — with strict AI moderation gate
// ─────────────────────────────────────────────────────────────
function AddResourceForm({ roomId, userId, userName, onClose }) {
  const [tab,         setTab]         = useState("youtube"); // youtube | link | file | note
  const [url,         setUrl]         = useState("");
  const [noteText,    setNoteText]    = useState("");
  const [subject,     setSubject]     = useState("");
  const [label,       setLabel]       = useState("");
  const [file,        setFile]        = useState(null);
  const [status,      setStatus]      = useState(null);  // null | "checking" | "rejected" | "uploading" | "done"
  const [rejection,   setRejection]   = useState("");    // rejection reason shown to user

  const reset = () => { setUrl(""); setLabel(""); setFile(null); setNoteText(""); setStatus(null); setRejection(""); };

  // ── SUBMIT YOUTUBE ──────────────────────────────────────────
  const submitYoutube = async () => {
    if (!url.trim()) return;
    setStatus("checking");
    setRejection("");

    try {
      // 1. Structural check (rejects shorts, playlists, etc.)
      const ytClass = classifyYoutubeUrl(url);
      if (!ytClass.allowed) {
        setStatus("rejected"); setRejection(ytClass.reason); return;
      }
      const videoId = ytClass.videoId;

      // 2. Fetch basic metadata
      const meta = await fetchYoutubeMetadata(url);

      // 3. STRICT AI CHECK & SUMMARIZE (Unified Call)
      setStatus("uploading"); // Changes button text to "Generating summary..."
      
      // NOTE: Make sure this new function is imported from your utils at the top of the file!
      const aiResult = await analyzeYoutubeContent(url, meta.title, meta.channel, subject);

      // 4. The Bouncer: Block it if the AI says it's not educational
      if (!aiResult.isStudyRelated) {
        setStatus("rejected"); 
        setRejection(aiResult.reason || "This video does not appear to be educational or relevant to your studies."); 
        return;
      }

      // 5. Passed! Save the resource and the generated summary to Firestore
      await addDoc(collection(db, "resources"), {
        roomId,
        type:      "youtube",
        name:      label || meta.title,
        url,
        videoId,
        thumbnail: meta.thumbnail || getYoutubeThumbnail(videoId),
        channel:   meta.channel,
        subject:   subject || "General",
        summary:   aiResult.summary, // The summary object generated by the AI
        uploadedBy: { uid: userId, name: userName },
        createdAt: serverTimestamp(),
        pinned:    false,
      });

      setStatus("done");
      setTimeout(() => { reset(); onClose(); }, 800);
      
    } catch (err) {
      console.error("YouTube submission error:", err);
      setStatus("rejected");
      setRejection("Failed to process video. Please try again.");
    }
  };

  // ... (keep your existing submitLink, submitFile, and submitNote functions exactly the same)
  // ... (keep the rest of the AddResourceForm JSX exactly the same)

  // ── SUBMIT LINK ─────────────────────────────────────────────
  const submitLink = async () => {
    if (!url.trim()) return;
    setStatus("checking"); setRejection("");

    const quick = quickCheckUrl(url);
    if (quick.allowed === false) { setStatus("rejected"); setRejection(quick.reason); return; }

    // Unknown domain → full AI check
    if (quick.allowed === null) {
      const mod = await moderateUrlWithAI(url, label);
      if (!mod.allowed) { setStatus("rejected"); setRejection(mod.reason); return; }
    }

    setStatus("uploading");
    await addDoc(collection(db, "resources"), {
      roomId, type: "link",
      name:   label || url,
      url, subject: subject || "General",
      uploadedBy: { uid: userId, name: userName },
      createdAt: serverTimestamp(), pinned: false,
    });
    setStatus("done");
    setTimeout(() => { reset(); onClose(); }, 800);
  };

  // ── SUBMIT FILE ─────────────────────────────────────────────
  const submitFile = async () => {
    if (!file) return;
    setStatus("checking"); setRejection("");

    // Moderate filename + description
    const mod = await moderateDocument(file.name, label, subject);
    if (!mod.allowed) { setStatus("rejected"); setRejection(mod.reason); return; }

    setStatus("uploading");
    try {
      const fileUrl  = await uploadToCloudinary(file, roomId);
      const fileType = file.type.includes("pdf") ? "pdf" : "image";
      await addDoc(collection(db, "resources"), {
        roomId, type: fileType,
        name:    label || file.name.replace(/\.[^.]+$/, ""),
        url:     fileUrl,
        fileSize: file.size,
        subject: subject || "General",
        uploadedBy: { uid: userId, name: userName },
        createdAt: serverTimestamp(), pinned: false,
      });
      setStatus("done");
      setTimeout(() => { reset(); onClose(); }, 800);
    } catch (err) {
      setStatus("rejected"); setRejection("Upload failed: " + err.message);
    }
  };

  // ── SUBMIT NOTE ─────────────────────────────────────────────
  const submitNote = async () => {
    if (!noteText.trim()) return;
    setStatus("uploading");
    await addDoc(collection(db, "resources"), {
      roomId, type: "note",
      name:    noteText.slice(0, 60),
      content: noteText, url: null,
      subject: subject || "General",
      uploadedBy: { uid: userId, name: userName },
      createdAt: serverTimestamp(), pinned: false,
    });
    setStatus("done");
    setTimeout(() => { reset(); onClose(); }, 800);
  };

  const isChecking  = status === "checking";
  const isUploading = status === "uploading";
  const isDone      = status === "done";
  const busy        = isChecking || isUploading;

  return (
    <div className="border-b border-slate-100 bg-slate-50 p-4">
      {/* Tab strip */}
      <div className="flex gap-1 mb-4">
        {[
          { id: "youtube", label: "▶ YouTube" },
          { id: "link",    label: "🔗 Link" },
          { id: "file",    label: "📄 File" },
          { id: "note",    label: "📝 Note" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); reset(); }}
            className={`text-xs font-bold px-3 py-1.5 rounded-lg transition ${
              tab === t.id
                ? "bg-purple-600 text-white"
                : "bg-white border border-slate-200 text-slate-500 hover:border-purple-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Shared subject input */}
      <input
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        placeholder="Subject / Topic (e.g. Physics)"
        // FIXED: Added text-slate-900 placeholder-slate-400
        className="w-full text-xs text-slate-900 placeholder-slate-400 border border-slate-200 rounded-lg px-3 py-2 mb-3 outline-none focus:border-purple-400 bg-white"
      />

      {/* YouTube tab */}
      {tab === "youtube" && (
        <div className="space-y-2">
          <input value={url} onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste YouTube URL…"
            // FIXED: Added text-slate-900 placeholder-slate-400
            className="w-full text-xs text-slate-900 placeholder-slate-400 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-purple-400 bg-white" />
          <input value={label} onChange={(e) => setLabel(e.target.value)}
            placeholder="Custom title (optional)"
            // FIXED: Added text-slate-900 placeholder-slate-400
            className="w-full text-xs text-slate-900 placeholder-slate-400 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-purple-400 bg-white" />
          <SubmitBtn onClick={submitYoutube} busy={busy} done={isDone}
            checkingLabel="Checking video…" uploadingLabel="Generating summary…" label="Add & Summarise" />
        </div>
      )}

      {/* Link tab */}
      {tab === "link" && (
        <div className="space-y-2">
          <input value={url} onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
            // FIXED: Added text-slate-900 placeholder-slate-400
            className="w-full text-xs text-slate-900 placeholder-slate-400 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-purple-400 bg-white" />
          <input value={label} onChange={(e) => setLabel(e.target.value)}
            placeholder="Label (optional)"
            // FIXED: Added text-slate-900 placeholder-slate-400
            className="w-full text-xs text-slate-900 placeholder-slate-400 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-purple-400 bg-white" />
          <SubmitBtn onClick={submitLink} busy={busy} done={isDone}
            checkingLabel="Checking link…" uploadingLabel="Saving…" label="Add Link" />
        </div>
      )}

      {/* File tab */}
      {tab === "file" && (
        <div className="space-y-2">
          <label className="block border-2 border-dashed border-slate-200 hover:border-purple-300 rounded-xl p-4 text-center cursor-pointer transition bg-white">
            <span className="text-slate-400 text-xs">
              {file ? `📄 ${file.name}` : "Click to choose PDF, Word, PowerPoint…"}
            </span>
            <input type="file" className="hidden"
              accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.md,.png,.jpg,.jpeg"
              onChange={(e) => setFile(e.target.files[0])} />
          </label>
          <input value={label} onChange={(e) => setLabel(e.target.value)}
            placeholder="Description (helps the AI check)"
            // FIXED: Added text-slate-900 placeholder-slate-400
            className="w-full text-xs text-slate-900 placeholder-slate-400 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-purple-400 bg-white" />
          <SubmitBtn onClick={submitFile} busy={busy} done={isDone}
            checkingLabel="Screening file…" uploadingLabel="Uploading…" label="Upload File" />
        </div>
      )}

      {/* Note tab */}
      {tab === "note" && (
        <div className="space-y-2">
          <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)}
            placeholder="Quick note for the room…" rows={3}
            // FIXED: Added text-slate-900 placeholder-slate-400
            className="w-full text-xs text-slate-900 placeholder-slate-400 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-purple-400 bg-white resize-none" />
          <SubmitBtn onClick={submitNote} busy={busy} done={isDone}
            checkingLabel="" uploadingLabel="Saving…" label="Save Note" />
        </div>
      )}

      {/* Rejection message */}
      {status === "rejected" && (
        <div className="mt-3 bg-red-50 border border-red-200 rounded-xl p-3 flex gap-2 items-start">
          <span className="text-base flex-shrink-0">🚫</span>
          <div>
            <p className="text-xs font-bold text-red-700">Not allowed</p>
            <p className="text-xs text-red-600 mt-0.5">{rejection}</p>
          </div>
        </div>
      )}

      {/* AI check badge */}
      {(isChecking || isUploading) && (
        <div className="mt-3 bg-purple-50 border border-purple-200 rounded-xl p-3 flex gap-2 items-center">
          <span className="text-sm animate-spin">⚙️</span>
          <p className="text-xs text-purple-700 font-medium">
            {isChecking ? "AI is reviewing this content…" : "Processing…"}
          </p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// RESOURCE ROW
// ─────────────────────────────────────────────────────────────
function ResourceRow({ resource: r, isHost, isOwner, expanded, onToggleExpand, onDelete }) {
  const [loadingSummary, setLoadingSummary] = useState(false);

  const canDelete  = isHost || isOwner;
  const hasSummary = r.type === "youtube" && r.summary;

  return (
    <div className={`px-4 py-3 hover:bg-slate-50 transition ${expanded ? "bg-purple-50/40" : ""}`}>
      <div className="flex items-start gap-3">
        {/* Thumbnail / Icon */}
        <div className="flex-shrink-0 w-10 h-10 rounded-xl overflow-hidden bg-slate-100 flex items-center justify-center text-lg">
          {r.thumbnail
            ? <img src={r.thumbnail} alt="" className="w-full h-full object-cover" />
            : TYPE_ICONS[r.type] || "📎"}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <a
            href={r.url || "#"}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-semibold text-slate-800 hover:text-purple-700 truncate block transition"
          >
            {r.name}
          </a>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {r.subject && (
              <span className="text-[9px] font-bold uppercase tracking-wide bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                {r.subject}
              </span>
            )}
            {r.channel && (
              <span className="text-[10px] text-slate-400">{r.channel}</span>
            )}
            <span className="text-[10px] text-slate-400">{r.uploadedBy?.name}</span>
          </div>

          {/* Summary level badge */}
          {hasSummary && r.summary.estimatedLevel && (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${LEVEL_COLORS[r.summary.estimatedLevel]}22`, color: LEVEL_COLORS[r.summary.estimatedLevel] }}>
                {r.summary.estimatedLevel}
              </span>
              {r.summary.studyRelevance && (
                <span className="text-[9px] text-slate-400">Relevance: {r.summary.studyRelevance}</span>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {hasSummary && (
            <button
              onClick={onToggleExpand}
              className={`text-[10px] font-bold px-2 py-1 rounded-lg transition ${
                expanded
                  ? "bg-purple-600 text-white"
                  : "bg-purple-100 text-purple-700 hover:bg-purple-200"
              }`}
            >
              {expanded ? "Hide" : "✨ Summary"}
            </button>
          )}
          {canDelete && (
            <button
              onClick={onDelete}
              className="text-slate-300 hover:text-red-500 transition text-sm px-1"
              title="Remove resource"
            >
              🗑
            </button>
          )}
        </div>
      </div>

      {/* Expanded Summary Panel */}
      {expanded && hasSummary && (
        <SummaryPanel summary={r.summary} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SUMMARY PANEL
// ─────────────────────────────────────────────────────────────
function SummaryPanel({ summary }) {
  return (
    <div className="mt-3 ml-13 bg-white border border-purple-100 rounded-xl p-4 text-sm"
      style={{ marginLeft: 52 }}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base">✨</span>
        <span className="text-xs font-bold text-purple-700 uppercase tracking-wide">AI Study Summary</span>
        <span className="text-[9px] text-slate-400 ml-auto">Generated by Claude</span>
      </div>

      {/* Overview */}
      <p className="text-xs text-slate-700 leading-relaxed mb-3">{summary.overview}</p>

      {/* Key points */}
      {summary.keyPoints?.length > 0 && (
        <div className="mb-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">Key Concepts</p>
          <ul className="space-y-1">
            {summary.keyPoints.map((pt, i) => (
              <li key={i} className="text-xs text-slate-700 flex gap-2">
                <span className="text-purple-500 flex-shrink-0 font-bold">{i + 1}.</span>
                {pt}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Note tip */}
      {summary.noteTip && (
        <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 flex gap-2">
          <span className="text-sm flex-shrink-0">💡</span>
          <p className="text-xs text-amber-800">{summary.noteTip}</p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SUBMIT BUTTON — shows contextual loading states
// ─────────────────────────────────────────────────────────────
function SubmitBtn({ onClick, busy, done, label, checkingLabel, uploadingLabel }) {
  return (
    <button
      onClick={onClick}
      disabled={busy || done}
      className={`w-full py-2 rounded-xl text-xs font-bold transition ${
        done  ? "bg-emerald-500 text-white" :
        busy  ? "bg-purple-300 text-white cursor-wait" :
                "bg-purple-600 hover:bg-purple-500 text-white"
      }`}
    >
      {done        ? "✓ Added!"         :
       busy        ? (checkingLabel || uploadingLabel || "Working…") :
       label}
    </button>
  );
}