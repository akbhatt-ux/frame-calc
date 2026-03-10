import { useState, useEffect, useRef } from "react";

const PRESETS = [23.976, 24, 25, 29.97, 30, 50, 59.94, 60];
const ANIM_TYPES = ["position", "scale", "rotation"];

const BEZIER_PRESETS = [
  { label: "Ease", value: "0.25,0.1,0.25,1" },
  { label: "Ease In", value: "0.42,0,1,1" },
  { label: "Ease Out", value: "0,0,0.58,1" },
  { label: "Ease In Out", value: "0.42,0,0.58,1" },
  { label: "Overshoot", value: "0.68,-0.6,0.32,1.6" },
  { label: "Snap", value: "0.4,0,1,1" },
];

export default function FrameCalc() {
  const [fps, setFps] = useState("24");
  const [frames, setFrames] = useState("24");
  const [animType, setAnimType] = useState("position");
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [bezierInput, setBezierInput] = useState("0.42,0,0.58,1");
  const [bezierError, setBezierError] = useState(false);
  const [useCustom, setUseCustom] = useState(false);
  const rafRef = useRef(null);
  const startRef = useRef(null);
  const pausedAtRef = useRef(0);

  const fpsNum = parseFloat(fps);
  const framesNum = parseInt(frames);
  const valid = fpsNum > 0 && framesNum >= 0 && !isNaN(fpsNum) && !isNaN(framesNum);
  const ms = valid ? (framesNum / fpsNum) * 1000 : null;
  const duration = ms && ms > 0 ? ms : 1000;

  const secondary = () => {
    if (!valid || ms === null) return null;
    const s = ms / 1000;
    if (s < 1) return null;
    if (s < 60) return `${s.toFixed(4)}s`;
    const m = Math.floor(s / 60), rem = (s % 60).toFixed(3).padStart(6, "0");
    return `${m}m ${rem}s`;
  };

  const solveBezier = (x1, y1, x2, y2, t) => {
    const bx = s => 3*s*(1-s)*(1-s)*x1 + 3*s*s*(1-s)*x2 + s*s*s;
    const bxd = s => 3*(1-s)*(1-s)*x1 + 6*s*(1-s)*(x2-x1) + 3*s*s*(1-x2);
    let s = t;
    for (let i = 0; i < 8; i++) s -= (bx(s) - t) / (bxd(s) || 1e-6);
    s = Math.max(0, Math.min(1, s));
    return 3*s*(1-s)*(1-s)*y1 + 3*s*s*(1-s)*y2 + s*s*s;
  };

  const parsedBezier = (str = bezierInput) => {
    const parts = str.split(",").map(Number);
    if (parts.length === 4 && parts.every(n => !isNaN(n))) return parts;
    return null;
  };

  const ease = t => {
    if (useCustom) {
      const b = parsedBezier();
      if (b) return solveBezier(b[0], b[1], b[2], b[3], t);
    }
    return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2;
  };

  useEffect(() => {
    if (!playing) return;
    startRef.current = null;
    const tick = ts => {
      if (!startRef.current) startRef.current = ts - pausedAtRef.current * duration;
      setProgress(((ts - startRef.current) % duration) / duration);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing, duration]);

  const togglePlay = () => {
    if (playing) { pausedAtRef.current = progress; cancelAnimationFrame(rafRef.current); }
    else startRef.current = null;
    setPlaying(p => !p);
  };

  const e = ease(progress);
  const ballSize = 28;
  const trackW = 300;
  const trackH = 80;

  const getBallStyle = () => {
    const base = { width: ballSize, height: ballSize, borderRadius: "50%", background: "radial-gradient(circle at 35% 35%, #ff8060, #ff2200)", boxShadow: "0 4px 16px #ff5c3560", position: "absolute" };
    if (animType === "position") return { ...base, left: e * (trackW - ballSize), top: (trackH - ballSize) / 2 };
    if (animType === "scale") return { ...base, left: (trackW - ballSize) / 2, top: (trackH - ballSize) / 2, transform: `scale(${(0.3 + e * 0.7).toFixed(3)})`, transformOrigin: "center" };
    if (animType === "rotation") {
      const cx = (trackW - ballSize) / 2, cy = (trackH - ballSize) / 2;
      const rad = (e * 360 - 90) * Math.PI / 180;
      return { ...base, left: cx + 28 * Math.cos(rad), top: cy + 28 * Math.sin(rad) };
    }
  };

  // Bezier curve SVG path
  const CurvePreview = () => {
    const b = parsedBezier();
    const S = 100; // svg size
    const pad = 14;
    const w = S - pad * 2;
    // clamp y to reasonable range for display
    const yMin = -0.5, yMax = 1.5;
    const toSvg = (px, py) => [
      pad + px * w,
      pad + (1 - (py - yMin) / (yMax - yMin)) * w
    ];

    const [x1, y1, x2, y2] = b || [0.42, 0, 0.58, 1];
    const [p0x, p0y] = toSvg(0, 0);
    const [c1x, c1y] = toSvg(x1, y1);
    const [c2x, c2y] = toSvg(x2, y2);
    const [p3x, p3y] = toSvg(1, 1);

    // build curve path via many points
    let pathD = "";
    for (let i = 0; i <= 60; i++) {
      const t = i / 60;
      const bxt = 3*t*(1-t)*(1-t)*x1 + 3*t*t*(1-t)*x2 + t*t*t;
      const byt = 3*t*(1-t)*(1-t)*y1 + 3*t*t*(1-t)*y2 + t*t*t;
      const [sx, sy] = toSvg(bxt, byt);
      pathD += i === 0 ? `M${sx},${sy}` : ` L${sx},${sy}`;
    }

    // progress dot on curve
    const pb = b || [0.42, 0, 0.58, 1];
    const pt = progress;
    const dotBx = 3*pt*(1-pt)*(1-pt)*pb[0] + 3*pt*pt*(1-pt)*pb[2] + pt*pt*pt;
    const dotBy = 3*pt*(1-pt)*(1-pt)*pb[1] + 3*pt*pt*(1-pt)*pb[3] + pt*pt*pt;
    const [dotX, dotY] = toSvg(dotBx, dotBy);
    // progress lines
    const [progLineX] = toSvg(dotBx, 0);
    const [, progLineY] = toSvg(0, dotBy);

    return (
      <svg width={S} height={S} style={{ display: "block" }}>
        {/* grid */}
        {[0, 0.25, 0.5, 0.75, 1].map(v => {
          const [gx] = toSvg(v, 0); const [, gy] = toSvg(0, v);
          return (
            <g key={v}>
              <line x1={gx} y1={pad} x2={gx} y2={pad + w} stroke="#1e1e22" strokeWidth="1" />
              <line x1={pad} y1={gy} x2={pad + w} y2={gy} stroke="#1e1e22" strokeWidth="1" />
            </g>
          );
        })}
        {/* 0-1 box */}
        <rect x={pad} y={toSvg(0,1)[1]} width={w} height={toSvg(0,0)[1] - toSvg(0,1)[1]} fill="none" stroke="#252528" strokeWidth="1" />
        {/* control handles */}
        <line x1={p0x} y1={p0y} x2={c1x} y2={c1y} stroke="#ffffff15" strokeWidth="1" strokeDasharray="2,2" />
        <line x1={p3x} y1={p3y} x2={c2x} y2={c2y} stroke="#ffffff15" strokeWidth="1" strokeDasharray="2,2" />
        <circle cx={c1x} cy={c1y} r={3} fill="none" stroke="#ffffff30" strokeWidth="1" />
        <circle cx={c2x} cy={c2y} r={3} fill="none" stroke="#ffffff30" strokeWidth="1" />
        {/* curve */}
        <path d={pathD} fill="none" stroke="#ff5c35" strokeWidth="1.5" strokeLinecap="round" />
        {/* endpoints */}
        <circle cx={p0x} cy={p0y} r={3} fill="#333" stroke="#555" strokeWidth="1" />
        <circle cx={p3x} cy={p3y} r={3} fill="#333" stroke="#555" strokeWidth="1" />
      </svg>
    );
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0a0b", fontFamily: "'Inter', system-ui, sans-serif", color: "#f0f0f0", padding: "2rem 0" }}>
      <div style={{ width: 400, padding: "2rem", background: "#111113", borderRadius: 20, boxShadow: "0 20px 60px #00000080", border: "1px solid #1e1e22" }}>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "1.75rem" }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#ff5c35" }} />
          <span style={{ fontSize: ".75rem", fontWeight: 600, letterSpacing: ".1em", color: "#555", textTransform: "uppercase" }}>Frames → ms</span>
        </div>

        <div style={{ marginBottom: "1.25rem" }}>
          <label style={labelStyle}>Frame Rate</label>
          <div style={{ position: "relative" }}>
            <input type="number" value={fps} onChange={e => setFps(e.target.value)} placeholder="24" style={inputStyle} />
            <span style={unitStyle}>fps</span>
          </div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 8 }}>
            {PRESETS.map(p => (
              <button key={p} onClick={() => setFps(String(p))} style={{ background: parseFloat(fps) === p ? "#ff5c35" : "#1a1a1e", color: parseFloat(fps) === p ? "#fff" : "#555", border: `1px solid ${parseFloat(fps) === p ? "#ff5c35" : "#252528"}`, borderRadius: 6, padding: "3px 8px", fontSize: ".72rem", cursor: "pointer", fontWeight: 500, transition: "all .15s" }}>{p}</button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: "1.75rem" }}>
          <label style={labelStyle}>Frames</label>
          <div style={{ position: "relative" }}>
            <input type="number" value={frames} onChange={e => setFrames(e.target.value)} placeholder="0" style={inputStyle} />
            <span style={unitStyle}>f</span>
          </div>
        </div>

        {/* Result */}
        <div style={{ background: "#0a0a0b", borderRadius: 14, padding: "1.5rem", textAlign: "center", border: `1px solid ${valid ? "#ff5c3530" : "#1a1a1e"}`, marginBottom: "1rem" }}>
          <div style={{ fontSize: "2.8rem", fontWeight: 700, letterSpacing: "-.03em", color: valid ? "#fff" : "#222", fontVariantNumeric: "tabular-nums" }}>
            {valid ? ms.toFixed(3) : "0.000"}
          </div>
          <div style={{ fontSize: ".85rem", color: "#ff5c35", fontWeight: 600, marginTop: 2 }}>milliseconds</div>
          {secondary() && <div style={{ fontSize: ".78rem", color: "#444", marginTop: 8 }}>{secondary()}</div>}
          {valid && <div style={{ fontSize: ".7rem", color: "#333", marginTop: 6 }}>{framesNum} frame{framesNum !== 1 ? "s" : ""} ÷ {fpsNum} fps × 1000</div>}
        </div>

        {/* Preview Panel */}
        <div style={{ background: "#0a0a0b", borderRadius: 14, border: "1px solid #1a1a1e", overflow: "hidden" }}>
          {/* Tabs */}
          <div style={{ display: "flex", borderBottom: "1px solid #1a1a1e" }}>
            {ANIM_TYPES.map(t => (
              <button key={t} onClick={() => setAnimType(t)} style={{ flex: 1, padding: "0.6rem 0", background: animType === t ? "#141416" : "transparent", color: animType === t ? "#ff5c35" : "#444", border: "none", cursor: "pointer", fontSize: ".72rem", fontWeight: 600, letterSpacing: ".07em", textTransform: "uppercase", borderBottom: animType === t ? "2px solid #ff5c35" : "2px solid transparent", transition: "all .15s" }}>{t}</button>
            ))}
          </div>

          {/* Stage */}
          <div style={{ padding: "1rem 1rem 0.5rem", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ position: "relative", width: trackW, height: trackH, background: "#0d0d0f", borderRadius: 10, overflow: "hidden", border: "1px solid #1a1a1e" }}>
              {animType === "position" && <>
                <div style={{ position: "absolute", left: ballSize/2, top: "50%", width: trackW - ballSize, height: 1, background: "#1e1e22", transform: "translateY(-50%)" }} />
                <div style={{ position: "absolute", left: 2, top: "50%", width: 6, height: 6, borderRadius: "50%", background: "#252528", transform: "translateY(-50%)" }} />
                <div style={{ position: "absolute", right: 2, top: "50%", width: 6, height: 6, borderRadius: "50%", background: "#252528", transform: "translateY(-50%)" }} />
              </>}
              {animType === "scale" && <>
                <div style={{ position: "absolute", left: "50%", top: "50%", width: ballSize*0.3, height: ballSize*0.3, borderRadius: "50%", border: "1px dashed #1e1e22", transform: "translate(-50%,-50%)" }} />
                <div style={{ position: "absolute", left: "50%", top: "50%", width: ballSize, height: ballSize, borderRadius: "50%", border: "1px dashed #1e1e22", transform: "translate(-50%,-50%)" }} />
              </>}
              {animType === "rotation" && <div style={{ position: "absolute", left: (trackW-ballSize)/2 + ballSize/2 - 28, top: (trackH-ballSize)/2 + ballSize/2 - 28, width: 56, height: 56, borderRadius: "50%", border: "1px dashed #ffffff10" }} />}
              <div style={getBallStyle()} />
            </div>

            {/* Playhead */}
            <div style={{ width: trackW, marginTop: 10, marginBottom: 4 }}>
              <div style={{ position: "relative", height: 3, background: "#1a1a1e", borderRadius: 2 }}>
                <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${Math.round(progress*100)}%`, background: "#ff5c35", borderRadius: 2 }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}>
                <span style={{ fontSize: ".65rem", color: "#333" }}>0ms</span>
                <span style={{ fontSize: ".65rem", color: "#ff5c3580" }}>{Math.round(progress * duration)}ms</span>
                <span style={{ fontSize: ".65rem", color: "#333" }}>{valid ? ms.toFixed(0) : "—"}ms</span>
              </div>
            </div>

            <button onClick={togglePlay} style={{ marginTop: 6, marginBottom: 10, background: "#1a1a1e", border: "1px solid #252528", color: "#aaa", borderRadius: 8, padding: "5px 20px", cursor: "pointer", fontSize: ".75rem", fontWeight: 600, letterSpacing: ".05em" }}>
              {playing ? "⏸ Pause" : "▶ Play"}
            </button>
          </div>

          {/* Bezier Section */}
          <div style={{ borderTop: "1px solid #1a1a1e", padding: "0.75rem 1rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <label style={{ ...labelStyle, margin: 0 }}>Cubic Bezier</label>
              <button onClick={() => setUseCustom(v => !v)} style={{ background: useCustom ? "#ff5c3520" : "#1a1a1e", color: useCustom ? "#ff5c35" : "#555", border: `1px solid ${useCustom ? "#ff5c3550" : "#252528"}`, borderRadius: 6, padding: "2px 10px", fontSize: ".7rem", fontWeight: 600, cursor: "pointer" }}>
                {useCustom ? "Custom ✦" : "Default"}
              </button>
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              {/* Curve preview */}
              <div style={{ background: "#0d0d0f", borderRadius: 8, border: "1px solid #1a1a1e", flexShrink: 0 }}>
                <CurvePreview />
              </div>

              {/* Controls */}
              <div style={{ flex: 1 }}>
                <div style={{ position: "relative", marginBottom: 8 }}>
                  <input
                    value={bezierInput}
                    onChange={e => { setBezierInput(e.target.value); setBezierError(!parsedBezier(e.target.value)); setUseCustom(true); }}
                    placeholder="x1,y1,x2,y2"
                    style={{ ...inputStyle, padding: "6px 8px", fontSize: ".8rem", borderColor: bezierError && useCustom ? "#ff3320" : "#1e1e22", opacity: useCustom ? 1 : 0.5, marginBottom: 0 }}
                  />
                  {bezierError && useCustom && <div style={{ fontSize: ".65rem", color: "#ff3320", marginTop: 3 }}>invalid values</div>}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {BEZIER_PRESETS.map(p => (
                    <button key={p.label} onClick={() => { setBezierInput(p.value); setBezierError(false); setUseCustom(true); }} style={{ background: bezierInput === p.value && useCustom ? "#ff5c3515" : "#141416", color: bezierInput === p.value && useCustom ? "#ff5c35" : "#555", border: `1px solid ${bezierInput === p.value && useCustom ? "#ff5c3540" : "#1e1e22"}`, borderRadius: 6, padding: "3px 8px", fontSize: ".68rem", cursor: "pointer", textAlign: "left", transition: "all .1s" }}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const labelStyle = { display: "block", fontSize: ".75rem", fontWeight: 600, color: "#555", marginBottom: 6, letterSpacing: ".05em", textTransform: "uppercase" };
const inputStyle = { width: "100%", boxSizing: "border-box", background: "#0a0a0b", border: "1px solid #1e1e22", borderRadius: 10, padding: "0.65rem 2.5rem 0.65rem 0.85rem", color: "#f0f0f0", fontSize: "1rem", outline: "none", fontFamily: "inherit" };
const unitStyle = { position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: ".8rem", color: "#444", pointerEvents: "none" };