import { useState, useMemo, useEffect, useCallback } from "react";

const TRABAJOS = [
  "Rastreo", "Barbecho", "Zanjeo", "Cultivo liliston",
  "Cultivo zanjeadora", "Siembra", "Pisca algodon",
  "Trilla trigo", "Trilla Maiz", "Trilla Garbanzo",
  "Tumba de bordos con arado", "Tumba de bordos con canalera",
  "Movimiento y compactacion modulador", "Varios"
];

const UNIDADES = [
  "Tractor #1","Tractor #2","Tractor #3","Tractor #4",
  "Tractor #5","Tractor #6","Tractor #7",
  "Trilladora Lexion 560R","Trilladora JD 9779 STS",
  "Torton Ford Rojo","Torton Dina Gris",
  "Torton Dina Rojo","Torton Intl Blanco",
  "Piscadora John Deere 1","Piscadora John Deere 2",
  "Nissan Frontier 2022",
  "Camion algodonero #1"
];

const CON_HOROMETRO = [
  "Tractor #1","Tractor #2","Tractor #3","Tractor #4",
  "Tractor #5","Tractor #6","Tractor #7",
  "Trilladora Lexion 560R","Trilladora JD 9779 STS"
];

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxMLwUa1k9N5eFN6Qqcv6PEgla2pBJUr0GsfO2V2Pv1Sg2buQi0YEWE1hZ9rllfM6Xf/exec";

function tieneHorometro(u) { return CON_HOROMETRO.includes(u); }

