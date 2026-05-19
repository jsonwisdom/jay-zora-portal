import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const BASE = import.meta.env.BASE_URL;
const FOREST_URL = `${BASE}forest.json`;
const HISTORY_URL = `${BASE}data/history.json`;
const PERMISSIONS_URL = `${BASE}data/permissions.json`;
const ACTIVITY_URL = `${BASE}data/activity.json`;
const REPLAY_URL = `${BASE}data/replay-events.json`;
const OBSERVERS_URL = `${BASE}data/observers.json`;
const HEATMAP_URL = `${BASE}data/heatmap.json`;
const ZORA_INDEX_URL = `${BASE}zora-index.json`;
const FLYWHEEL_URL = "https://zora.co/coin/base:0x5e35e630356a1b24d1b45078918ea60ef98e915a?referrer=0x829adfedbe565f9885a7ea6bc78912acaef055e2";
const GITHUB_URL = "https://github.com/jsonwisdom/jay-zora-portal";

function short(v) {
  if (!v) return "missing";
  const s = String(v);
  return s.length > 18 ? `${s.slice(0, 10)}…${s.slice(-8)}` : s;
}

function verifierState({ forest, history }) {
  if (!forest) return { label: "LOADING", tone: "pending", ring: "HOLLOW" };
  if (!forest.forest_root_sha256) return { label: "LOCAL VALID / ROOT PENDING", tone: "pending", ring: "HOLLOW" };
  const roots = history?.roots || [];
  const anchored = roots.some((r) => r.forest_root_sha256 === forest.forest_root_sha256 && r.attestation_uid);
  return anchored
    ? { label: "VALID + ANCHORED", tone: "valid", ring: "GOLD" }
    : { label: "VALID / WITNESS UNANCHORED", tone: "warn", ring: "BROKEN GOLD" };
}

function eventState(event) {
  if (event.type === "checkpoint") return "reconciled";
  if (event.to?.includes("zora")) return "canonical";
  if (event.to?.includes("computerwisdom")) return "fork";
  return "canonical";
}

