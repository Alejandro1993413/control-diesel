import { useState, useMemo, useEffect, useCallback } from "react";

const TRABAJOS = [
  "Rastreo", "Barbecho", "Zanjeo", "Cultivo liliston",
  "Cultivo zanjeadora", "Siembra", "Varios"
];

const UNIDADES = [
  "Tractor #1", "Tractor #2", "Tractor #3", "Tractor #4",
  "Tractor #5", "Tractor #6", "Tractor #7",
  "Trilladora Lexion 560R", "Trilladora JD 9779 STS",
  "Torton Ford Rojo", "Torton Dina Gris",
  "Torton Dina Rojo", "Torton Intl Blanco"
];

const CON_HOROMETRO = [
  "Tractor #1","Tractor #2","Tractor #3","Tractor #4",
  "Tractor #5","Tractor #6","Tractor #7",
  "Trilladora Lexion 560R","Trilladora JD 9779 STS"
];

function tieneHorometro(u) { return CON_HOROMETRO.includes(u); }

function formatDate(d) {
  if (!d) return "—";
  let date;
  if (typeof d === "number") {
    // Google Sheets serial date number
    date = new Date((d - 25569) * 86400 * 1000);
  } else if (typeof d === "string") {
    if (d.includes("T") || d.includes("-")) {
      date = new Date(d.includes("T") ? d : d + "T12:00:00");
    } else {
      date = new Date(d);
    }
  } else {
    date = new Date(d);
  }
  if (isNaN(date.getTime())) return String(d);
  return date.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

function Badge({ color, children }) {
  const c = {
    green: "bg-emerald-900/60 text-emerald-300 border border-emerald-700",
    red:   "bg-red-900/60 text-red-300 border border-red-700",
    amber: "bg-amber-900/60 text-amber-300 border border-amber-700",
    blue:  "bg-blue-900/60 text-blue-300 border border-blue-700",
    gray:  "bg-zinc-800 text-zinc-400 border border-zinc-700",
  };
  return <span className={`text-xs font-mono px-2 py-0.5 rounded ${c[color]}`}>{children}</span>;
}

function StatCard({ label, value, sub, accent }) {
  const a = {
    green: "border-emerald-500 text-emerald-400",
    red:   "border-red-500 text-red-400",
    amber: "border-amber-500 text-amber-400",
    blue:  "border-blue-500 text-blue-400",
  };
  return (
    <div className={`bg-zinc-900 border border-zinc-800 border-l-2 ${a[accent]} rounded p-4`}>
      <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1 font-mono">{label}</p>
      <p className={`text-2xl font-bold font-mono ${a[accent].split(" ")[1]}`}>{value}</p>
      {sub && <p className="text-xs text-zinc-600 mt-1 font-mono">{sub}</p>}
    </div>
  );
}

// ── Spinner ──
function Spinner() {
  return (
    <div className="flex items-center gap-2 text-xs font-mono text-zinc-500">
      <div className="w-3 h-3 border border-amber-500 border-t-transparent rounded-full animate-spin" />
      Sincronizando...
    </div>
  );
}

export default function DieselControl() {
  const [tab, setTab] = useState("dashboard");
  const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxMLwUa1k9N5eFN6Qqcv6PEgla2pBJUr0GsfO2V2Pv1Sg2buQi0YEWE1hZ9rllfM6Xf/exec";
  const [scriptUrl, setScriptUrl] = useState(APPS_SCRIPT_URL);
  const [urlGuardada, setUrlGuardada] = useState(APPS_SCRIPT_URL);
  const [consumos, setConsumos] = useState([]);
  const [entradas, setEntradas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState({ text: "", type: "ok" });

  const initialFc = {
    fecha: "", unidad: "", litros: "", trabajo: "", notas: "",
    modoHoras: "horometro", horometroActual: "", horometroAnterior: "", horasDirectas: "", naHoras: false
  };
  const [fc, setFc] = useState(initialFc);
  const [fe, setFe] = useState({ fecha: "", litros: "", proveedor: "", factura: "", notas: "" });

  // ── Helpers de mensaje ──
  function showMsg(text, type = "ok") {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: "", type: "ok" }), 4000);
  }

  // ── API helper ──
  const api = useCallback(async (action, data) => {
    if (!urlGuardada) { showMsg("⚠ Primero configura la URL del Apps Script.", "warn"); return null; }
    try {
      let url = urlGuardada + "?action=" + encodeURIComponent(action);
      if (data) url += "&data=" + encodeURIComponent(JSON.stringify(data));
      const res = await fetch(url, { redirect: "follow" });
      const text = await res.text();
      return JSON.parse(text);
    } catch (e) {
      showMsg("❌ Error de conexión con Google Sheets.", "error");
      return null;
    }
  }, [urlGuardada]);

  // ── Cargar datos al conectar ──
  const cargarDatos = useCallback(async () => {
    if (!urlGuardada) return;
    setLoading(true);
    const [c, e] = await Promise.all([
      api("getConsumos"),
      api("getEntradas"),
    ]);
    if (c) setConsumos(c.map(r => ({ ...r, litros: Number(r.litros), horas: Number(r.horas) })));
    if (e) setEntradas(e.map(r => ({ ...r, litros: Number(r.litros) })));
    setLoading(false);
  }, [urlGuardada, api]);

  useEffect(() => { cargarDatos(); }, [cargarDatos]);

  // ── Horómetro ──
  const horasCalculadas = useMemo(() => {
    if (fc.naHoras) return "N/A";
    if (fc.modoHoras === "horometro") {
      const actual = parseFloat(fc.horometroActual);
      const anterior = parseFloat(fc.horometroAnterior);
      if (!isNaN(actual) && !isNaN(anterior) && actual > anterior)
        return parseFloat((actual - anterior).toFixed(1));
      return null;
    }
    const h = parseFloat(fc.horasDirectas);
    return !isNaN(h) && h > 0 ? h : null;
  }, [fc]);

  const ultimoHorometro = useMemo(() => {
    const map = {};
    [...consumos].sort((a, b) => new Date(a.fecha) - new Date(b.fecha)).forEach(c => {
      if (c.horometroActual) map[c.unidad] = c.horometroActual;
    });
    return map;
  }, [consumos]);

  // ── Totales ──
  const totalEntradas = entradas.reduce((s, e) => s + Number(e.litros), 0);
  const totalConsumo  = consumos.reduce((s, c) => s + Number(c.litros), 0);
  const saldo = totalEntradas - totalConsumo;

  // ── Rendimientos ──
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

  // ── Guardar consumo ──
  async function addConsumo() {
    if (!fc.fecha || !fc.unidad || !fc.litros) { showMsg("⚠ Completa fecha, unidad y litros.", "warn"); return; }
    if (horasCalculadas === null) { showMsg("⚠ Ingresa horómetro, horas o marca N/A.", "warn"); return; }
    const nuevo = {
      id: Date.now(), fecha: fc.fecha, unidad: fc.unidad,
      litros: Number(fc.litros), horas: horasCalculadas === "N/A" ? "N/A" : horasCalculadas,
      trabajo: fc.trabajo || "", notas: fc.notas,
      modoHoras: fc.modoHoras,
      horometroActual: fc.modoHoras === "horometro" ? Number(fc.horometroActual) : "",
      horometroAnterior: fc.modoHoras === "horometro" ? Number(fc.horometroAnterior) : "",
    };
    setConsumos(prev => [...prev, nuevo]);
    setFc(initialFc);
    showMsg("✔ Consumo registrado.");
    if (urlGuardada) {
      setSyncing(true);
      await api("addConsumo", nuevo);
      setSyncing(false);
    }
  }

  // ── Guardar entrada ──
  async function addEntrada() {
    if (!fe.fecha || !fe.litros) { showMsg("⚠ Fecha y litros son requeridos.", "warn"); return; }
    const nuevo = { id: Date.now(), fecha: fe.fecha, litros: Number(fe.litros), proveedor: fe.proveedor, factura: fe.factura, notas: fe.notas };
    setEntradas(prev => [...prev, nuevo]);
    setFe({ fecha: "", litros: "", proveedor: "", factura: "", notas: "" });
    showMsg("✔ Entrada registrada.");
    if (urlGuardada) {
      setSyncing(true);
      await api("addEntrada", nuevo);
      setSyncing(false);
    }
  }

  // ── Eliminar ──
  async function delConsumo(id) {
    setConsumos(prev => prev.filter(c => c.id !== id));
    if (urlGuardada) await api("deleteConsumo", { id });
  }
  async function delEntrada(id) {
    setEntradas(prev => prev.filter(e => e.id !== id));
    if (urlGuardada) await api("deleteEntrada", { id });
  }

  function onSelectUnidad(unidad) {
    const usaH = tieneHorometro(unidad);
    setFc(p => ({
      ...p, unidad,
      modoHoras: usaH ? "horometro" : "directas",
      horometroAnterior: "",
      horometroActual: "", horasDirectas: ""
    }));
  }

  const inputCls = "w-full bg-zinc-800 border border-zinc-700 text-zinc-100 rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-amber-500 placeholder-zinc-600";
  const labelCls = "block text-xs text-zinc-500 uppercase tracking-widest mb-1 font-mono";
  const tabCls   = (t) => `px-4 py-2 text-xs font-mono uppercase tracking-widest transition-all ${tab === t ? "bg-amber-500 text-zinc-900 font-bold" : "text-zinc-500 hover:text-zinc-200"}`;
  const msgColors = { ok: "border-emerald-500/40 text-emerald-400", warn: "border-amber-500/40 text-amber-400", error: "border-red-500/40 text-red-400" };

  return (
    <div style={{ fontFamily: "'IBM Plex Mono','Courier New',monospace", background: "#0f0f0f", minHeight: "100vh", color: "#e4e4e7" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: #18181b; } ::-webkit-scrollbar-thumb { background: #ca8a04; }
        select option { background: #18181b; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .animate-spin { animation: spin 0.8s linear infinite; }
      `}</style>

      {/* Header */}
      <div className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-amber-500 rounded flex items-center justify-center">
            <span className="text-zinc-900 font-bold">⛽</span>
          </div>
          <div>
            <h1 className="text-sm font-bold text-zinc-100 tracking-wider uppercase">Control de Diesel</h1>
            <p className="text-xs text-zinc-600">Sistema de gestión de combustible</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {syncing && <Spinner />}
          {urlGuardada ? (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-xs font-mono text-zinc-500 hidden md:block">Google Sheets conectado</span>
              <button onClick={cargarDatos} className="text-xs font-mono text-zinc-600 hover:text-amber-400 transition-colors px-2">↻ Sync</button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-400" />
              <span className="text-xs font-mono text-amber-500">Sin conectar</span>
            </div>
          )}
          <span className="text-xs font-mono text-zinc-600">Saldo: <span className={saldo >= 0 ? "text-emerald-400" : "text-red-400"}>{saldo.toFixed(0)} L</span></span>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-zinc-800 flex overflow-x-auto">
        {["config","dashboard","consumo","entrada","reportes"].map(t => (
          <button key={t} className={tabCls(t)} onClick={() => setTab(t)}>
            {t === "config" ? "⚙ Conexión" : t === "dashboard" ? "📊 Panel" : t === "consumo" ? "⬇ Consumo" : t === "entrada" ? "⬆ Entradas" : "📋 Reportes"}
          </button>
        ))}
      </div>

      {msg.text && (
        <div className={`mx-6 mt-4 px-4 py-2 bg-zinc-800 border ${msgColors[msg.type]} text-xs font-mono rounded`}>
          {msg.text}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-16 gap-3 text-sm font-mono text-zinc-500">
          <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          Cargando datos de Google Sheets...
        </div>
      )}

      {!loading && (
      <div className="p-6 max-w-6xl mx-auto">

        {/* ── CONFIGURACIÓN ── */}
        {tab === "config" && (
          <div className="max-w-xl space-y-6">
            <div className="bg-zinc-900 border border-zinc-800 rounded p-5 space-y-4">
              <p className="text-xs text-zinc-500 uppercase tracking-widest font-mono">⚙ Conectar con Google Sheets</p>

              <div className="bg-zinc-800 border border-zinc-700 rounded p-4 space-y-2 text-xs font-mono text-zinc-400">
                <p className="text-amber-400 font-bold">Pasos para configurar (solo una vez):</p>
                <p>1. Abre <span className="text-zinc-200">sheets.google.com</span> y crea una hoja llamada <span className="text-zinc-200">Control Diesel</span></p>
                <p>2. Crea dos pestañas: <span className="text-zinc-200">Consumos</span> y <span className="text-zinc-200">Entradas</span></p>
                <p>3. En el menú ve a <span className="text-zinc-200">Extensiones → Apps Script</span></p>
                <p>4. Borra el código existente y pega el contenido del archivo <span className="text-zinc-200">apps-script.gs</span></p>
                <p>5. Haz clic en <span className="text-zinc-200">Implementar → Nueva implementación</span></p>
                <p>6. Tipo: <span className="text-zinc-200">Aplicación web</span> · Acceso: <span className="text-zinc-200">Cualquier persona</span></p>
                <p>7. Copia la URL que aparece y pégala abajo</p>
              </div>

              <div>
                <label className={labelCls}>URL del Apps Script *</label>
                <input
                  className={inputCls}
                  placeholder="https://script.google.com/macros/s/..."
                  value={scriptUrl}
                  onChange={e => setScriptUrl(e.target.value)}
                />
              </div>

              <button
                onClick={async () => {
                  if (!scriptUrl.startsWith("https://script.google.com")) {
                    showMsg("⚠ La URL no parece válida. Debe empezar con https://script.google.com", "warn");
                    return;
                  }
                  setUrlGuardada(scriptUrl);
                  showMsg("✔ URL guardada. Cargando datos...");
                  setTab("dashboard");
                }}
                className="w-full bg-amber-500 hover:bg-amber-400 text-zinc-900 font-bold text-sm py-2.5 rounded font-mono uppercase tracking-widest transition-all">
                Guardar y Conectar
              </button>

              {urlGuardada && (
                <div className="flex items-center justify-between px-3 py-2 bg-emerald-900/20 border border-emerald-700/40 rounded text-xs font-mono">
                  <span className="text-emerald-400">✔ Conectado a Google Sheets</span>
                  <button onClick={() => { setUrlGuardada(""); setScriptUrl(""); setConsumos([]); setEntradas([]); }}
                    className="text-zinc-600 hover:text-red-400 transition-colors">Desconectar</button>
                </div>
              )}
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded p-4 text-xs font-mono text-zinc-600 space-y-1">
              <p className="text-zinc-500 font-bold">ℹ Sin conexión a Sheets</p>
              <p>El sistema funciona normalmente pero los datos solo se guardan en esta sesión del navegador. Al cerrar la pestaña se pierden.</p>
            </div>
          </div>
        )}

        {/* ── DASHBOARD ── */}
        {tab === "dashboard" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatCard label="Total Entradas"   value={`${totalEntradas.toLocaleString()} L`} sub={`${entradas.length} entregas`}  accent="blue" />
              <StatCard label="Total Consumido"  value={`${totalConsumo.toLocaleString()} L`}  sub={`${consumos.length} registros`} accent="amber" />
              <StatCard label="Saldo Disponible" value={`${saldo.toLocaleString()} L`}          sub={saldo > 0 ? "En existencia" : "¡DÉFICIT!"} accent={saldo > 100 ? "green" : "red"} />
              <StatCard label="Unidades Activas" value={rendimientos.length} sub="con registros" accent="blue" />
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded p-4">
              <p className="text-xs text-zinc-500 uppercase tracking-widest mb-3 font-mono">Balance de Diesel</p>
              <div className="relative h-6 bg-zinc-800 rounded overflow-hidden">
                <div className="h-full bg-amber-500 transition-all duration-700"
                  style={{ width: `${totalEntradas > 0 ? Math.min(100, (totalConsumo / totalEntradas) * 100).toFixed(1) : 0}%` }} />
                <span className="absolute inset-0 flex items-center justify-center text-xs font-mono text-zinc-900 font-bold">
                  {totalEntradas > 0 ? `${((totalConsumo / totalEntradas) * 100).toFixed(1)}% consumido` : "Sin datos"}
                </span>
              </div>
              <div className="flex justify-between text-xs text-zinc-600 font-mono mt-1">
                <span>0 L</span><span>{totalEntradas.toLocaleString()} L total</span>
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded p-4">
              <p className="text-xs text-zinc-500 uppercase tracking-widest mb-3 font-mono">Rendimiento por Unidad</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono">
                  <thead><tr className="border-b border-zinc-800">
                    {["Unidad","Litros","Horas","L/Hr","Registros"].map(h => (
                      <th key={h} className="text-left text-zinc-600 pb-2 pr-4 uppercase tracking-widest">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {rendimientos.length === 0
                      ? <tr><td colSpan={5} className="text-zinc-600 py-4">Sin datos aún</td></tr>
                      : rendimientos.map(r => (
                        <tr key={r.unidad} className="border-b border-zinc-900 hover:bg-zinc-800/40 transition-colors">
                          <td className="py-2 pr-4 text-amber-400 font-bold">{r.unidad}</td>
                          <td className="py-2 pr-4 text-zinc-300">{r.litros} L</td>
                          <td className="py-2 pr-4 text-zinc-300">{r.horas} hr</td>
                          <td className="py-2 pr-4"><Badge color={Number(r.lph)<13?"green":Number(r.lph)<16?"amber":"red"}>{r.lph} L/hr</Badge></td>
                          <td className="py-2 text-zinc-500">{r.registros}</td>
                        </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-zinc-900 border border-zinc-800 rounded p-4">
                <p className="text-xs text-zinc-500 uppercase tracking-widest mb-3 font-mono">Últimos Consumos</p>
                {consumos.length === 0
                  ? <p className="text-zinc-600 text-xs font-mono">Sin registros aún.</p>
                  : <div className="space-y-2">{[...consumos].reverse().slice(0,5).map(c => (
                    <div key={c.id} className="flex items-start justify-between py-1 border-b border-zinc-800">
                      <div>
                        <span className="text-amber-400 font-bold text-xs">{c.unidad}</span>
                        <span className="text-zinc-600 text-xs ml-2">{formatDate(c.fecha)}</span>
                        <div className="mt-0.5">{c.trabajo ? <Badge color="blue">{c.trabajo}</Badge> : <Badge color="gray">—</Badge>}</div>
                      </div>
                      <span className="text-red-400 font-mono text-xs ml-2 whitespace-nowrap">-{c.litros} L</span>
                    </div>
                  ))}</div>
                }
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded p-4">
                <p className="text-xs text-zinc-500 uppercase tracking-widest mb-3 font-mono">Últimas Entradas</p>
                {entradas.length === 0
                  ? <p className="text-zinc-600 text-xs font-mono">Sin registros aún.</p>
                  : <div className="space-y-2">{[...entradas].reverse().slice(0,5).map(e => (
                    <div key={e.id} className="flex items-start justify-between py-1 border-b border-zinc-800">
                      <div>
                        <span className="text-emerald-400 font-bold text-xs">{e.proveedor || "Sin proveedor"}</span>
                        <div className="text-zinc-600 text-xs">{formatDate(e.fecha)}{e.factura && ` · ${e.factura}`}</div>
                      </div>
                      <span className="text-emerald-400 font-mono text-xs ml-2 whitespace-nowrap">+{e.litros} L</span>
                    </div>
                  ))}</div>
                }
              </div>
            </div>
          </div>
        )}

        {/* ── CONSUMO ── */}
        {tab === "consumo" && (
          <div className="space-y-6">
            <div className="bg-zinc-900 border border-zinc-800 rounded p-5">
              <p className="text-xs text-zinc-500 uppercase tracking-widest mb-4 font-mono">⬇ Registrar Consumo</p>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Fecha *</label>
                  <input type="date" className={inputCls} value={fc.fecha}
                    onChange={e => setFc(p => ({ ...p, fecha: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>Unidad *</label>
                  <select className={inputCls} value={fc.unidad} onChange={e => onSelectUnidad(e.target.value)}>
                    <option value="">Seleccionar unidad...</option>
                    <optgroup label="─── Tractores ───">
                      {UNIDADES.filter(u => u.startsWith("Tractor")).map(u => <option key={u}>{u}</option>)}
                    </optgroup>
                    <optgroup label="─── Trilladoras ───">
                      {UNIDADES.filter(u => u.startsWith("Trilladora")).map(u => <option key={u}>{u}</option>)}
                    </optgroup>
                    <optgroup label="─── Tortons ───">
                      {UNIDADES.filter(u => u.startsWith("Torton")).map(u => <option key={u}>{u}</option>)}
                    </optgroup>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Litros consumidos *</label>
                  <input type="number" min="0" step="0.1" className={inputCls} placeholder="0.0"
                    value={fc.litros} onChange={e => setFc(p => ({ ...p, litros: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>Trabajo realizado</label>
                  <select className={inputCls} value={fc.trabajo}
                    onChange={e => setFc(p => ({ ...p, trabajo: e.target.value }))}>
                    <option value="">Sin especificar</option>
                    {TRABAJOS.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              {fc.unidad && (
                <div className="mt-4 bg-zinc-800/60 border border-zinc-700 rounded p-4">
                  <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <p className="text-xs text-zinc-400 uppercase tracking-widest font-mono">Horas de trabajo</p>
                    <div className="flex gap-2 flex-wrap">
                      {tieneHorometro(fc.unidad) && !fc.naHoras && (
                        <>
                          {["horometro","directas"].map(m => (
                            <button key={m} onClick={() => setFc(p => ({ ...p, modoHoras: m }))}
                              className={`text-xs font-mono px-3 py-1 rounded border transition-all ${fc.modoHoras === m && !fc.naHoras ? "bg-amber-500 border-amber-500 text-zinc-900 font-bold" : "bg-zinc-800 border-zinc-600 text-zinc-400 hover:border-zinc-400"}`}>
                              {m === "horometro" ? "Horómetro" : "Horas directas"}
                            </button>
                          ))}
                        </>
                      )}
                      <button
                        onClick={() => setFc(p => ({ ...p, naHoras: !p.naHoras }))}
                        className={`text-xs font-mono px-3 py-1 rounded border transition-all ${fc.naHoras ? "bg-zinc-500 border-zinc-400 text-zinc-900 font-bold" : "bg-zinc-800 border-zinc-600 text-zinc-400 hover:border-zinc-400"}`}>
                        N/A
                      </button>
                    </div>
                  </div>
                  {fc.naHoras ? (
                    <div className="px-3 py-2 bg-zinc-900 border border-zinc-600 rounded text-xs font-mono text-zinc-400">
                      Horas marcadas como <strong className="text-zinc-300">N/A</strong> — no se calculará rendimiento L/hr para este registro.
                    </div>
                  ) : fc.modoHoras === "horometro" ? (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>Horómetro anterior</label>
                        <input type="number" min="0" step="0.1" className={inputCls} placeholder="ej. 4520.0"
                          value={fc.horometroAnterior} onChange={e => setFc(p => ({ ...p, horometroAnterior: e.target.value }))} />

                      </div>
                      <div>
                        <label className={labelCls}>Horómetro actual</label>
                        <input type="number" min="0" step="0.1" className={inputCls} placeholder="ej. 4528.5"
                          value={fc.horometroActual} onChange={e => setFc(p => ({ ...p, horometroActual: e.target.value }))} />
                      </div>
                      {horasCalculadas !== null && horasCalculadas !== "N/A" && (
                        <div className="col-span-2 px-3 py-2 bg-zinc-900 border border-amber-500/30 rounded text-xs font-mono text-amber-400">
                          Horas trabajadas: <strong>{horasCalculadas} hr</strong>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <label className={labelCls}>Horas trabajadas</label>
                      <input type="number" min="0" step="0.1" className={inputCls} placeholder="ej. 8.5"
                        value={fc.horasDirectas} onChange={e => setFc(p => ({ ...p, horasDirectas: e.target.value }))} />
                    </div>
                  )}
                </div>
              )}

              {fc.litros && horasCalculadas !== null && horasCalculadas !== "N/A" && horasCalculadas > 0 && (
                <div className="mt-3 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-xs font-mono text-amber-400">
                  Rendimiento estimado: <strong>{(Number(fc.litros) / horasCalculadas).toFixed(2)} L/hr</strong>
                  {fc.trabajo && <span className="text-zinc-500 ml-2">· {fc.trabajo}</span>}
                </div>
              )}

              <div className="mt-4">
                <label className={labelCls}>Notas</label>
                <textarea className={`${inputCls} resize-none`} rows={2} placeholder="Observaciones opcionales..."
                  value={fc.notas} onChange={e => setFc(p => ({ ...p, notas: e.target.value }))} />
              </div>
              <button onClick={addConsumo}
                className="mt-4 w-full bg-amber-500 hover:bg-amber-400 text-zinc-900 font-bold text-sm py-2.5 rounded font-mono uppercase tracking-widest transition-all">
                Registrar Consumo {!urlGuardada && "(sin sync)"}
              </button>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded p-4">
              <p className="text-xs text-zinc-500 uppercase tracking-widest mb-3 font-mono">Historial de Consumos</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono">
                  <thead><tr className="border-b border-zinc-800">
                    {["Fecha","Unidad","Litros","Horómetro","Horas","L/Hr","Trabajo",""].map(h => (
                      <th key={h} className="text-left text-zinc-600 pb-2 pr-3 uppercase tracking-widest">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {consumos.length === 0
                      ? <tr><td colSpan={8} className="text-zinc-600 py-4">Sin registros aún.</td></tr>
                      : [...consumos].reverse().map(c => (
                        <tr key={c.id} className="border-b border-zinc-900 hover:bg-zinc-800/40 transition-colors">
                          <td className="py-2 pr-3 text-zinc-500 whitespace-nowrap">{formatDate(c.fecha)}</td>
                          <td className="py-2 pr-3 text-amber-400 font-bold">{c.unidad}</td>
                          <td className="py-2 pr-3 text-red-400">{c.litros} L</td>
                          <td className="py-2 pr-3 text-zinc-500">
                            {c.modoHoras === "horometro" && c.horometroAnterior
                              ? <span>{c.horometroAnterior}→<span className="text-zinc-300">{c.horometroActual}</span></span>
                              : <span className="text-zinc-700">—</span>}
                          </td>
                          <td className="py-2 pr-3 text-zinc-300">{c.horas} hr</td>
                          <td className="py-2 pr-3">{c.horas === "N/A" ? <Badge color="gray">N/A</Badge> : <Badge color={Number(c.litros/c.horas)<13?"green":Number(c.litros/c.horas)<16?"amber":"red"}>{(c.litros/c.horas).toFixed(1)} L/hr</Badge>}</td>
                          <td className="py-2 pr-3">{c.trabajo ? <Badge color="blue">{c.trabajo}</Badge> : <Badge color="gray">—</Badge>}</td>
                          <td className="py-2">
                            <button onClick={() => delConsumo(c.id)} className="text-zinc-700 hover:text-red-400 transition-colors" title="Eliminar">✕</button>
                          </td>
                        </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── ENTRADAS ── */}
        {tab === "entrada" && (
          <div className="space-y-6">
            <div className="bg-zinc-900 border border-zinc-800 rounded p-5">
              <p className="text-xs text-zinc-500 uppercase tracking-widest mb-4 font-mono">⬆ Registrar Entrada de Diesel</p>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Fecha *</label>
                  <input type="date" className={inputCls} value={fe.fecha}
                    onChange={e => setFe(p => ({ ...p, fecha: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>Litros recibidos *</label>
                  <input type="number" min="0" className={inputCls} placeholder="0.0"
                    value={fe.litros} onChange={e => setFe(p => ({ ...p, litros: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>Proveedor</label>
                  <input className={inputCls} placeholder="Nombre del proveedor..."
                    value={fe.proveedor} onChange={e => setFe(p => ({ ...p, proveedor: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>No. Factura / Remisión</label>
                  <input className={inputCls} placeholder="F-0000"
                    value={fe.factura} onChange={e => setFe(p => ({ ...p, factura: e.target.value }))} />
                </div>
                <div className="md:col-span-2">
                  <label className={labelCls}>Notas</label>
                  <textarea className={`${inputCls} resize-none`} rows={2} placeholder="Observaciones..."
                    value={fe.notas} onChange={e => setFe(p => ({ ...p, notas: e.target.value }))} />
                </div>
              </div>
              <button onClick={addEntrada}
                className="mt-4 w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm py-2.5 rounded font-mono uppercase tracking-widest transition-all">
                Registrar Entrada {!urlGuardada && "(sin sync)"}
              </button>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded p-4">
              <p className="text-xs text-zinc-500 uppercase tracking-widest mb-3 font-mono">Historial de Entradas</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono">
                  <thead><tr className="border-b border-zinc-800">
                    {["Fecha","Litros","Proveedor","Factura","Notas",""].map(h => (
                      <th key={h} className="text-left text-zinc-600 pb-2 pr-3 uppercase tracking-widest">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {entradas.length === 0
                      ? <tr><td colSpan={6} className="text-zinc-600 py-4">Sin registros aún.</td></tr>
                      : [...entradas].reverse().map(e => (
                        <tr key={e.id} className="border-b border-zinc-900 hover:bg-zinc-800/40 transition-colors">
                          <td className="py-2 pr-3 text-zinc-500">{formatDate(e.fecha)}</td>
                          <td className="py-2 pr-3 text-emerald-400 font-bold">+{e.litros} L</td>
                          <td className="py-2 pr-3 text-zinc-300">{e.proveedor || "—"}</td>
                          <td className="py-2 pr-3 text-zinc-500">{e.factura || "—"}</td>
                          <td className="py-2 text-zinc-600">{e.notas || "—"}</td>
                          <td className="py-2">
                            <button onClick={() => delEntrada(e.id)} className="text-zinc-700 hover:text-red-400 transition-colors" title="Eliminar">✕</button>
                          </td>
                        </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── REPORTES ── */}
        {tab === "reportes" && (
          <div className="space-y-6">
            <div className="grid md:grid-cols-3 gap-3">
              <StatCard label="Entradas totales" value={`${totalEntradas.toLocaleString()} L`} accent="blue" />
              <StatCard label="Consumo total"    value={`${totalConsumo.toLocaleString()} L`}  accent="amber" />
              <StatCard label="Saldo"            value={`${saldo.toLocaleString()} L`}          accent={saldo >= 0 ? "green" : "red"} />
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded p-4">
              <p className="text-xs text-zinc-500 uppercase tracking-widest mb-3 font-mono">Rendimiento por Unidad (L/hr)</p>
              {rendimientos.length === 0
                ? <p className="text-zinc-600 text-xs font-mono">Sin datos aún.</p>
                : <div className="space-y-3">
                  {rendimientos.map(r => {
                    const maxLph = Math.max(...rendimientos.map(x => Number(x.lph)));
                    const pct = maxLph > 0 ? (Number(r.lph) / maxLph) * 100 : 0;
                    const color = Number(r.lph) < 13 ? "#10b981" : Number(r.lph) < 16 ? "#f59e0b" : "#ef4444";
                    return (
                      <div key={r.unidad}>
                        <div className="flex justify-between text-xs font-mono mb-1">
                          <span className="text-amber-400 font-bold">{r.unidad}</span>
                          <span style={{ color }}>{r.lph} L/hr · {r.litros} L · {r.horas} hr</span>
                        </div>
                        <div className="h-2 bg-zinc-800 rounded overflow-hidden">
                          <div className="h-full rounded transition-all" style={{ width: `${pct}%`, background: color }} />
                        </div>
                      </div>
                    );
                  })}
                  <p className="text-xs text-zinc-700 font-mono">Verde &lt;13 L/hr · Ámbar 13–16 L/hr · Rojo &gt;16 L/hr</p>
                </div>
              }
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded p-4">
              <p className="text-xs text-zinc-500 uppercase tracking-widest mb-3 font-mono">Rendimiento por Trabajo</p>
              {rendTrabajo.length === 0
                ? <p className="text-zinc-600 text-xs font-mono">Sin datos suficientes aún.</p>
                : <table className="w-full text-xs font-mono">
                  <thead><tr className="border-b border-zinc-800">
                    {["Trabajo","Litros","Horas","L/hr promedio"].map(h => (
                      <th key={h} className="text-left text-zinc-600 pb-2 pr-4 uppercase tracking-widest">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {rendTrabajo.map(r => (
                      <tr key={r.trabajo} className="border-b border-zinc-900 hover:bg-zinc-800/40">
                        <td className="py-2 pr-4 text-blue-400 font-bold">{r.trabajo}</td>
                        <td className="py-2 pr-4 text-zinc-300">{r.litros} L</td>
                        <td className="py-2 pr-4 text-zinc-300">{r.horas} hr</td>
                        <td className="py-2"><Badge color={Number(r.lph)<13?"green":Number(r.lph)<16?"amber":"red"}>{r.lph} L/hr</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              }
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded p-4">
              <p className="text-xs text-zinc-500 uppercase tracking-widest mb-3 font-mono">Balance Detallado</p>
              <div className="space-y-1 text-xs font-mono">
                {[...entradas].sort((a,b) => new Date(a.fecha)-new Date(b.fecha)).map(e => (
                  <div key={e.id} className="flex justify-between py-1 border-b border-zinc-900">
                    <span className="text-zinc-600">{formatDate(e.fecha)} · {e.proveedor||"Entrada"}{e.factura&&` (${e.factura})`}</span>
                    <span className="text-emerald-400">+{e.litros} L</span>
                  </div>
                ))}
                {[...consumos].sort((a,b) => new Date(a.fecha)-new Date(b.fecha)).map(c => (
                  <div key={c.id} className="flex justify-between py-1 border-b border-zinc-900">
                    <span className="text-zinc-600">{formatDate(c.fecha)} · {c.unidad}{c.trabajo&&` · ${c.trabajo}`}</span>
                    <span className="text-red-400">-{c.litros} L</span>
                  </div>
                ))}
                <div className="flex justify-between py-2 mt-2 border-t border-zinc-700">
                  <span className="text-zinc-400 font-bold uppercase tracking-widest">SALDO</span>
                  <span className={`font-bold text-sm ${saldo >= 0 ? "text-emerald-400" : "text-red-400"}`}>{saldo >= 0 ? "+" : ""}{saldo} L</span>
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
