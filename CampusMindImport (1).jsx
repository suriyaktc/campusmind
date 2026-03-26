import { useState, useRef, useCallback, useEffect } from "react";

const ACCEPTED_TYPES = {
  "application/pdf": { label: "PDF", icon: "📄", color: "#ef4444" },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { label: "DOCX", icon: "📝", color: "#3b82f6" },
  "application/msword": { label: "DOC", icon: "📝", color: "#3b82f6" },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": { label: "XLSX", icon: "📊", color: "#22c55e" },
  "text/csv": { label: "CSV", icon: "📊", color: "#22c55e" },
  "text/plain": { label: "TXT", icon: "📃", color: "#a3a3a3" },
  "image/png": { label: "PNG", icon: "🖼️", color: "#f59e0b" },
  "image/jpeg": { label: "JPG", icon: "🖼️", color: "#f59e0b" },
  "image/webp": { label: "WEBP", icon: "🖼️", color: "#f59e0b" },
  "audio/mpeg": { label: "MP3", icon: "🎵", color: "#8b5cf6" },
  "video/mp4": { label: "MP4", icon: "🎬", color: "#ec4899" },
};

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileInfo(file) {
  const info = ACCEPTED_TYPES[file.type] || { label: file.name.split(".").pop().toUpperCase(), icon: "📁", color: "#6b7280" };
  return info;
}

function ProgressRing({ progress, size = 36, stroke = 3, color = "#6366f1" }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (progress / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.3s ease" }}
      />
    </svg>
  );
}

function FileCard({ file, onRemove, onAnalyze }) {
  const info = getFileInfo(file.raw);
  const statusColors = { idle: "#6b7280", uploading: "#6366f1", done: "#22c55e", error: "#ef4444", analyzing: "#f59e0b" };

  return (
    <div className="file-card" style={{ "--accent": info.color }}>
      <div className="file-card-left">
        <div className="file-icon-wrap" style={{ background: `${info.color}18`, border: `1px solid ${info.color}30` }}>
          <span style={{ fontSize: 20 }}>{info.icon}</span>
        </div>
        <div className="file-meta">
          <span className="file-name">{file.raw.name}</span>
          <span className="file-sub">{info.label} · {formatSize(file.raw.size)}</span>
          {file.status === "uploading" && (
            <div className="progress-bar-wrap">
              <div className="progress-bar" style={{ width: `${file.progress}%`, background: info.color }} />
            </div>
          )}
          {file.status === "done" && <span className="status-badge done">✓ Ready for analysis</span>}
          {file.status === "analyzing" && <span className="status-badge analyzing">⏳ Analyzing…</span>}
          {file.status === "analyzed" && <span className="status-badge analyzed">✦ Analysis complete</span>}
          {file.status === "error" && <span className="status-badge error">✕ Upload failed</span>}
        </div>
      </div>
      <div className="file-card-right">
        {file.status === "uploading" && <ProgressRing progress={file.progress} color={info.color} />}
        {file.status === "done" && (
          <button className="analyze-btn" onClick={() => onAnalyze(file.id)} style={{ background: `${info.color}20`, color: info.color, border: `1px solid ${info.color}40` }}>
            Analyze
          </button>
        )}
        {file.status === "analyzed" && (
          <button className="analyze-btn done-btn" onClick={() => onAnalyze(file.id)}>
            View
          </button>
        )}
        <button className="remove-btn" onClick={() => onRemove(file.id)}>✕</button>
      </div>
    </div>
  );
}