function App() {
  const [forest, setForest] = useState(null);
  const [history, setHistory] = useState(null);
  const [permissions, setPermissions] = useState(null);
  const [activity, setActivity] = useState(null);
  const [replay, setReplay] = useState([]);
  const [observers, setObservers] = useState([]);
  const [heatmap, setHeatmap] = useState([]);
  const [timeIndex, setTimeIndex] = useState(999);
  const [zoraCount, setZoraCount] = useState(0);
  const [selected, setSelected] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [drag, setDrag] = useState(null);

  useEffect(() => {
    async function load() {
      const [forestRes, historyRes, permissionsRes, activityRes, replayRes, observersRes, heatmapRes, zoraRes] = await Promise.allSettled([
        fetch(FOREST_URL, { cache: "no-store" }).then((r) => r.json()),
        fetch(HISTORY_URL, { cache: "no-store" }).then((r) => r.json()),
        fetch(PERMISSIONS_URL, { cache: "no-store" }).then((r) => r.json()),
        fetch(ACTIVITY_URL, { cache: "no-store" }).then((r) => r.json()),
        fetch(REPLAY_URL, { cache: "no-store" }).then((r) => r.json()),
        fetch(OBSERVERS_URL, { cache: "no-store" }).then((r) => r.json()),
        fetch(HEATMAP_URL, { cache: "no-store" }).then((r) => r.json()),
        fetch(ZORA_INDEX_URL, { cache: "no-store" }).then((r) => r.json()),
      ]);
      if (forestRes.status === "fulfilled") setForest(forestRes.value);
      if (historyRes.status === "fulfilled") setHistory(historyRes.value);
      if (permissionsRes.status === "fulfilled") setPermissions(permissionsRes.value);
      if (activityRes.status === "fulfilled") setActivity(activityRes.value);
      if (replayRes.status === "fulfilled") {
        const events = replayRes.value.events || [];
        setReplay(events);
        setTimeIndex(events.length ? events.length - 1 : 0);
      }
      if (observersRes.status === "fulfilled") setObservers(observersRes.value.observers || []);
      if (heatmapRes.status === "fulfilled") setHeatmap(heatmapRes.value.edges || []);
      if (zoraRes.status === "fulfilled") setZoraCount(Array.isArray(zoraRes.value) ? zoraRes.value.length : zoraRes.value.results?.length || 0);
    }
    load();
  }, []);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") {
        setSelected(null);
        setZoom(1);
        setPan({ x: 0, y: 0 });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const state = verifierState({ forest, history });
  const groves = forest?.groves || [];
  const leaves = forest?.leaves || [];
  const selectedLeaves = selected ? leaves.filter((leaf) => leaf.grove === selected.id) : [];
  const subjects = permissions?.subjects ? Object.keys(permissions.subjects).length : 0;
  const visibleGhosts = replay.slice(0, Math.min(timeIndex + 1, replay.length));
  const currentEvent = replay[Math.min(timeIndex, Math.max(replay.length - 1, 0))];

  const positions = useMemo(() => {
    const count = Math.max(groves.length, 1);
    return groves.map((grove, i) => {
      const angle = (-90 + (360 / count) * i) * (Math.PI / 180);
      const radius = 38;
      return { ...grove, x: 50 + Math.cos(angle) * radius, y: 50 + Math.sin(angle) * radius, delay: `${i * 1.15}s` };
    });
  }, [groves]);

  function wheel(e) {
    e.preventDefault();
    setZoom((z) => Math.min(2.4, Math.max(0.72, z + (e.deltaY < 0 ? 0.12 : -0.12))));
  }

  function pointerDown(e) {
    setDrag({ x: e.clientX, y: e.clientY, pan });
  }

  function pointerMove(e) {
    if (!drag) return;
    setPan({ x: drag.pan.x + e.clientX - drag.x, y: drag.pan.y + e.clientY - drag.y });
  }

  function ghostPath(event) {
    const x = event.payload?.grove_x || 50;
    const y = event.payload?.grove_y || 88;
    return `M 50 88 C 50 58, ${x - 8} 62, ${x} ${y}`;
  }

  function observerEvents(observer) {
    const visible = observer.visible_states || ["canonical", "reconciled"];
    return visibleGhosts.filter((event) => visible.includes(eventState(event)));
  }

  return (
    <main className={`observatory ${state.tone}`}>
      <div className="space-layer stars" />
      <div className="space-layer nebula" />
      <div className="space-layer dust" />
      <div className="space-layer vignette" />

      <header className="hud top-left">
        <strong>JAYSPACE // CHECKPOINT-000000</strong>
        <span>STATE: {state.label}</span>
        <span>RING: {state.ring}</span>
      </header>

      <section className="hud top-right">
        <span>FOREST ROOT</span>
        <strong>{short(forest?.forest_root_sha256)}</strong>
        <span>LEAVES: {forest?.leaf_count || leaves.length}</span>
        <span>OBSERVERS: {observers.length}</span>
        <span>PRESSURE EDGES: {heatmap.length}</span>
      </section>

      <section
        className="forest-stage"
        onWheel={wheel}
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={() => setDrag(null)}
        onDoubleClick={() => setZoom((z) => Math.min(2.4, z + 0.35))}
      >
        <div className="forest-camera" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
          <svg className="flow-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" fill="none">
            {observers.map((observer, oi) => observerEvents(observer).map((event, ei) => (
              <path
                key={`${observer.id}-${event.id}`}
                className={`observer-path ${observer.color} ${eventState(event)}`}
                style={{ animationDelay: `${(oi * .8) + (ei * .18)}s`, opacity: observer.detail === "low" ? .12 : .24 }}
                d={ghostPath(event)}
                fill="none"
                vectorEffect="non-scaling-stroke"
              />
            )))}
            {visibleGhosts.map((event, i) => (
              <path key={event.id} className={`ghost-path ${event.type}`} style={{ animationDelay: `${i * .24}s` }} d={ghostPath(event)} fill="none" vectorEffect="non-scaling-stroke" />
            ))}
            {positions.map((grove, i) => (
              <path key={grove.id} className="flow-path" style={{ animationDelay: `${i * 1.4}s` }} d={`M 50 88 C 50 58, ${grove.x - 8} 62, ${grove.x} ${grove.y}`} fill="none" vectorEffect="non-scaling-stroke" />
            ))}
          </svg>
          <div className="root-node" onClick={() => setSelected(null)}>
            <span>CHECKPOINT 0</span>
            <strong>{state.tone === "valid" ? "ANCHORED" : "LOCAL VALID"}</strong>
          </div>
          <div className="trunk" />
          <div className="replay-dot" />
          <div className={`witness-ring ${state.tone}`} />
          {visibleGhosts.filter((event) => event.type === "checkpoint").map((event, i) => (
            <div key={`${event.id}-ring`} className="ghost-ring" style={{ animationDelay: `${i * .5}s` }} />
          ))}
          {positions.map((grove) => (
            <button
              key={grove.id}
              className={`grove-node ${selected?.id === grove.id ? "selected" : ""}`}
              style={{ left: `${grove.x}%`, top: `${grove.y}%`, animationDelay: grove.delay }}
              onClick={(e) => { e.stopPropagation(); setSelected(grove); setZoom(1.45); }}
            >
              <span>{grove.leaf_count || grove.leaves?.length || 0}</span>
              <strong>{grove.title}</strong>
              <small>{short(grove.grove_hash)}</small>
            </button>
          ))}
        </div>
      </section>

      <aside className="leaf-inspector">
        <div className="eyebrow">{selected ? "Grove Inspection" : "Multi-Observer Replay"}</div>
        <h1>{selected?.title || "Consensus Field"}</h1>
        <p>{selected?.description || "One receipt stream. Multiple observer lenses. Disagreement becomes visible geometry."}</p>
        <div className="inspector-grid">
          <div><strong>{forest?.leaf_count || 0}</strong><span>proof leaves</span></div>
          <div><strong>{observers.length}</strong><span>observers</span></div>
          <div><strong>{heatmap.filter((e) => e.status === "disputed").length}</strong><span>hot zones</span></div>
        </div>
        {observers.length > 0 && (
          <div className="observer-legend">
            {observers.map((observer) => (
              <span key={observer.id} className={`observer-pill ${observer.color}`}>{observer.label}</span>
            ))}
          </div>
        )}
        {replay.length > 0 && (
          <div className="time-archaeology">
            <label>Time Archaeology</label>
            <input type="range" min="0" max={replay.length - 1} value={timeIndex} onChange={(e) => setTimeIndex(Number(e.target.value))} />
            <strong>{currentEvent?.label || "Live forest"}</strong>
            <span>{currentEvent?.timestamp || "present"}</span>
          </div>
        )}
        {selected && (
          <div className="leaf-list">
            {selectedLeaves.map((leaf) => (
              <a key={leaf.id} href={`${BASE}${leaf.leaf_path}`} target="_blank" rel="noreferrer">
                <strong>{leaf.title}</strong>
                <span>{leaf.status} · {short(leaf.leaf_hash)}</span>
              </a>
            ))}
          </div>
        )}
        <div className="actions-row">
          <a href={FLYWHEEL_URL} target="_blank" rel="noreferrer">Zora</a>
          <a href={GITHUB_URL} target="_blank" rel="noreferrer">GitHub</a>
          <a href={`${BASE}forest.json`} target="_blank" rel="noreferrer">forest.json</a>
        </div>
      </aside>

      <section className="runtime-card" aria-label="Live Replay Runtime">
        <div className="runtime-grid" />
        <div className="runtime-orb" />
        <div className="runtime-kicker"><span />JAYSPACE SPECIFICATION</div>
        <div className="runtime-badge">LIVE • v1.0.3</div>
        <h2>JAYSPACE — <em>LIVE_REPLAY_RUNTIME</em></h2>
        <p className="runtime-subtitle">FULL_SEND acknowledged. JSONL is now constitutional replay transport, not documentation.</p>
        <div className="runtime-pipeline">stdin/jsonl → validator → quarantine → replay → watermark → observers → grove mutation → pulse → feed</div>
        <div className="runtime-guarantees">
          <span>full_archive_required: false</span>
          <span>line_level_state_motion: true</span>
          <span>idempotent_replay: true</span>
          <span>quarantine_without_halt: true</span>
          <span>observer_projection_isolated: true</span>
          <span>semantic_capture_forbidden: true</span>
        </div>
        <blockquote>The substrate remembers exactly. Humans remember approximately. Civilization survives because both remain interoperable.</blockquote>
      </section>

      <footer className="hud bottom-line">
        <span>cyan canonical</span>
        <span>amber auditor</span>
        <span>red disputed</span>
        <span>white reconciled</span>
      </footer>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