function formatDate(d) {
  if (!d) return "—";
  let date;
  if (typeof d === "number") date = new Date((d - 25569) * 86400 * 1000);
  else if (typeof d === "string") date = new Date(d.includes("T") ? d : d + "T12:00:00");
  else date = new Date(d);
  if (isNaN(date.getTime())) return String(d);
  return date.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

function lphColor(lph) {
  const v = Number(lph);
  if (isNaN(v)) return "#71717a";
  if (v < 13) return "#10b981";
  if (v < 16) return "#f59e0b";
  return "#ef4444";
}

function LphBadge({ lph }) {
  if (!lph || lph === "-") return <span style={{ color: "#71717a", fontSize: 11 }}>—</span>;
  const color = lphColor(lph);
  return (
    <span style={{ background: color + "20", color, border: `1px solid ${color}50`, borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>
      {lph} L/hr
    </span>
  );
}

function WorkBadge({ trabajo }) {
  if (!trabajo) return <span style={{ color: "#52525b", fontSize: 11 }}>—</span>;
  return (
    <span style={{ background: "#1e3a5f", color: "#93c5fd", border: "1px solid #1d4ed820", borderRadius: 6, padding: "2px 8px", fontSize: 11 }}>
      {trabajo}
    </span>
  );
}

export default function DieselControl() {
  const [tab, setTab] = useState("dashboard");
  const [consumos, setConsumos] = useState([]);
  const [entradas, setEntradas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState({ text: "", type: "ok" });

  const initialFc = {
    fecha: "", unidad: "", litros: "", trabajo: "", notas: "",
    modoHoras: "horometro", horometroActual: "", horometroAnterior: "",
    horasDirectas: "", naHoras: false, kilometraje: ""
  };
  const [fc, setFc] = useState(initialFc);
  const [fe, setFe] = useState({ fecha: "", litros: "", proveedor: "", factura: "", notas: "" });

  function showMsg(text, type = "ok") {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: "", type: "ok" }), 4000);
  }

  const api = useCallback(async (action, data) => {
    try {
      let url = APPS_SCRIPT_URL + "?action=" + encodeURIComponent(action);
      if (data) url += "&data=" + encodeURIComponent(JSON.stringify(data));
      const res = await fetch(url, { redirect: "follow" });
      return JSON.parse(await res.text());
    } catch {
      showMsg("Error de conexión con Google Sheets.", "error");
      return null;
    }
  }, []);

  const cargarDatos = useCallback(async () => {
    setLoading(true);
    const [c, e] = await Promise.all([api("getConsumos"), api("getEntradas")]);
    if (c) setConsumos(c.map(r => ({ ...r, litros: Number(r.litros), horas: r.horas === "N/A" ? "N/A" : Number(r.horas) })));
    if (e) setEntradas(e.map(r => ({ ...r, litros: Number(r.litros) })));
    setLoading(false);
  }, [api]);

  useEffect(() => { cargarDatos(); }, [cargarDatos]);

  const horasCalculadas = useMemo(() => {
    if (fc.naHoras) return "N/A";
    if (fc.modoHoras === "horometro") {
      const actual = parseFloat(fc.horometroActual), anterior = parseFloat(fc.horometroAnterior);
      if (!isNaN(actual) && !isNaN(anterior) && actual > anterior)
        return parseFloat((actual - anterior).toFixed(1));
      return null;
    }
    const h = parseFloat(fc.horasDirectas);
    return !isNaN(h) && h > 0 ? h : null;
  }, [fc]);

  const totalEntradas = entradas.reduce((s, e) => s + Number(e.litros), 0);
  const totalConsumo  = consumos.reduce((s, c) => s + Number(c.litros), 0);
  const saldo = totalEntradas - totalConsumo;
  const pctConsumo = totalEntradas > 0 ? Math.min(100, (totalConsumo / totalEntradas) * 100) : 0;

  const rendimientos = useMemo(() => {
    const map = {};
    consumos.forEach(c => {
      if (!map[c.unidad]) map[c.unidad] = { litros: 0, horas: 0, registros: 0 };
      map[c.unidad].litros += Number(c.litros);
      if (c.horas !== "N/A") map[c.unidad].horas += Number(c.horas);
      map[c.unidad].registros += 1;
    });
    return Object.entries(map).map(([u, v]) => ({
      unidad: u, litros: v.litros, horas: v.horas, registros: v.registros,
      lph: v.horas > 0 ? (v.litros / v.horas).toFixed(2) : "-",
    }));
  }, [consumos]);

  const rendTrabajo = useMemo(() => {
    const map = {};
    consumos.forEach(c => {
      if (c.trabajo && c.trabajo !== "Varios") {
        if (!map[c.trabajo]) map[c.trabajo] = { litros: 0, horas: 0 };
        map[c.trabajo].litros += Number(c.litros);
        if (c.horas !== "N/A") map[c.trabajo].horas += Number(c.horas);
      }
    });
    return Object.entries(map).map(([t, v]) => ({
      trabajo: t, litros: v.litros, horas: v.horas,
      lph: v.horas > 0 ? (v.litros / v.horas).toFixed(2) : "-",
    }));
  }, [consumos]);

  async function addConsumo() {
    if (!fc.fecha || !fc.unidad || !fc.litros) { showMsg("Completa fecha, unidad y litros.", "warn"); return; }
    if (horasCalculadas === null) { showMsg("Ingresa horómetro, horas o marca N/A.", "warn"); return; }
    const nuevo = {
      id: Date.now(), fecha: fc.fecha, unidad: fc.unidad,
      litros: Number(fc.litros), horas: horasCalculadas === "N/A" ? "N/A" : horasCalculadas,
      trabajo: fc.trabajo || "", notas: fc.notas, kilometraje: fc.kilometraje || "",
      modoHoras: fc.modoHoras,
      horometroActual: fc.modoHoras === "horometro" ? Number(fc.horometroActual) : "",
      horometroAnterior: fc.modoHoras === "horometro" ? Number(fc.horometroAnterior) : "",
    };
    setConsumos(prev => [...prev, nuevo]);
    setFc(initialFc);
    showMsg("Consumo registrado correctamente.");
    setSyncing(true);
    await api("addConsumo", nuevo);
    setSyncing(false);
  }

  async function addEntrada() {
    if (!fe.fecha || !fe.litros) { showMsg("Fecha y litros son requeridos.", "warn"); return; }
    const nuevo = { id: Date.now(), fecha: fe.fecha, litros: Number(fe.litros), proveedor: fe.proveedor, factura: fe.factura, notas: fe.notas };
    setEntradas(prev => [...prev, nuevo]);
    setFe({ fecha: "", litros: "", proveedor: "", factura: "", notas: "" });
    showMsg("Entrada registrada correctamente.");
    setSyncing(true);
    await api("addEntrada", nuevo);
    setSyncing(false);
  }

  async function delConsumo(id) {
    if (!confirm("¿Eliminar este registro?")) return;
    setConsumos(prev => prev.filter(c => c.id !== id));
    await api("deleteConsumo", { id });
  }
  async function delEntrada(id) {
    if (!confirm("¿Eliminar esta entrada?")) return;
    setEntradas(prev => prev.filter(e => e.id !== id));
    await api("deleteEntrada", { id });
  }

  function onSelectUnidad(unidad) {
    setFc(p => ({
      ...p, unidad,
      modoHoras: tieneHorometro(unidad) ? "horometro" : "directas",
      horometroAnterior: "", horometroActual: "", horasDirectas: ""
    }));
  }

  // ── Styles ──
  const S = {
    input: {
      width: "100%", background: "#18181b", border: "1.5px solid #3f3f46",
      color: "#f4f4f5", borderRadius: 10, padding: "10px 14px", fontSize: 14,
      outline: "none", transition: "border-color 0.2s", fontFamily: "inherit"
    },
    label: { display: "block", fontSize: 11, color: "#a1a1aa", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6, fontWeight: 600 },
    card: { background: "#18181b", borderRadius: 16, padding: "20px 24px", border: "1px solid #27272a" },
    btn: (color) => ({
      width: "100%", padding: "13px", borderRadius: 12, border: "none", cursor: "pointer",
      fontWeight: 700, fontSize: 14, letterSpacing: "0.04em", transition: "opacity 0.15s",
      background: color === "amber" ? "#f59e0b" : color === "green" ? "#10b981" : "#ef4444",
      color: color === "amber" ? "#18181b" : "#fff"
    }),
  };

  const tabs = [
    { id: "dashboard", label: "Panel", icon: "📊" },
    { id: "consumo",   label: "Consumo", icon: "🛢" },
    { id: "entrada",   label: "Entradas", icon: "⛽" },
    { id: "reportes",  label: "Reportes", icon: "📋" },
  ];

  const msgStyle = {
    ok:    { background: "#052e16", border: "1px solid #166534", color: "#86efac" },
    warn:  { background: "#1c1400", border: "1px solid #854d0e", color: "#fde047" },
    error: { background: "#1c0000", border: "1px solid #991b1b", color: "#fca5a5" },
  };

  return (
    <div style={{ fontFamily: "'Inter','Segoe UI',sans-serif", background: "#09090b", minHeight: "100vh", color: "#f4f4f5" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: #18181b; }
        ::-webkit-scrollbar-thumb { background: #f59e0b; border-radius: 4px; }
        select option { background: #18181b; }
        input:focus, select:focus, textarea:focus { border-color: #f59e0b !important; box-shadow: 0 0 0 3px #f59e0b18; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 0.8s linear infinite; }
        @keyframes fadeIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
        .fade { animation: fadeIn 0.25s ease; }
        .row-hover:hover { background: #27272a; }
        .tab-btn { border: none; cursor: pointer; transition: all 0.15s; background: transparent; }
        .tab-btn:hover { opacity: 0.85; }
        .pill-btn { border: 1.5px solid #3f3f46; background: #27272a; color: #a1a1aa; border-radius: 8px; padding: 6px 14px; font-size: 12px; cursor: pointer; transition: all 0.15s; font-weight: 600; }
        .pill-btn:hover { border-color: #a1a1aa; color: #f4f4f5; }
        .pill-btn.active { background: #f59e0b; border-color: #f59e0b; color: #18181b; }
      `}</style>

      {/* ── HEADER ── */}
      <div style={{ background: "#18181b", borderBottom: "1px solid #27272a", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 38, height: 38, background: "linear-gradient(135deg,#f59e0b,#d97706)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>⛽</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, letterSpacing: "-0.01em" }}>Control de Diesel</div>
            <div style={{ fontSize: 11, color: "#71717a" }}>Grupo Ceballos · Temporada 2025</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {syncing && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#a1a1aa" }}>
              <div className="spin" style={{ width: 12, height: 12, border: "2px solid #f59e0b", borderTopColor: "transparent", borderRadius: "50%" }} />
              Guardando...
            </div>
          )}
          <button onClick={cargarDatos} style={{ background: "#27272a", border: "1px solid #3f3f46", color: "#a1a1aa", borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>↻ Actualizar</button>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, color: "#71717a" }}>Saldo</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: saldo >= 0 ? "#10b981" : "#ef4444" }}>{saldo.toLocaleString()} L</div>
          </div>
        </div>
      </div>

      {/* ── TABS ── */}
      <div style={{ background: "#18181b", borderBottom: "1px solid #27272a", padding: "0 16px", display: "flex", gap: 4, overflowX: "auto" }}>
        {tabs.map(t => (
          <button key={t.id} className="tab-btn" onClick={() => setTab(t.id)}
            style={{ padding: "12px 16px", fontSize: 13, fontWeight: tab === t.id ? 700 : 500, color: tab === t.id ? "#f59e0b" : "#71717a", borderBottom: tab === t.id ? "2px solid #f59e0b" : "2px solid transparent", whiteSpace: "nowrap" }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── MSG ── */}
      {msg.text && (
        <div className="fade" style={{ margin: "16px 16px 0", padding: "10px 16px", borderRadius: 10, fontSize: 13, fontWeight: 500, ...msgStyle[msg.type] }}>
          {msg.text}
        </div>
      )}

      {/* ── LOADING ── */}
      {loading && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 0", gap: 12, color: "#71717a" }}>
          <div className="spin" style={{ width: 22, height: 22, border: "3px solid #f59e0b", borderTopColor: "transparent", borderRadius: "50%" }} />
          <span style={{ fontSize: 14 }}>Cargando datos...</span>
        </div>
      )}

      {!loading && (
      <div style={{ padding: "20px 16px", maxWidth: 900, margin: "0 auto" }} className="fade">

        {/* ══════════ DASHBOARD ══════════ */}
        {tab === "dashboard" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Stat cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12 }}>
              {[
                { label: "Diesel recibido", value: `${totalEntradas.toLocaleString()} L`, sub: `${entradas.length} cargas`, color: "#3b82f6", icon: "⬆" },
                { label: "Diesel consumido", value: `${totalConsumo.toLocaleString()} L`, sub: `${consumos.length} registros`, color: "#f59e0b", icon: "⬇" },
                { label: "Saldo disponible", value: `${saldo.toLocaleString()} L`, sub: saldo >= 0 ? "En existencia" : "¡DÉFICIT!", color: saldo >= 100 ? "#10b981" : "#ef4444", icon: saldo >= 0 ? "✓" : "!" },
                { label: "Unidades activas", value: rendimientos.length, sub: "con registros", color: "#8b5cf6", icon: "🚜" },
              ].map(s => (
                <div key={s.label} style={{ background: "#18181b", borderRadius: 14, padding: "16px", border: `1px solid ${s.color}30`, position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", top: 12, right: 14, fontSize: 20, opacity: 0.15 }}>{s.icon}</div>
                  <div style={{ fontSize: 11, color: "#71717a", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{s.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: "#52525b", marginTop: 4 }}>{s.sub}</div>
                </div>
              ))}
            </div>

            {/* Barra de balance */}
            <div style={S.card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#a1a1aa" }}>Balance de combustible</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: pctConsumo > 80 ? "#ef4444" : "#f59e0b" }}>{pctConsumo.toFixed(1)}% consumido</span>
              </div>
              <div style={{ height: 12, background: "#27272a", borderRadius: 99, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pctConsumo}%`, background: pctConsumo > 80 ? "linear-gradient(90deg,#f59e0b,#ef4444)" : "linear-gradient(90deg,#10b981,#f59e0b)", borderRadius: 99, transition: "width 0.8s ease" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#52525b", marginTop: 6 }}>
                <span>0 L</span><span>{totalEntradas.toLocaleString()} L</span>
              </div>
            </div>

            {/* Rendimiento unidades */}
            {rendimientos.length > 0 && (
              <div style={S.card}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#a1a1aa", marginBottom: 16 }}>Rendimiento por unidad</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {rendimientos.map(r => {
                    const maxLph = Math.max(...rendimientos.map(x => Number(x.lph) || 0));
                    const pct = maxLph > 0 ? (Number(r.lph) / maxLph) * 100 : 0;
                    const color = lphColor(r.lph);
                    return (
                      <div key={r.unidad}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                          <span style={{ fontSize: 13, fontWeight: 600 }}>{r.unidad}</span>
                          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                            <span style={{ fontSize: 11, color: "#71717a" }}>{r.litros} L · {r.horas} hr</span>
                            <LphBadge lph={r.lph} />
                          </div>
                        </div>
                        <div style={{ height: 6, background: "#27272a", borderRadius: 99, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 99, transition: "width 0.6s ease" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ marginTop: 12, fontSize: 11, color: "#3f3f46" }}>Verde &lt;13 L/hr · Ámbar 13-16 L/hr · Rojo &gt;16 L/hr</div>
              </div>
            )}

            {/* Últimos movimientos */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={S.card}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#a1a1aa", marginBottom: 12 }}>Últimos consumos</div>
                {consumos.length === 0
                  ? <div style={{ fontSize: 13, color: "#52525b", textAlign: "center", padding: "20px 0" }}>Sin registros aún</div>
                  : [...consumos].reverse().slice(0, 5).map(c => (
                    <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "8px 0", borderBottom: "1px solid #27272a" }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{c.unidad}</div>
                        <div style={{ fontSize: 11, color: "#71717a", marginTop: 2 }}>{formatDate(c.fecha)}</div>
                        {c.trabajo && <div style={{ marginTop: 4 }}><WorkBadge trabajo={c.trabajo} /></div>}
                      </div>
                      <div style={{ color: "#ef4444", fontWeight: 700, fontSize: 13, whiteSpace: "nowrap" }}>-{c.litros} L</div>
                    </div>
                  ))
                }
              </div>
              <div style={S.card}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#a1a1aa", marginBottom: 12 }}>Últimas entradas</div>
                {entradas.length === 0
                  ? <div style={{ fontSize: 13, color: "#52525b", textAlign: "center", padding: "20px 0" }}>Sin registros aún</div>
                  : [...entradas].reverse().slice(0, 5).map(e => (
                    <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "8px 0", borderBottom: "1px solid #27272a" }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{e.proveedor || "Sin proveedor"}</div>
                        <div style={{ fontSize: 11, color: "#71717a", marginTop: 2 }}>{formatDate(e.fecha)}</div>
                      </div>
                      <div style={{ color: "#10b981", fontWeight: 700, fontSize: 13, whiteSpace: "nowrap" }}>+{e.litros} L</div>
                    </div>
                  ))
                }
              </div>
            </div>
          </div>
        )}

        {/* ══════════ CONSUMO ══════════ */}
        {tab === "consumo" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={S.card}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 20 }}>🛢 Registrar consumo</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label style={S.label}>Fecha *</label>
                  <input type="date" style={S.input} value={fc.fecha} onChange={e => setFc(p => ({ ...p, fecha: e.target.value }))} />
                </div>
                <div>
                  <label style={S.label}>Unidad *</label>
                  <select style={S.input} value={fc.unidad} onChange={e => onSelectUnidad(e.target.value)}>
                    <option value="">Seleccionar unidad...</option>
                    <optgroup label="── Tractores ──">
                      {UNIDADES.filter(u => u.startsWith("Tractor")).map(u => <option key={u}>{u}</option>)}
                    </optgroup>
                    <optgroup label="── Trilladoras ──">
                      {UNIDADES.filter(u => u.startsWith("Trilladora")).map(u => <option key={u}>{u}</option>)}
                    </optgroup>
                    <optgroup label="── Tortons ──">
                      {UNIDADES.filter(u => u.startsWith("Torton")).map(u => <option key={u}>{u}</option>)}
                    </optgroup>
                    <optgroup label="── Piscadoras ──">
                      {UNIDADES.filter(u => u.startsWith("Piscadora")).map(u => <option key={u}>{u}</option>)}
                    </optgroup>
                    <optgroup label="── Camionetas ──">
                      {UNIDADES.filter(u => u.startsWith("Nissan")).map(u => <option key={u}>{u}</option>)}
                    </optgroup>
                    <optgroup label="── Camiones ──">
                      {UNIDADES.filter(u => u.startsWith("Camion")).map(u => <option key={u}>{u}</option>)}
                    </optgroup>
                  </select>
                </div>
                <div>
                  <label style={S.label}>Litros consumidos *</label>
                  <input type="number" min="0" step="0.1" style={S.input} placeholder="0.0" value={fc.litros} onChange={e => setFc(p => ({ ...p, litros: e.target.value }))} />
                </div>
                <div>
                  <label style={S.label}>Trabajo realizado</label>
                  <select style={S.input} value={fc.trabajo} onChange={e => setFc(p => ({ ...p, trabajo: e.target.value }))}>
                    <option value="">Sin especificar</option>
                    {TRABAJOS.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              {/* Horómetro */}
              {fc.unidad && (
                <div style={{ marginTop: 16, background: "#09090b", borderRadius: 12, padding: 16, border: "1px solid #27272a" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#a1a1aa", textTransform: "uppercase", letterSpacing: "0.06em" }}>Horas de trabajo</span>
                    <div style={{ display: "flex", gap: 6 }}>
                      {tieneHorometro(fc.unidad) && !fc.naHoras && (
                        <>
                          {["horometro", "directas"].map(m => (
                            <button key={m} className={`pill-btn ${fc.modoHoras === m ? "active" : ""}`}
                              onClick={() => setFc(p => ({ ...p, modoHoras: m }))}>
                              {m === "horometro" ? "Horómetro" : "Horas directas"}
                            </button>
                          ))}
                        </>
                      )}
                      <button className={`pill-btn ${fc.naHoras ? "active" : ""}`}
                        onClick={() => setFc(p => ({ ...p, naHoras: !p.naHoras }))}>N/A</button>
                    </div>
                  </div>
                  {fc.naHoras ? (
                    <div style={{ padding: "10px 14px", background: "#27272a", borderRadius: 8, fontSize: 13, color: "#a1a1aa" }}>
                      Horas marcadas como <strong style={{ color: "#f4f4f5" }}>N/A</strong> — no se calculará rendimiento L/hr.
                    </div>
                  ) : fc.modoHoras === "horometro" ? (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div>
                        <label style={S.label}>Horómetro anterior</label>
                        <input type="number" min="0" step="0.1" style={S.input} placeholder="ej. 4520.0"
                          value={fc.horometroAnterior} onChange={e => setFc(p => ({ ...p, horometroAnterior: e.target.value }))} />
                      </div>
                      <div>
                        <label style={S.label}>Horómetro actual</label>
                        <input type="number" min="0" step="0.1" style={S.input} placeholder="ej. 4528.5"
                          value={fc.horometroActual} onChange={e => setFc(p => ({ ...p, horometroActual: e.target.value }))} />
                      </div>
                      {horasCalculadas !== null && horasCalculadas !== "N/A" && (
                        <div style={{ gridColumn: "span 2", padding: "10px 14px", background: "#1c1400", border: "1px solid #854d0e50", borderRadius: 8, fontSize: 13, color: "#fde047" }}>
                          Horas trabajadas: <strong>{horasCalculadas} hr</strong>
                          {fc.litros && horasCalculadas > 0 && <span style={{ marginLeft: 16, color: "#f59e0b" }}>· Rendimiento estimado: <strong>{(Number(fc.litros) / horasCalculadas).toFixed(2)} L/hr</strong></span>}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <label style={S.label}>Horas trabajadas</label>
                      <input type="number" min="0" step="0.1" style={S.input} placeholder="ej. 8.5"
                        value={fc.horasDirectas} onChange={e => setFc(p => ({ ...p, horasDirectas: e.target.value }))} />
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 14 }}>
                <div>
                  <label style={S.label}>Kilometraje <span style={{ color: "#3f3f46", textTransform: "none", fontWeight: 400 }}>(opcional)</span></label>
                  <input type="number" min="0" style={S.input} placeholder="ej. 45200"
                    value={fc.kilometraje} onChange={e => setFc(p => ({ ...p, kilometraje: e.target.value }))} />
                </div>
                <div>
                  <label style={S.label}>Notas</label>
                  <textarea style={{ ...S.input, resize: "none", height: 42 }} rows={2} placeholder="Observaciones..."
                    value={fc.notas} onChange={e => setFc(p => ({ ...p, notas: e.target.value }))} />
                </div>
              </div>

              <button onClick={addConsumo} style={{ ...S.btn("amber"), marginTop: 18 }}>
                Registrar consumo
              </button>
            </div>

            {/* Historial consumos */}
            <div style={S.card}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#a1a1aa", marginBottom: 16 }}>Historial de consumos</div>
              {consumos.length === 0
                ? <div style={{ textAlign: "center", padding: "30px 0", color: "#52525b", fontSize: 14 }}>Sin registros aún. Agrega tu primer consumo arriba.</div>
                : <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid #27272a" }}>
                        {["Fecha","Unidad","Litros","Horómetro","Horas","L/Hr","Trabajo","Km",""].map(h => (
                          <th key={h} style={{ textAlign: "left", padding: "0 12px 10px 0", fontSize: 11, color: "#52525b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[...consumos].reverse().map(c => (
                        <tr key={c.id} className="row-hover" style={{ borderBottom: "1px solid #1f1f22", transition: "background 0.15s" }}>
                          <td style={{ padding: "10px 12px 10px 0", color: "#71717a", whiteSpace: "nowrap" }}>{formatDate(c.fecha)}</td>
                          <td style={{ padding: "10px 12px 10px 0", fontWeight: 600, whiteSpace: "nowrap" }}>{c.unidad}</td>
                          <td style={{ padding: "10px 12px 10px 0", color: "#ef4444", fontWeight: 700 }}>{c.litros} L</td>
                          <td style={{ padding: "10px 12px 10px 0", color: "#52525b", fontSize: 12, whiteSpace: "nowrap" }}>
                            {c.modoHoras === "horometro" && c.horometroAnterior ? `${c.horometroAnterior}→${c.horometroActual}` : "—"}
                          </td>
                          <td style={{ padding: "10px 12px 10px 0", color: "#a1a1aa" }}>{c.horas === "N/A" ? "N/A" : `${c.horas} hr`}</td>
                          <td style={{ padding: "10px 12px 10px 0" }}>
                            {c.horas === "N/A" ? <span style={{ color: "#52525b", fontSize: 11 }}>N/A</span> : <LphBadge lph={(c.litros / c.horas).toFixed(1)} />}
                          </td>
                          <td style={{ padding: "10px 12px 10px 0" }}><WorkBadge trabajo={c.trabajo} /></td>
                          <td style={{ padding: "10px 12px 10px 0", color: "#52525b", fontSize: 12 }}>{c.kilometraje ? `${Number(c.kilometraje).toLocaleString()} km` : "—"}</td>
                          <td style={{ padding: "10px 0" }}>
                            <button onClick={() => delConsumo(c.id)} style={{ background: "none", border: "none", color: "#3f3f46", cursor: "pointer", fontSize: 14, padding: 4 }}>✕</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              }
            </div>
          </div>
        )}

        {/* ══════════ ENTRADAS ══════════ */}
        {tab === "entrada" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={S.card}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 20 }}>⛽ Registrar entrada de diesel</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label style={S.label}>Fecha *</label>
                  <input type="date" style={S.input} value={fe.fecha} onChange={e => setFe(p => ({ ...p, fecha: e.target.value }))} />
                </div>
                <div>
                  <label style={S.label}>Litros recibidos *</label>
                  <input type="number" min="0" style={S.input} placeholder="0.0" value={fe.litros} onChange={e => setFe(p => ({ ...p, litros: e.target.value }))} />
                </div>
                <div>
                  <label style={S.label}>Proveedor</label>
                  <input style={S.input} placeholder="Nombre del proveedor..." value={fe.proveedor} onChange={e => setFe(p => ({ ...p, proveedor: e.target.value }))} />
                </div>
                <div>
                  <label style={S.label}>No. Factura / Remisión</label>
                  <input style={S.input} placeholder="F-0000" value={fe.factura} onChange={e => setFe(p => ({ ...p, factura: e.target.value }))} />
                </div>
                <div style={{ gridColumn: "span 2" }}>
                  <label style={S.label}>Notas</label>
                  <textarea style={{ ...S.input, resize: "none" }} rows={2} placeholder="Observaciones..." value={fe.notas} onChange={e => setFe(p => ({ ...p, notas: e.target.value }))} />
                </div>
              </div>
              <button onClick={addEntrada} style={{ ...S.btn("green"), marginTop: 18 }}>
                Registrar entrada
              </button>
            </div>

            <div style={S.card}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#a1a1aa", marginBottom: 16 }}>Historial de entradas</div>
              {entradas.length === 0
                ? <div style={{ textAlign: "center", padding: "30px 0", color: "#52525b", fontSize: 14 }}>Sin entradas registradas aún.</div>
                : <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid #27272a" }}>
                        {["Fecha","Litros","Proveedor","Factura","Notas",""].map(h => (
                          <th key={h} style={{ textAlign: "left", padding: "0 12px 10px 0", fontSize: 11, color: "#52525b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[...entradas].reverse().map(e => (
                        <tr key={e.id} className="row-hover" style={{ borderBottom: "1px solid #1f1f22" }}>
                          <td style={{ padding: "10px 12px 10px 0", color: "#71717a", whiteSpace: "nowrap" }}>{formatDate(e.fecha)}</td>
                          <td style={{ padding: "10px 12px 10px 0", color: "#10b981", fontWeight: 700 }}>+{e.litros} L</td>
                          <td style={{ padding: "10px 12px 10px 0", fontWeight: 500 }}>{e.proveedor || "—"}</td>
                          <td style={{ padding: "10px 12px 10px 0", color: "#71717a" }}>{e.factura || "—"}</td>
                          <td style={{ padding: "10px 12px 10px 0", color: "#52525b" }}>{e.notas || "—"}</td>
                          <td style={{ padding: "10px 0" }}>
                            <button onClick={() => delEntrada(e.id)} style={{ background: "none", border: "none", color: "#3f3f46", cursor: "pointer", fontSize: 14, padding: 4 }}>✕</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              }
            </div>
          </div>
        )}

        {/* ══════════ REPORTES ══════════ */}
        {tab === "reportes" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Resumen */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              {[
                { label: "Entradas totales", value: `${totalEntradas.toLocaleString()} L`, color: "#3b82f6" },
                { label: "Consumo total", value: `${totalConsumo.toLocaleString()} L`, color: "#f59e0b" },
                { label: "Saldo", value: `${saldo >= 0 ? "+" : ""}${saldo.toLocaleString()} L`, color: saldo >= 0 ? "#10b981" : "#ef4444" },
              ].map(s => (
                <div key={s.label} style={{ background: "#18181b", borderRadius: 14, padding: "16px", border: `1px solid ${s.color}30`, textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: "#71717a", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{s.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* Rendimiento por unidad */}
            <div style={S.card}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#a1a1aa", marginBottom: 16 }}>Rendimiento por unidad</div>
              {rendimientos.length === 0
                ? <div style={{ color: "#52525b", fontSize: 13, textAlign: "center", padding: "20px 0" }}>Sin datos aún.</div>
                : <>
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {rendimientos.map(r => {
                      const maxLph = Math.max(...rendimientos.map(x => Number(x.lph) || 0));
                      const pct = maxLph > 0 ? (Number(r.lph) / maxLph) * 100 : 0;
                      const color = lphColor(r.lph);
                      return (
                        <div key={r.unidad}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                            <span style={{ fontSize: 13, fontWeight: 600 }}>{r.unidad}</span>
                            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                              <span style={{ fontSize: 11, color: "#71717a" }}>{r.litros} L · {r.horas} hr</span>
                              <LphBadge lph={r.lph} />
                            </div>
                          </div>
                          <div style={{ height: 8, background: "#27272a", borderRadius: 99, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 99, transition: "width 0.6s ease" }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ marginTop: 14, fontSize: 11, color: "#3f3f46" }}>Verde &lt;13 L/hr · Ámbar 13-16 L/hr · Rojo &gt;16 L/hr</div>
                </>
              }
            </div>

            {/* Rendimiento por trabajo */}
            <div style={S.card}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#a1a1aa", marginBottom: 16 }}>Rendimiento por tipo de trabajo</div>
              {rendTrabajo.length === 0
                ? <div style={{ color: "#52525b", fontSize: 13, textAlign: "center", padding: "20px 0" }}>Sin datos suficientes.</div>
                : <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #27272a" }}>
                      {["Trabajo","Litros","Horas","L/hr"].map(h => (
                        <th key={h} style={{ textAlign: "left", padding: "0 12px 10px 0", fontSize: 11, color: "#52525b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rendTrabajo.map(r => (
                      <tr key={r.trabajo} className="row-hover" style={{ borderBottom: "1px solid #1f1f22" }}>
                        <td style={{ padding: "10px 12px 10px 0" }}><WorkBadge trabajo={r.trabajo} /></td>
                        <td style={{ padding: "10px 12px 10px 0", color: "#a1a1aa" }}>{r.litros} L</td>
                        <td style={{ padding: "10px 12px 10px 0", color: "#a1a1aa" }}>{r.horas} hr</td>
                        <td style={{ padding: "10px 0" }}><LphBadge lph={r.lph} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              }
            </div>

            {/* Balance detallado */}
            <div style={S.card}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#a1a1aa", marginBottom: 16 }}>Balance detallado</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {[
                  ...[...entradas].map(e => ({ fecha: e.fecha, label: `${e.proveedor || "Entrada"}${e.factura ? ` (${e.factura})` : ""}`, litros: e.litros, tipo: "entrada" })),
                  ...[...consumos].map(c => ({ fecha: c.fecha, label: `${c.unidad}${c.trabajo ? ` · ${c.trabajo}` : ""}`, litros: c.litros, tipo: "consumo" })),
                ].sort((a, b) => new Date(a.fecha) - new Date(b.fecha)).map((item, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #1f1f22" }}>
                    <div>
                      <span style={{ fontSize: 12, color: "#52525b", marginRight: 8 }}>{formatDate(item.fecha)}</span>
                      <span style={{ fontSize: 13 }}>{item.label}</span>
                    </div>
                    <span style={{ fontWeight: 700, fontSize: 13, color: item.tipo === "entrada" ? "#10b981" : "#ef4444", whiteSpace: "nowrap" }}>
                      {item.tipo === "entrada" ? "+" : "-"}{item.litros} L
                    </span>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0 0", marginTop: 4 }}>
                  <span style={{ fontWeight: 800, fontSize: 14, textTransform: "uppercase", letterSpacing: "0.05em" }}>SALDO FINAL</span>
                  <span style={{ fontWeight: 800, fontSize: 16, color: saldo >= 0 ? "#10b981" : "#ef4444" }}>{saldo >= 0 ? "+" : ""}{saldo.toLocaleString()} L</span>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
      )}
    </div>
  );
}