function AnalysisPanel({ analysis, onClose }) {
  return (
    <div className="analysis-overlay" onClick={onClose}>
      <div className="analysis-panel" onClick={e => e.stopPropagation()}>
        <div className="analysis-header">
          <span className="analysis-title">✦ AI Analysis</span>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="analysis-body">
          {analysis.split("\n").map((line, i) => (
            <p key={i} style={{ margin: "0 0 8px", color: line.startsWith("##") ? "#a5b4fc" : "#e2e8f0", fontWeight: line.startsWith("##") ? 600 : 400, fontSize: line.startsWith("##") ? 15 : 14 }}>
              {line.replace(/^##\s?/, "")}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function CampusMindImport() {
  const [files, setFiles] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [showPanel, setShowPanel] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [showKeyInput, setShowKeyInput] = useState(false);
  const fileInputRef = useRef(null);
  const dragCounter = useRef(0);

  const addFiles = useCallback((rawFiles) => {
    const newFiles = Array.from(rawFiles).map(f => ({
      id: Math.random().toString(36).slice(2),
      raw: f,
      status: "idle",
      progress: 0,
    }));
    setFiles(prev => [...prev, ...newFiles]);
    // Simulate upload for each
    newFiles.forEach(f => simulateUpload(f.id));
  }, []);

  const simulateUpload = (id) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, status: "uploading", progress: 0 } : f));
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 18 + 5;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        setFiles(prev => prev.map(f => f.id === id ? { ...f, status: "done", progress: 100 } : f));
      } else {
        setFiles(prev => prev.map(f => f.id === id ? { ...f, progress } : f));
      }
    }, 180);
  };

  const analyzeFile = async (id) => {
    const file = files.find(f => f.id === id);
    if (!file) return;

    if (!apiKey) {
      setShowKeyInput(true);
      return;
    }

    setFiles(prev => prev.map(f => f.id === id ? { ...f, status: "analyzing" } : f));

    let textContent = "";
    if (file.raw.type === "text/plain" || file.raw.type === "text/csv") {
      textContent = await file.raw.text();
    }

    const prompt = textContent
      ? `Analyze this file named "${file.raw.name}".\n\nContent:\n${textContent.slice(0, 3000)}\n\nProvide:\n## Summary\n## Key Insights\n## Recommended Actions`
      : `Analyze a file named "${file.raw.name}" (${formatSize(file.raw.size)}, type: ${file.raw.type || "unknown"}).\nProvide:\n## Summary\n## Key Insights\n## Recommended Actions`;

    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          max_tokens: 1000,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      const text = data.choices?.[0]?.message?.content || "No analysis returned.";
      setFiles(prev => prev.map(f => f.id === id ? { ...f, status: "analyzed" } : f));
      setAnalysis(text);
      setShowPanel(true);
    } catch (e) {
      setFiles(prev => prev.map(f => f.id === id ? { ...f, status: "error" } : f));
    }
  };

  const removeFile = (id) => setFiles(prev => prev.filter(f => f.id !== id));

  const onDrop = (e) => {
    e.preventDefault();
    dragCounter.current = 0;
    setDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const onDragEnter = (e) => {
    e.preventDefault();
    dragCounter.current++;
    setDragging(true);
  };

  const onDragLeave = (e) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) setDragging(false);
  };

  const totalFiles = files.length;
  const doneFiles = files.filter(f => f.status === "done" || f.status === "analyzed" || f.status === "analyzing").length;
  const analyzedFiles = files.filter(f => f.status === "analyzed").length;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        
        * { box-sizing: border-box; margin: 0; padding: 0; }
        
        .cm-root {
          font-family: 'Sora', sans-serif;
          background: #080c14;
          min-height: 100vh;
          color: #e2e8f0;
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 20px;
          background-image: radial-gradient(ellipse at 20% 20%, rgba(99,102,241,0.08) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 80%, rgba(139,92,246,0.06) 0%, transparent 50%);
        }

        .cm-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-bottom: 16px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }

        .cm-logo {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .cm-logo-mark {
          width: 36px; height: 36px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          font-size: 18px;
          box-shadow: 0 0 20px rgba(99,102,241,0.4);
        }

        .cm-logo-text {
          font-size: 18px;
          font-weight: 700;
          background: linear-gradient(135deg, #a5b4fc, #c4b5fd);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          letter-spacing: -0.5px;
        }

        .cm-logo-sub {
          font-size: 11px;
          color: #64748b;
          font-family: 'JetBrains Mono', monospace;
          letter-spacing: 1px;
          text-transform: uppercase;
        }

        .api-key-btn {
          background: rgba(99,102,241,0.1);
          border: 1px solid rgba(99,102,241,0.2);
          color: #a5b4fc;
          padding: 6px 14px;
          border-radius: 8px;
          font-size: 12px;
          cursor: pointer;
          font-family: 'JetBrains Mono', monospace;
          transition: all 0.2s;
        }
        .api-key-btn:hover { background: rgba(99,102,241,0.2); }

        .api-key-form {
          display: flex; gap: 8px;
          background: rgba(15,20,35,0.9);
          border: 1px solid rgba(99,102,241,0.2);
          border-radius: 10px;
          padding: 12px 16px;
          align-items: center;
        }

        .api-key-input {
          flex: 1;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          color: #e2e8f0;
          padding: 8px 12px;
          border-radius: 7px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
          outline: none;
        }
        .api-key-input:focus { border-color: rgba(99,102,241,0.5); }

        .save-key-btn {
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          border: none; color: white;
          padding: 8px 16px; border-radius: 7px;
          font-size: 12px; cursor: pointer; font-family: 'Sora', sans-serif;
          font-weight: 600;
        }

        .stats-row {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
        }

        .stat-card {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 12px;
          padding: 16px;
          display: flex; flex-direction: column; gap: 4px;
        }

        .stat-num {
          font-size: 28px;
          font-weight: 700;
          font-family: 'JetBrains Mono', monospace;
          background: linear-gradient(135deg, #a5b4fc, #c4b5fd);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .stat-label {
          font-size: 11px;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.8px;
        }

        .drop-zone {
          border: 2px dashed rgba(99,102,241,0.25);
          border-radius: 16px;
          padding: 48px 24px;
          text-align: center;
          cursor: pointer;
          transition: all 0.25s ease;
          background: rgba(99,102,241,0.02);
          position: relative;
          overflow: hidden;
        }

        .drop-zone::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse at center, rgba(99,102,241,0.06) 0%, transparent 70%);
          opacity: 0;
          transition: opacity 0.3s;
        }

        .drop-zone.active {
          border-color: rgba(99,102,241,0.7);
          background: rgba(99,102,241,0.08);
          transform: scale(1.01);
          box-shadow: 0 0 40px rgba(99,102,241,0.15);
        }
        .drop-zone.active::before { opacity: 1; }
        .drop-zone:hover { border-color: rgba(99,102,241,0.4); background: rgba(99,102,241,0.04); }

        .drop-icon {
          width: 64px; height: 64px;
          margin: 0 auto 16px;
          background: linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.15));
          border: 1px solid rgba(99,102,241,0.2);
          border-radius: 20px;
          display: flex; align-items: center; justify-content: center;
          font-size: 28px;
          transition: transform 0.3s;
        }

        .drop-zone.active .drop-icon { transform: scale(1.1) translateY(-4px); }

        .drop-title {
          font-size: 16px;
          font-weight: 600;
          color: #e2e8f0;
          margin-bottom: 6px;
        }

        .drop-sub {
          font-size: 13px;
          color: #64748b;
          margin-bottom: 20px;
        }

        .drop-sub span {
          color: #a5b4fc;
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
        }

        .import-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          color: white;
          border: none;
          padding: 12px 28px;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          font-family: 'Sora', sans-serif;
          transition: all 0.2s;
          box-shadow: 0 4px 20px rgba(99,102,241,0.35);
          position: relative;
          z-index: 1;
        }

        .import-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 30px rgba(99,102,241,0.5);
        }
        .import-btn:active { transform: translateY(0); }

        .file-types-hint {
          margin-top: 14px;
          display: flex; flex-wrap: wrap; gap: 6px; justify-content: center;
        }

        .ftype-chip {
          font-size: 10px;
          font-family: 'JetBrains Mono', monospace;
          padding: 3px 8px;
          border-radius: 5px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.06);
          color: #94a3b8;
        }

        .files-section {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .files-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 2px;
        }

        .files-title {
          font-size: 12px;
          font-weight: 600;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .clear-btn {
          font-size: 11px;
          color: #ef4444;
          background: none;
          border: none;
          cursor: pointer;
          font-family: 'Sora', sans-serif;
          opacity: 0.6;
          transition: opacity 0.2s;
        }
        .clear-btn:hover { opacity: 1; }

        .file-card {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 12px;
          padding: 14px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          transition: border-color 0.2s;
          animation: slideIn 0.3s ease;
        }

        @keyframes slideIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .file-card:hover { border-color: rgba(255,255,255,0.1); }

        .file-card-left {
          display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0;
        }

        .file-icon-wrap {
          width: 44px; height: 44px;
          border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }

        .file-meta {
          flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px;
        }

        .file-name {
          font-size: 13px;
          font-weight: 500;
          color: #e2e8f0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .file-sub {
          font-size: 11px;
          color: #64748b;
          font-family: 'JetBrains Mono', monospace;
        }

        .progress-bar-wrap {
          height: 3px;
          background: rgba(255,255,255,0.06);
          border-radius: 99px;
          overflow: hidden;
          margin-top: 4px;
        }

        .progress-bar {
          height: 100%;
          border-radius: 99px;
          transition: width 0.2s ease;
        }

        .status-badge {
          font-size: 10px;
          font-family: 'JetBrains Mono', monospace;
          padding: 2px 8px;
          border-radius: 5px;
          display: inline-block;
          width: fit-content;
          margin-top: 2px;
        }

        .status-badge.done { background: rgba(34,197,94,0.1); color: #4ade80; border: 1px solid rgba(34,197,94,0.2); }
        .status-badge.analyzing { background: rgba(245,158,11,0.1); color: #fbbf24; border: 1px solid rgba(245,158,11,0.2); }
        .status-badge.analyzed { background: rgba(99,102,241,0.1); color: #a5b4fc; border: 1px solid rgba(99,102,241,0.2); }
        .status-badge.error { background: rgba(239,68,68,0.1); color: #f87171; border: 1px solid rgba(239,68,68,0.2); }

        .file-card-right {
          display: flex; align-items: center; gap: 8px; flex-shrink: 0;
        }

        .analyze-btn {
          font-size: 12px;
          font-weight: 600;
          font-family: 'Sora', sans-serif;
          padding: 6px 14px;
          border-radius: 7px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .analyze-btn:hover { transform: translateY(-1px); }

        .done-btn {
          background: rgba(99,102,241,0.12) !important;
          color: #a5b4fc !important;
          border: 1px solid rgba(99,102,241,0.25) !important;
        }

        .remove-btn {
          width: 28px; height: 28px;
          background: rgba(239,68,68,0.08);
          border: 1px solid rgba(239,68,68,0.15);
          color: #f87171;
          border-radius: 7px;
          cursor: pointer;
          font-size: 11px;
          transition: all 0.2s;
          display: flex; align-items: center; justify-content: center;
        }
        .remove-btn:hover { background: rgba(239,68,68,0.18); transform: scale(1.1); }

        .analysis-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.7);
          backdrop-filter: blur(8px);
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          animation: fadeIn 0.25s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .analysis-panel {
          background: #0d1424;
          border: 1px solid rgba(99,102,241,0.25);
          border-radius: 20px;
          width: 100%;
          max-width: 560px;
          max-height: 80vh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          box-shadow: 0 20px 80px rgba(0,0,0,0.6), 0 0 60px rgba(99,102,241,0.1);
          animation: slideUp 0.3s ease;
        }

        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        .analysis-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 24px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }

        .analysis-title {
          font-size: 15px;
          font-weight: 700;
          background: linear-gradient(135deg, #a5b4fc, #c4b5fd);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .close-btn {
          width: 30px; height: 30px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.08);
          color: #94a3b8;
          border-radius: 8px;
          cursor: pointer;
          font-size: 12px;
          transition: all 0.2s;
          display: flex; align-items: center; justify-content: center;
        }
        .close-btn:hover { background: rgba(239,68,68,0.15); color: #f87171; }

        .analysis-body {
          padding: 20px 24px;
          overflow-y: auto;
          flex: 1;
          line-height: 1.7;
        }

        .empty-hint {
          text-align: center;
          padding: 32px;
          color: #475569;
          font-size: 13px;
        }
      `}</style>

      <div className="cm-root">
        {/* Header */}
        <div className="cm-header">
          <div className="cm-logo">
            <div className="cm-logo-mark">🧠</div>
            <div>
              <div className="cm-logo-text">CampusMind</div>
              <div className="cm-logo-sub">Import & Analyze</div>
            </div>
          </div>
          <button className="api-key-btn" onClick={() => setShowKeyInput(v => !v)}>
            {apiKey ? "✓ Groq Key Set" : "⚙ Set Groq API Key"}
          </button>
        </div>

        {/* API Key Input */}
        {showKeyInput && (
          <div className="api-key-form">
            <input
              className="api-key-input"
              type="password"
              placeholder="gsk_..."
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
            />
            <button className="save-key-btn" onClick={() => setShowKeyInput(false)}>Save</button>
          </div>
        )}

        {/* Stats */}
        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-num">{totalFiles}</div>
            <div className="stat-label">Total Imported</div>
          </div>
          <div className="stat-card">
            <div className="stat-num">{doneFiles}</div>
            <div className="stat-label">Ready</div>
          </div>
          <div className="stat-card">
            <div className="stat-num">{analyzedFiles}</div>
            <div className="stat-label">Analyzed</div>
          </div>
        </div>

        {/* Drop Zone */}
        <div
          className={`drop-zone ${dragging ? "active" : ""}`}
          onDragEnter={onDragEnter}
          onDragLeave={onDragLeave}
          onDragOver={e => e.preventDefault()}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="drop-icon">{dragging ? "⬇️" : "☁️"}</div>
          <div className="drop-title">{dragging ? "Drop files to import" : "Drag & drop your files here"}</div>
          <div className="drop-sub">
            or click to browse · supports <span>any file type</span> · up to 500MB per file
          </div>
          <button className="import-btn" onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}>
            <span>⬆</span> Import Files
          </button>
          <div className="file-types-hint">
            {["PDF", "DOCX", "XLSX", "CSV", "TXT", "PNG", "JPG", "MP4", "MP3"].map(t => (
              <span key={t} className="ftype-chip">{t}</span>
            ))}
            <span className="ftype-chip">+ more</span>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            style={{ display: "none" }}
            onChange={e => { addFiles(e.target.files); e.target.value = ""; }}
          />
        </div>

        {/* File List */}
        {files.length > 0 ? (
          <div className="files-section">
            <div className="files-header">
              <div className="files-title">Imported Files ({files.length})</div>
              <button className="clear-btn" onClick={() => setFiles([])}>Clear all</button>
            </div>
            {files.map(f => (
              <FileCard key={f.id} file={f} onRemove={removeFile} onAnalyze={analyzeFile} />
            ))}
          </div>
        ) : (
          <div className="empty-hint">No files imported yet · drag files above or click Import Files</div>
        )}

        {/* Analysis Modal */}
        {showPanel && analysis && (
          <AnalysisPanel analysis={analysis} onClose={() => setShowPanel(false)} />
        )}
      </div>
    </>
  );
}
