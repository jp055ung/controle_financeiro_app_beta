import { useState, useEffect, useCallback } from "react";

// SVG coin — substitui 🪙 que não renderiza em Windows/alguns Android
function CoinIcon({ size = 40, style = {} }: { size?: number; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" style={style}>
      <circle cx="20" cy="20" r="19" fill="url(#coinGrad)" stroke="#c8910a" strokeWidth="1.5"/>
      <circle cx="20" cy="20" r="15" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1"/>
      <text x="20" y="26" textAnchor="middle" fontSize="16" fontWeight="900"
        fontFamily="'Sora','DM Sans',system-ui,sans-serif" fill="#7a4a00" letterSpacing="-1">$</text>
      <defs>
        <linearGradient id="coinGrad" x1="8" y1="4" x2="32" y2="36" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffe066"/>
          <stop offset="40%" stopColor="#ffd700"/>
          <stop offset="100%" stopColor="#d4900a"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

const API = "/api";
const fmt = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
const num = (s: any) => parseFloat(String(s || 0));

type User = { id: number; name: string; email: string; salaryBase?: string; xp?: number; level?: string; levelNum?: number; streakDays?: number; lastCheckin?: string; isNewUser?: boolean };
type Expense = { id: number; categoryId: number; name: string; amount: string; subcategory?: string; paid: number; dueDate?: string; recurring?: number };
type CC = { id: number; description: string; amount: string; subcategory?: string };
type Income = { id: number; description: string; amount: string; date: string };

const CATS = [
  { id: 1, name: "Pagar-se",        emoji: "💆", color: "#6c63ff", desc: "Invista em você mesmo" },
  { id: 2, name: "Doar/Ajudar",     emoji: "💝", color: "#ff6b9d", desc: "Generosidade gera abundância" },
  { id: 3, name: "Investir",        emoji: "📈", color: "#00d68f", desc: "Construa seu patrimônio" },
  { id: 4, name: "Contas",          emoji: "📋", color: "#ffb703", desc: "Suas obrigações mensais" },
  { id: 5, name: "Objetivo",        emoji: "🎯", color: "#8b5cf6", desc: "Seu sonho de curto prazo" },
  { id: 6, name: "Sonho",           emoji: "✨", color: "#06b6d4", desc: "Sua meta de longo prazo" },
  { id: 7, name: "Abundar",         emoji: "🌟", color: "#f97316", desc: "Aproveite a vida" },
  { id: 8, name: "Gastos Variáveis",emoji: "🛒", color: "#ef4444", desc: "Gastos do dia a dia" },
];
const CC_CATS = ["Comida","Roupas","Gasolina","Transporte","Saúde","Streaming","Outros"];

// ── BANCO DE FRASES ──────────────────────────────────────────────────────────
const STREAK_PHRASES: Record<string, string[]> = {
  "1-3": [
    "Controle hoje, tranquilidade amanhã.",
    "Cada registro é um passo rumo ao controle.",
    "Quem começa a olhar já mudou o jogo.",
    "Dinheiro visto é dinheiro protegido.",
    "O hábito está nascendo.",
    "Um dia de cada vez.",
  ],
  "3-7": [
    "O cartão só vira vilão pra quem não olha pra ele.",
    "Você já não gasta no automático.",
    "Atenção diária muda resultados.",
    "O controle está virando rotina.",
    "Dinheiro organizado rende mais que dinheiro esquecido.",
    "Continue assim.",
  ],
  "7-14": [
    "Uma semana controlando o dinheiro. Isso não é sorte.",
    "O hábito já começou a se formar.",
    "Você está construindo disciplina.",
    "Uma semana muda hábitos.",
    "O dinheiro agora tem dono atento.",
    "Controle é consistência.",
  ],
  "14-25": [
    "Quinze dias. Disciplina cria liberdade.",
    "Você já mudou um hábito importante.",
    "O controle já virou hábito.",
    "O dinheiro já tem atenção constante.",
    "Metade do mês com foco no dinheiro.",
  ],
  "25-30": [
    "Disciplina financeira gera riqueza.",
    "O dinheiro respeita quem acompanha.",
    "O controle de hoje cria riqueza amanhã.",
    "O hábito está maduro.",
    "Você está construindo base financeira.",
  ],
  "30+": [
    "Um mês inteiro. Isso é mentalidade, não sorte.",
    "O hábito virou identidade.",
    "O controle virou poder.",
    "Riqueza nasce da constância.",
    "O dinheiro agora trabalha com você.",
  ],
};

const ABSENT_PHRASES = [
  "O problema não é gastar. É não saber quanto.",
  "Quem não olha o saldo, conversa com o susto.",
  "Pequenos descuidos viram grandes boletos.",
  "O dinheiro que você não acompanha decide sozinho.",
  "O gasto não dói hoje. Dói quando chega a fatura.",
  "Quem esquece o dinheiro acaba correndo atrás dele.",
  "Dinheiro sem direção vira despesa.",
  "O gasto passa rápido. A conta fica.",
  "Gastar sem olhar é dirigir no escuro.",
  "Quando o controle some, o dinheiro também.",
  "O dinheiro que você não vê desaparece.",
  "Gastar no automático custa caro.",
  "O gasto silencioso vira fatura barulhenta.",
  "Sem registro, tudo parece menor do que é.",
  "O dinheiro ignorado vira surpresa.",
];

function rnd<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

function getStreakPhrase(days: number): string {
  if (days >= 30) return rnd(STREAK_PHRASES["30+"]);
  if (days >= 25) return rnd(STREAK_PHRASES["25-30"]);
  if (days >= 14) return rnd(STREAK_PHRASES["14-25"]);
  if (days >= 7)  return rnd(STREAK_PHRASES["7-14"]);
  if (days >= 3)  return rnd(STREAK_PHRASES["3-7"]);
  return rnd(STREAK_PHRASES["1-3"]);
}

function getStreakIcon(days: number): string {
  if (days >= 30) return "👑";
  if (days >= 14) return "💎";
  if (days >= 7)  return "⚡";
  if (days >= 5)  return "🔥";
  if (days >= 3)  return "🔥";
  if (days >= 2)  return "🔥";
  return "🔸";
}

function getStreakXP(days: number): number {
  const map: Record<number, number> = { 1: 5, 2: 15, 3: 25, 4: 35, 5: 50, 6: 65, 7: 100, 14: 150, 30: 300 };
  return map[days] ?? 65;
}

const XP_REWARDS: Record<string, number> = {
  addExpense: 10, addIncome: 25, payBill: 50, addCC: 10,
};

// ── XP LEVEL BAR ─────────────────────────────────────────────────────────────
function XPLevel({ xp, level, levelNum }: { xp: number; level: string; levelNum: number }) {
  const xpPerLevel = 100;
  const currentLevelXp = xp % xpPerLevel;
  const pct = Math.round((currentLevelXp / xpPerLevel) * 100);
  const color = level === 'avancado' ? '#ffd700' : '#6c63ff';
  return (
    <div style={{ background: "var(--bg3)", borderRadius: 14, padding: "12px 16px", marginBottom: 16, border: "1px solid var(--border)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 800, color, letterSpacing: 1 }}>⚔️ {level === 'avancado' ? 'AVANÇADO' : 'INICIANTE'} NV.{levelNum}</span>
        <span style={{ fontSize: 11, color: "var(--text2)" }}>{currentLevelXp}/{xpPerLevel} XP · {pct}%</span>
      </div>
      <div className="xp-bar-wrap"><div className="xp-bar-fill" style={{ width: `${pct}%` }} /></div>
      <div style={{ fontSize: 10, color: "var(--text2)", marginTop: 4 }}>Total: {xp} XP acumulado</div>
    </div>
  );
}

function Toast({ msg, onDone }: { msg: string; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 2500); return () => clearTimeout(t); }, []);
  return <div className="toast">{msg}</div>;
}

function Modal({ title, onClose, children }: any) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 100, padding: "0 0 0 0" }} onClick={onClose}>
      <div style={{ background: "var(--bg2)", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto", padding: "20px 20px 40px" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h3 style={{ fontSize: 17, fontWeight: 800 }}>{title}</h3>
          <button onClick={onClose} style={{ background: "var(--bg3)", border: "1px solid var(--border)", color: "var(--text2)", width: 32, height: 32, borderRadius: 8, fontSize: 16 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── DAILY STREAK MODAL ────────────────────────────────────────────────────────
function StreakModal({ user, onClose, onClaim }: { user: User; onClose: () => void; onClaim: (data: any) => void }) {
  const [streakData, setStreakData] = useState<{ streakDays: number; claimedToday: boolean; expiresIn: string } | null>(null);
  const [claimed, setClaimed] = useState(false);
  const [claimResult, setClaimResult] = useState<any>(null);
  const [phrase, setPhrase] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`${API}/users/${user.id}/streak`).then(r => r.json()).then(d => {
      setStreakData(d);
      setClaimed(d.claimedToday);
      const days = d.claimedToday ? (d.streakDays) : (d.streakDays + 1);
      setPhrase(getStreakPhrase(days));
    });
  }, []);

  const handleClaim = async () => {
    if (claimed || loading) return;
    setLoading(true);
    const res = await fetch(`${API}/users/${user.id}/streak/checkin`, { method: "POST" });
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      setClaimed(true);
      setClaimResult(data);
      setStreakData(s => s ? { ...s, streakDays: data.streakDays, claimedToday: true } : s);
      setPhrase(getStreakPhrase(data.streakDays));
      onClaim(data);
    }
  };

  const days = streakData?.streakDays ?? 0;
  const nextDays = claimed ? days : days + 1;
  const xpNext = getStreakXP(nextDays);
  const icon = getStreakIcon(nextDays);

  // Linha de próximos dias
  const buildDayCards = () => {
    const result = [];
    const start = Math.max(1, (claimed ? days : days + 1) - 1);
    const points = [1, 2, 3, 4, 5, 6, 7];
    const relevant = points.filter(d => d >= start - 1).slice(0, 5);
    if (!relevant.includes(7)) { relevant.pop(); relevant.push(7); }
    for (const d of relevant) {
      const isDone = d < nextDays || (claimed && d === nextDays);
      const isCurrent = d === nextDays;
      result.push(
        <div key={d} style={{
          flex: 1, minWidth: 0, background: isCurrent ? "rgba(108,99,255,0.15)" : "var(--bg3)",
          border: `1px solid ${isCurrent ? "#6c63ff" : isDone ? "rgba(0,214,143,0.3)" : "var(--border)"}`,
          borderRadius: 10, padding: "8px 4px", textAlign: "center",
          transform: isCurrent ? "scale(1.05)" : "none",
        }}>
          <div style={{ fontSize: 16 }}>{isDone ? "✅" : getStreakIcon(d)}</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: isCurrent ? "#6c63ff" : isDone ? "var(--green)" : "var(--text)", marginTop: 2 }}>
            {d === 7 ? "7⚡" : d}
          </div>
          <div style={{ fontSize: 9, color: "var(--text2)", marginTop: 1 }}>{getStreakXP(d)}xp</div>
        </div>
      );
    }
    return result;
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.8)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 100 }} onClick={onClose}>
      <div style={{ background: "var(--bg2)", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 480, padding: "24px 20px 40px", position: "relative" }} onClick={e => e.stopPropagation()}>

        {/* Fechar */}
        <button onClick={onClose} style={{ position: "absolute", top: 16, right: 16, background: "var(--bg3)", border: "1px solid var(--border)", color: "var(--text2)", width: 32, height: 32, borderRadius: 8, fontSize: 16 }}>✕</button>

        {/* Título */}
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text2)", textTransform: "uppercase", letterSpacing: 2, marginBottom: 4 }}>Daily Streak</div>
          <div style={{ fontSize: 11, color: "var(--text2)" }}>Apareça todo dia. Construa algo real.</div>
        </div>

        {/* Contador central */}
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 56, lineHeight: 1, filter: "drop-shadow(0 0 16px rgba(108,99,255,0.5))" }}>{icon}</div>
          <div style={{ fontFamily: "monospace", fontSize: 72, fontWeight: 900, color: "#6c63ff", lineHeight: 1, marginTop: 8 }}>{nextDays}</div>
          <div style={{ fontSize: 12, color: "var(--text2)", textTransform: "uppercase", letterSpacing: 2, marginTop: 4 }}>DIAS CONSECUTIVOS</div>
        </div>

        {/* Linha de dias */}
        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          {buildDayCards()}
        </div>

        {/* Frase */}
        <div style={{
          padding: "14px 16px", marginBottom: 12,
          background: "rgba(108,99,255,0.08)", borderLeft: "3px solid #6c63ff",
          borderRadius: "0 10px 10px 0", fontSize: 15, fontWeight: 600, color: "var(--text)", lineHeight: 1.5,
        }}>
          {claimed && claimResult ? `Resgatado! Volte amanhã para não quebrar sua sequência.` : phrase}
        </div>

        {/* Timer */}
        {streakData && !claimed && (
          <div style={{ textAlign: "center", fontSize: 11, color: "var(--text2)", marginBottom: 12 }}>
            ⏱ Expira em <strong style={{ color: "var(--text)" }}>{streakData.expiresIn}</strong>
          </div>
        )}

        {/* Botão */}
        {claimed ? (
          <div style={{ width: "100%", padding: "16px", borderRadius: 14, background: "rgba(0,214,143,0.1)", border: "1px solid rgba(0,214,143,0.3)", textAlign: "center", fontSize: 15, fontWeight: 700, color: "var(--green)" }}>
            ✅ Resgatado hoje · {claimResult ? `+${claimResult.xpGained} XP` : "Volte amanhã"}
          </div>
        ) : (
          <button onClick={handleClaim} disabled={loading} style={{ width: "100%", padding: "16px", border: "none", borderRadius: 14, background: "linear-gradient(135deg,#6c63ff,#b44fff)", color: "white", fontSize: 16, fontWeight: 800, cursor: "pointer" }}>
            {loading ? "..." : `🎁 Resgatar +${xpNext} XP`}
          </button>
        )}
      </div>
    </div>
  );
}

// ── ONBOARDING (só novos usuários) ───────────────────────────────────────────
function Onboarding({ user, onDone }: { user: User; onDone: () => void }) {
  const [step, setStep] = useState(0);
  const POTES = [
    { emoji: "💆", name: "Pagar-se",    pct: "5-10%", color: "#6c63ff", desc: "Invista em você mesmo" },
    { emoji: "💝", name: "Doar",        pct: "5-10%", color: "#ff6b9d", desc: "Generosidade gera abundância" },
    { emoji: "📈", name: "Investir",    pct: "5-10%", color: "#00d68f", desc: "Construa patrimônio" },
    { emoji: "📋", name: "Contas",      pct: "60-70%", color: "#ffb703", desc: "Obrigações mensais" },
    { emoji: "✨", name: "Sonho",       pct: "5-10%", color: "#8b5cf6", desc: "Sua meta motivadora" },
    { emoji: "🌟", name: "Abundar",     pct: "5-10%", color: "#f97316", desc: "Aproveite a vida" },
  ];

  const steps = [
    // Step 0 — Boas-vindas
    <div style={{ textAlign: "center", padding: "0 8px" }}>
      <div style={{ marginBottom: 16, display: "flex", justifyContent: "center" }}><CoinIcon size={72}/></div>
      <h2 style={{ fontSize: 26, fontWeight: 900, background: "linear-gradient(135deg,#6c63ff,#b44fff,#ffd700)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: 12 }}>
        Bem-vindo, {user.name?.split(" ")[0]}!
      </h2>
      <p style={{ color: "var(--text2)", fontSize: 15, lineHeight: 1.6, marginBottom: 24 }}>
        No MoneyGame, cada ação financeira vira experiência. Registre contas, ganhe XP e suba de nível enquanto constrói uma vida financeira de verdade.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {[
          { icon: "⚔️", text: "Ganhe XP a cada registro" },
          { icon: "🔥", text: "Mantenha sua streak diária" },
          { icon: "📈", text: "Suba de nível e desbloqueie títulos" },
        ].map((f, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 14px", textAlign: "left" }}>
            <span style={{ fontSize: 22 }}>{f.icon}</span>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{f.text}</span>
          </div>
        ))}
      </div>
    </div>,

    // Step 1 — 6 Potes
    <div>
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 900, marginBottom: 8 }}>🏺 Os 6 Potes da Riqueza</h2>
        <p style={{ color: "var(--text2)", fontSize: 13, lineHeight: 1.5 }}>A metodologia que transforma como você distribui seu dinheiro</p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {POTES.map((p, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "var(--bg3)", borderRadius: 12, borderLeft: `3px solid ${p.color}` }}>
            <span style={{ fontSize: 22, flexShrink: 0 }}>{p.emoji}</span>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontWeight: 700, fontSize: 13 }}>{p.name}</span>
                <span style={{ fontSize: 11, color: p.color, fontWeight: 700 }}>{p.pct}</span>
              </div>
              <div style={{ fontSize: 11, color: "var(--text2)", marginTop: 2 }}>{p.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>,

    // Step 2 — Salário
    <OnboardingSalary user={user} onDone={onDone} />,
  ];

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column", padding: "24px 20px" }}>
      {/* Progress dots */}
      <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 32 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ width: i === step ? 20 : 8, height: 8, borderRadius: 4, background: i === step ? "#6c63ff" : "var(--bg3)", transition: "all .3s" }} />
        ))}
      </div>

      <div style={{ flex: 1 }}>{steps[step]}</div>

      {step < 2 && (
        <button className="btn-primary" onClick={() => setStep(s => s + 1)} style={{ width: "100%", marginTop: 24, padding: "16px", fontSize: 16 }}>
          {step === 0 ? "Ver metodologia →" : "Configurar meu perfil →"}
        </button>
      )}
    </div>
  );
}

function OnboardingSalary({ user, onDone }: { user: User; onDone: () => void }) {
  const [salary, setSalary] = useState("");
  const [loading, setLoading] = useState(false);
  const save = async () => {
    if (!salary) { onDone(); return; }
    setLoading(true);
    await fetch(`${API}/users/${user.id}/settings`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ salaryBase: parseFloat(salary) }) });
    setLoading(false);
    onDone();
  };
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>💰</div>
      <h2 style={{ fontSize: 20, fontWeight: 900, marginBottom: 8 }}>Qual é seu salário base?</h2>
      <p style={{ color: "var(--text2)", fontSize: 13, marginBottom: 24, lineHeight: 1.5 }}>Isso ajuda a calcular seu saldo livre e metas de renda extra. Você pode alterar depois.</p>
      <input type="number" placeholder="Ex: 3000" value={salary} onChange={e => setSalary(e.target.value)} style={{ width: "100%", fontSize: 18, textAlign: "center", marginBottom: 16 }} />
      <button className="btn-primary" onClick={save} disabled={loading} style={{ width: "100%", padding: "16px", fontSize: 16 }}>
        {loading ? "Salvando..." : "🚀 Começar minha jornada"}
      </button>
      <button className="btn-ghost" onClick={onDone} style={{ width: "100%", marginTop: 8, fontSize: 13 }}>Pular por agora</button>
    </div>
  );
}

// ── AUTH ──────────────────────────────────────────────────────────────────────
function Auth({ onLogin }: { onLogin: (u: User) => void }) {
  const [mode, setMode] = useState<"login"|"register"|"intro">("intro");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true); setError("");
    try {
      const res = await fetch(`${API}/auth/${mode}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Erro"); return; }
      onLogin(data.user);
    } catch { setError("Erro de conexão"); } finally { setLoading(false); }
  };

  if (mode === "intro") return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#0a0d14 0%,#111420 50%,#0a0d14 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 20px", textAlign: "center" }}>
      <div style={{ marginBottom: 16 }}><CoinIcon size={72}/></div>
      <h1 style={{ fontSize: 36, fontWeight: 900, fontFamily: "var(--font-display)", background: "linear-gradient(135deg,#6c63ff,#b44fff,#ffd700)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: 8 }}>MONEYGAME</h1>
      <p style={{ color: "var(--text2)", fontSize: 15, marginBottom: 32, maxWidth: 320 }}>Gamifique seu controle financeiro com a metodologia dos 6 potes</p>
      <div style={{ width: "100%", maxWidth: 360, display: "flex", flexDirection: "column", gap: 12, marginBottom: 40 }}>
        {[
          { emoji: "⚔️", title: "Suba de Nível", desc: "Ganhe XP a cada ação financeira" },
          { emoji: "🔥", title: "Streak Diária", desc: "Apareça todo dia e acumule recompensas" },
          { emoji: "📊", title: "Controle Total", desc: "Despesas, cartão, renda extra e sonhos" },
        ].map((f, i) => (
          <div key={i} style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center", gap: 14, textAlign: "left" }}>
            <span style={{ fontSize: 28 }}>{f.emoji}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{f.title}</div>
              <div style={{ fontSize: 12, color: "var(--text2)", marginTop: 2 }}>{f.desc}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ width: "100%", maxWidth: 360, display: "flex", flexDirection: "column", gap: 10 }}>
        <button className="btn-primary" onClick={() => setMode("register")} style={{ width: "100%", fontSize: 16, padding: "16px" }}>🚀 COMEÇAR MINHA JORNADA</button>
        <button className="btn-ghost" onClick={() => setMode("login")} style={{ width: "100%" }}>Já tenho conta</button>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", padding: "20px" }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ marginBottom: 8, display: "flex", justifyContent: "center" }}><CoinIcon size={48}/></div>
          <h1 style={{ fontSize: 24, fontWeight: 900, fontFamily: "var(--font-display)", background: "linear-gradient(135deg,#6c63ff,#b44fff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>MONEYGAME</h1>
        </div>
        <div className="card">
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            {(["login","register"] as const).map(m => (
              <button key={m} onClick={() => setMode(m)} style={{ flex: 1, padding: "10px", borderRadius: 10, fontWeight: 700, fontSize: 13, background: mode === m ? "var(--primary)" : "var(--bg3)", color: mode === m ? "white" : "var(--text2)", border: "1.5px solid var(--border)" }}>
                {m === "login" ? "Entrar" : "Cadastrar"}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {mode === "register" && <input placeholder="Seu nome" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />}
            <input type="email" placeholder="E-mail" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            <input type="password" placeholder="Senha" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} onKeyDown={e => e.key === "Enter" && submit()} />
            {error && <p style={{ color: "var(--red)", fontSize: 13, textAlign: "center" }}>{error}</p>}
            <button className="btn-primary" onClick={submit} disabled={loading} style={{ width: "100%", marginTop: 4 }}>
              {loading ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}
            </button>
            <button className="btn-ghost" onClick={() => setMode("intro")} style={{ width: "100%", fontSize: 12 }}>← Voltar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState<User | null>(() => { try { return JSON.parse(sessionStorage.getItem("mg_user") || "null"); } catch { return null; } });
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [tab, setTab] = useState("dashboard");
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [cc, setCC] = useState<CC[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [salary, setSalary] = useState(2300);
  const [xp, setXp] = useState(0);
  const [level, setLevel] = useState("iniciante");
  const [levelNum, setLevelNum] = useState(1);
  const [streakDays, setStreakDays] = useState(0);
  const [streakClaimed, setStreakClaimed] = useState(false);
  const [toast, setToast] = useState("");
  const [showAddExp, setShowAddExp] = useState(false);
  const [showAddCC, setShowAddCC] = useState(false);
  const [showAddIncome, setShowAddIncome] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showMethodology, setShowMethodology] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [showStreak, setShowStreak] = useState(false);

  const showToast = (msg: string) => setToast(msg);

  const gainXp = useCallback(async (action: string) => {
    if (!user) return;
    const xpGain = XP_REWARDS[action] || 10;
    try {
      const res = await fetch(`${API}/users/${user.id}/xp`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ xpGain }) });
      const data = await res.json();
      setXp(data.xp); setLevelNum(data.levelNum); setLevel(data.level);
      showToast(`+${xpGain} XP ⚔️`);
    } catch {}
  }, [user]);

  const login = (u: User) => {
    sessionStorage.setItem("mg_user", JSON.stringify(u));
    setUser(u);
    if (u.salaryBase) setSalary(num(u.salaryBase));
    if (u.xp) setXp(u.xp);
    if (u.levelNum) setLevelNum(u.levelNum);
    if (u.level) setLevel(u.level);
    if (u.streakDays) setStreakDays(u.streakDays);
    if (u.isNewUser) setShowOnboarding(true);
    // Verificar se streak foi claimed hoje
    if (u.lastCheckin) {
      const today = new Date(); today.setHours(0,0,0,0);
      const last = new Date(u.lastCheckin); last.setHours(0,0,0,0);
      setStreakClaimed(last.getTime() === today.getTime());
    }
  };

  const logout = () => { sessionStorage.removeItem("mg_user"); setUser(null); };

  const load = useCallback(async () => {
    if (!user) return;
    const [e, c, i] = await Promise.all([
      fetch(`${API}/users/${user.id}/expenses`).then(r => r.json()),
      fetch(`${API}/users/${user.id}/credit-card`).then(r => r.json()),
      fetch(`${API}/users/${user.id}/extra-income`).then(r => r.json()),
    ]);
    setExpenses(Array.isArray(e) ? e : []);
    setCC(Array.isArray(c) ? c : []);
    setIncomes(Array.isArray(i) ? i : []);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!expenses.length) return;
    const today = new Date();
    const dueSoon = expenses.filter(e => {
      if (!e.dueDate || e.paid) return false;
      const diff = Math.ceil((new Date(e.dueDate).getTime() - today.getTime()) / 86400000);
      return diff >= 0 && diff <= 3;
    });
    if (dueSoon.length > 0) setTimeout(() => showToast(`⚠️ ${dueSoon.length} conta(s) vencem em breve!`), 1500);
  }, [expenses]);

  if (!user) return <Auth onLogin={login} />;
  if (showOnboarding) return <Onboarding user={user} onDone={() => { setShowOnboarding(false); load(); }} />;

  // ── CÁLCULOS ─────────────────────────────────────────────────────────────
  const SONHO_ID = 6; // categoria Sonho não entra no saldo livre
  const totalExp = expenses.reduce((s, e) => s + num(e.amount), 0);
  const totalCC = cc.reduce((s, c) => s + num(c.amount), 0);
  const totalIncome = incomes.reduce((s, i) => s + num(i.amount), 0);
  const totalPaid = expenses.filter(e => e.paid && e.categoryId !== SONHO_ID).reduce((s, e) => s + num(e.amount), 0) + totalCC;
  const totalExpSemSonho = expenses.filter(e => e.categoryId !== SONHO_ID).reduce((s, e) => s + num(e.amount), 0);
  const totalPending = totalExpSemSonho + totalCC - totalPaid;
  const balance = salary + totalIncome - totalExpSemSonho - totalCC; // Sonho não entra, CC entra
  const extraNeeded = Math.max(0, totalExpSemSonho + totalCC - salary);
  const sonhoTotal = expenses.filter(e => e.categoryId === SONHO_ID).reduce((s, e) => s + num(e.amount), 0);
  const sonhoPago = expenses.filter(e => e.categoryId === SONHO_ID && e.paid).length > 0;
  const byCategory = CATS.map(cat => ({ ...cat, items: expenses.filter(e => e.categoryId === cat.id), total: expenses.filter(e => e.categoryId === cat.id).reduce((s, e) => s + num(e.amount), 0) }));

  // Frase contextual do dashboard (ausência ou saldo)
  const dashPhrase = rnd(ABSENT_PHRASES); // simplificado — em produção verificar lastCheckin

  const NAV = [
    { id: "dashboard", icon: "📊", label: "Dashboard" },
    { id: "expenses",  icon: "💸", label: "Despesas" },
    { id: "credit",    icon: "💳", label: "Cartão" },
    { id: "income",    icon: "💵", label: "Renda Extra" },
    { id: "reports",   icon: "📈", label: "Relatórios" },
  ];

  return (
    <div style={{ minHeight: "100vh", paddingBottom: 80 }}>
      {toast && <Toast msg={toast} onDone={() => setToast("")} />}
      {showStreak && user && (
        <StreakModal user={user} onClose={() => setShowStreak(false)} onClaim={(data) => {
          setXp(data.xp); setLevelNum(data.levelNum); setLevel(data.level);
          setStreakDays(data.streakDays); setStreakClaimed(true);
          showToast(`+${data.xpGained} XP 🔥 Streak: ${data.streakDays} dias!`);
        }} />
      )}

      {/* HEADER */}
      <header style={{ background: "var(--bg2)", borderBottom: "1px solid var(--border)", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 900, fontFamily: "var(--font-display)", background: "linear-gradient(135deg,#6c63ff,#b44fff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", display: "flex", alignItems: "center", gap: 6 }}><CoinIcon size={22}/> MONEYGAME</div>
          <div style={{ fontSize: 11, color: "var(--text2)" }}>Olá, {user.name?.split(" ")[0]}! ⚔️ {level === 'avancado' ? 'AVANÇADO' : 'INICIANTE'} NV.{levelNum}</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setShowMethodology(true)} style={{ background: "var(--bg3)", border: "1px solid var(--border)", color: "var(--text2)", padding: "8px 12px", borderRadius: 10, fontSize: 12 }}>📚</button>
          <button onClick={() => setShowSettings(true)} style={{ background: "var(--bg3)", border: "1px solid var(--border)", color: "var(--text2)", padding: "8px 12px", borderRadius: 10, fontSize: 12 }}>⚙️</button>
          <button onClick={logout} style={{ background: "var(--bg3)", border: "1px solid var(--border)", color: "var(--text2)", padding: "8px 12px", borderRadius: 10, fontSize: 12 }}>🚪</button>
        </div>
      </header>

      <main style={{ padding: "16px 16px 0" }}>
        <XPLevel xp={xp} level={level} levelNum={levelNum} />

        {/* DASHBOARD */}
        {tab === "dashboard" && (
          <div>
            {/* STREAK BUTTON */}
            <div onClick={() => setShowStreak(true)} style={{
              background: streakClaimed ? "rgba(0,214,143,0.05)" : "rgba(108,99,255,0.05)",
              border: `1px solid ${streakClaimed ? "rgba(0,214,143,0.3)" : "rgba(108,99,255,0.4)"}`,
              borderRadius: 14, padding: "14px 16px", marginBottom: 14, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ position: "relative" }}>
                  <span style={{ fontSize: 32 }}>{getStreakIcon(streakDays)}</span>
                  {streakDays > 0 && <span style={{ position: "absolute", bottom: -4, right: -6, background: "#6c63ff", color: "white", fontSize: 9, fontWeight: 900, padding: "1px 4px", borderRadius: 4 }}>{streakDays}</span>}
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "var(--text2)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>Streak Diária</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: streakClaimed ? "var(--green)" : "#6c63ff" }}>
                    {streakClaimed ? `✅ ${streakDays} dias · Volte amanhã` : `${streakDays} dias · Toque para resgatar`}
                  </div>
                </div>
              </div>
              {!streakClaimed && (
                <div style={{ background: "rgba(108,99,255,0.15)", border: "1px solid rgba(108,99,255,0.3)", color: "#a78bfa", fontSize: 12, fontWeight: 700, padding: "6px 12px", borderRadius: 8 }}>
                  +{getStreakXP(streakDays + 1)} XP
                </div>
              )}
            </div>

            {/* KPI GRID */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
              {[
                { label: "Salário Base",   value: fmt(salary),      color: "var(--primary)", icon: "💼" },
                { label: "Total Despesas", value: fmt(totalExpSemSonho + totalCC), color: "var(--red)",     icon: "💸" },
                { label: "Renda Extra",    value: fmt(totalIncome),  color: "var(--green)",   icon: "💵" },
                { label: "Saldo Livre",    value: fmt(balance),      color: balance >= 0 ? "var(--green)" : "var(--red)", icon: balance >= 0 ? "✅" : "⚠️" },
              ].map((k, i) => (
                <div key={i} style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 14, padding: "14px", borderTop: `3px solid ${k.color}` }}>
                  <div style={{ fontSize: 18, marginBottom: 4 }}>{k.icon}</div>
                  <div style={{ fontSize: 10, color: "var(--text2)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>{k.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: k.color, marginTop: 2 }}>{k.value}</div>
                </div>
              ))}
            </div>

            {/* CARTÃO DESTAQUE */}
            {totalCC > 0 && (
              <div style={{ background: "var(--bg2)", border: "1px solid rgba(255,183,3,0.3)", borderRadius: 14, padding: "14px 16px", marginBottom: 14, borderTop: "3px solid var(--yellow)", display: "flex", alignItems: "center", justifyContent: "space-between" }}
                onClick={() => setTab("credit")} >
                <div>
                  <div style={{ fontSize: 11, color: "var(--text2)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>💳 Fatura do Cartão</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: "var(--yellow)" }}>{fmt(totalCC)}</div>
                  <div style={{ fontSize: 11, color: "var(--text2)", marginTop: 2 }}>{cc.length} {cc.length === 1 ? "lançamento" : "lançamentos"} · Toque para ver</div>
                </div>
                <div style={{ fontSize: 36 }}>💳</div>
              </div>
            )}

            {/* SONHO — contador de meses */}
            {sonhoTotal > 0 && (
              <div style={{ background: "linear-gradient(135deg, rgba(6,182,212,0.08), rgba(139,92,246,0.08))", border: "1px solid rgba(6,182,212,0.3)", borderRadius: 14, padding: "14px 16px", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 28 }}>✨</span>
                  <div>
                    <div style={{ fontSize: 11, color: "#06b6d4", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>Investindo no seu Sonho</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text)", marginTop: 2 }}>{fmt(sonhoTotal)} este mês</div>
                    <div style={{ fontSize: 12, color: "var(--text2)", marginTop: 2 }}>
                      {sonhoPago ? "✅ Pago este mês — vitória! 🎉" : "Pendente · Você consegue!"}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STATUS DE PAGAMENTO (CC incluso, Sonho excluído) */}
            <div className="card" style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>📊 Status de Pagamento</div>
              <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                <div style={{ flex: 1, background: "rgba(0,214,143,.1)", border: "1px solid rgba(0,214,143,.2)", borderRadius: 10, padding: "10px", textAlign: "center" }}>
                  <div style={{ color: "var(--green)", fontSize: 16, fontWeight: 800 }}>{fmt(totalPaid)}</div>
                  <div style={{ color: "var(--text2)", fontSize: 10, marginTop: 2 }}>Pago</div>
                </div>
                <div style={{ flex: 1, background: "rgba(255,183,3,.1)", border: "1px solid rgba(255,183,3,.2)", borderRadius: 10, padding: "10px", textAlign: "center" }}>
                  <div style={{ color: "var(--yellow)", fontSize: 16, fontWeight: 800 }}>{fmt(totalPending)}</div>
                  <div style={{ color: "var(--text2)", fontSize: 10, marginTop: 2 }}>Pendente</div>
                </div>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${(totalExpSemSonho + totalCC) > 0 ? Math.min(totalPaid / (totalExpSemSonho + totalCC) * 100, 100) : 0}%`, background: "var(--green)" }} />
              </div>
            </div>

            {/* META RENDA EXTRA */}
            <div className="card" style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>🎯 Meta de Renda Extra</div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text2)", marginBottom: 6 }}>
                <span>Necessário: {fmt(extraNeeded)}</span><span>Ganhou: {fmt(totalIncome)}</span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${extraNeeded > 0 ? Math.min(totalIncome / extraNeeded * 100, 100) : 100}%`, background: "linear-gradient(90deg,var(--primary),var(--purple))" }} />
              </div>
              <div style={{ marginTop: 10, padding: "8px 12px", background: balance < 0 ? "rgba(255,77,106,.1)" : "rgba(0,214,143,.1)", borderRadius: 8, fontSize: 12, color: balance < 0 ? "var(--red)" : "var(--green)" }}>
                {balance < 0 ? `⚠️ ${rnd(ABSENT_PHRASES)}` : `✅ Saldo positivo de ${fmt(balance)}! Continue assim! 🔥`}
              </div>
            </div>

            {/* CATEGORIAS */}
            <div className="card" style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>📂 Por Categoria</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {byCategory.map(cat => (
                  <div key={cat.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 16, width: 24 }}>{cat.emoji}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 600 }}>
                        <span>{cat.name}</span>
                        <span style={{ color: cat.total > 0 ? "var(--text)" : "var(--text2)" }}>{fmt(cat.total)}</span>
                      </div>
                      <div className="progress-bar" style={{ marginTop: 4 }}>
                        <div className="progress-fill" style={{ width: `${totalExp > 0 ? Math.min(cat.total / totalExp * 100, 100) : 0}%`, background: cat.color }} />
                      </div>
                    </div>
                  </div>
                ))}
                {totalCC > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 16, width: 24 }}>💳</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 600 }}>
                        <span>Cartão de Crédito</span><span style={{ color: "var(--yellow)" }}>{fmt(totalCC)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* EXPENSES */}
        {tab === "expenses" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800 }}>💸 Despesas</h2>
              <button className="btn-primary" onClick={() => setShowAddExp(true)} style={{ padding: "10px 16px", fontSize: 13 }}>+ Adicionar</button>
            </div>
            {byCategory.map(cat => (
              <div key={cat.id} className="card" style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: cat.items.length ? 10 : 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 18 }}>{cat.emoji}</span>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{cat.name}</span>
                    <span style={{ fontSize: 10, background: "var(--bg3)", padding: "2px 8px", borderRadius: 20, color: "var(--text2)" }}>{cat.items.length}</span>
                  </div>
                  <span style={{ fontWeight: 800, fontSize: 14 }}>{fmt(cat.total)}</span>
                </div>
                {cat.items.map(exp => {
                  const isDueSoon = exp.dueDate && !exp.paid && (() => { const diff = Math.ceil((new Date(exp.dueDate!).getTime() - new Date().getTime()) / 86400000); return diff >= 0 && diff <= 3; })();
                  return (
                    <div key={exp.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "var(--bg3)", borderRadius: 10, marginBottom: 6, border: `1px solid ${isDueSoon ? "rgba(255,183,3,.4)" : "var(--border)"}` }}>
                      <input type="checkbox" checked={!!exp.paid} onChange={async () => {
                        await fetch(`${API}/expenses/${exp.id}/paid`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paid: !exp.paid }) });
                        if (!exp.paid) gainXp("payBill");
                        load();
                      }} style={{ width: 18, height: 18, accentColor: "var(--primary)", flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, textDecoration: exp.paid ? "line-through" : "none", color: exp.paid ? "var(--text2)" : "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{exp.name}</div>
                        <div style={{ fontSize: 10, color: isDueSoon ? "var(--yellow)" : "var(--text2)" }}>
                          {exp.subcategory && `${exp.subcategory} · `}
                          {exp.dueDate && `Vence: ${new Date(exp.dueDate).toLocaleDateString("pt-BR")}`}
                          {isDueSoon && " ⚠️"}{exp.recurring ? " 🔄" : ""}
                        </div>
                      </div>
                      <span style={{ fontWeight: 800, fontSize: 12, color: exp.paid ? "var(--green)" : "var(--yellow)", flexShrink: 0 }}>{fmt(num(exp.amount))}</span>
                      <button className="btn-danger" onClick={async () => { await fetch(`${API}/expenses/${exp.id}`, { method: "DELETE" }); load(); }} style={{ padding: "6px 10px", flexShrink: 0 }}>🗑</button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        {/* CREDIT */}
        {tab === "credit" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800 }}>💳 Cartão</h2>
              <button className="btn-primary" onClick={() => setShowAddCC(true)} style={{ padding: "10px 16px", fontSize: 13 }}>+ Adicionar</button>
            </div>
            <div className="card" style={{ marginBottom: 14, borderTop: "3px solid var(--yellow)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 10, color: "var(--text2)", fontWeight: 700, textTransform: "uppercase" }}>Total da Fatura</div>
                  <div style={{ fontSize: 28, fontWeight: 900, fontFamily: "var(--font-display)", fontVariantNumeric: "tabular-nums", color: "var(--yellow)" }}>{fmt(totalCC)}</div>
                  <div style={{ fontSize: 11, color: "var(--text2)", marginTop: 4 }}>Incluso no seu Saldo Livre</div>
                </div>
                <span style={{ fontSize: 40 }}>💳</span>
              </div>
            </div>
            {cc.length === 0 && <div className="card" style={{ textAlign: "center", color: "var(--text2)", padding: 40 }}>Nenhum gasto no cartão</div>}
            {cc.map(c => (
              <div key={c.id} className="card" style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{c.description}</div>
                  {c.subcategory && <div style={{ fontSize: 11, color: "var(--text2)" }}>{c.subcategory}</div>}
                </div>
                <span style={{ fontWeight: 800, color: "var(--yellow)" }}>{fmt(num(c.amount))}</span>
                <button className="btn-danger" onClick={async () => { await fetch(`${API}/credit-card/${c.id}`, { method: "DELETE" }); load(); }}>🗑</button>
              </div>
            ))}
          </div>
        )}

        {/* INCOME */}
        {tab === "income" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800 }}>💵 Renda Extra</h2>
              <button className="btn-primary" onClick={() => setShowAddIncome(true)} style={{ padding: "10px 16px", fontSize: 13 }}>+ Registrar</button>
            </div>
            <div className="card" style={{ marginBottom: 14, borderTop: "3px solid var(--green)" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 10, color: "var(--text2)", fontWeight: 700, textTransform: "uppercase" }}>Total Ganho</div>
                  <div style={{ fontSize: 28, fontWeight: 900, fontFamily: "var(--font-display)", fontVariantNumeric: "tabular-nums", color: "var(--green)" }}>{fmt(totalIncome)}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 10, color: "var(--text2)" }}>Meta necessária</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "var(--yellow)" }}>{fmt(extraNeeded)}</div>
                </div>
              </div>
              <div className="progress-bar" style={{ marginTop: 12 }}>
                <div className="progress-fill" style={{ width: `${extraNeeded > 0 ? Math.min(totalIncome / extraNeeded * 100, 100) : 100}%`, background: "linear-gradient(90deg,var(--green),var(--primary))" }} />
              </div>
            </div>
            {incomes.length === 0 && <div className="card" style={{ textAlign: "center", color: "var(--text2)", padding: 40 }}>Nenhuma renda extra registrada</div>}
            {incomes.map(inc => (
              <div key={inc.id} className="card" style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{inc.description}</div>
                  <div style={{ fontSize: 11, color: "var(--text2)" }}>{new Date(inc.date).toLocaleDateString("pt-BR")}</div>
                </div>
                <span style={{ fontWeight: 800, color: "var(--green)" }}>+{fmt(num(inc.amount))}</span>
                <button className="btn-danger" onClick={async () => { await fetch(`${API}/extra-income/${inc.id}`, { method: "DELETE" }); load(); }}>🗑</button>
              </div>
            ))}
          </div>
        )}

        {/* REPORTS */}
        {tab === "reports" && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 14 }}>📈 Relatórios</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
              {[
                { label: "Total Despesas",   value: fmt(totalExpSemSonho + totalCC), color: "var(--red)" },
                { label: "Renda Extra",       value: fmt(totalIncome),  color: "var(--green)" },
                { label: "Lançamentos",       value: String(expenses.length + cc.length), color: "var(--primary)" },
                { label: "XP do Mês",         value: String(xp) + " XP", color: "var(--yellow)" },
              ].map((k, i) => (
                <div key={i} className="card" style={{ borderTop: `3px solid ${k.color}` }}>
                  <div style={{ fontSize: 10, color: "var(--text2)", fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>{k.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: k.color }}>{k.value}</div>
                </div>
              ))}
            </div>
            <div className="card" style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>🏺 Distribuição por Pote</div>
              {byCategory.map(cat => (
                <div key={cat.id} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                    <span>{cat.emoji} {cat.name}</span>
                    <span style={{ fontWeight: 700 }}>{fmt(cat.total)} · {totalExpSemSonho > 0 ? Math.round(cat.total / (totalExpSemSonho) * 100) : 0}%</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${totalExpSemSonho > 0 ? Math.min(cat.total / totalExpSemSonho * 100, 100) : 0}%`, background: cat.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* BOTTOM NAV */}
      <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "var(--bg2)", borderTop: "1px solid var(--border)", display: "flex", zIndex: 50 }}>
        {NAV.map(n => (
          <button key={n.id} onClick={() => setTab(n.id)} style={{ flex: 1, padding: "10px 4px 8px", background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, color: tab === n.id ? "var(--primary)" : "var(--text2)", fontSize: tab === n.id ? 20 : 18, cursor: "pointer" }}>
            <span>{n.icon}</span>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.3 }}>{n.label}</span>
          </button>
        ))}
      </nav>

      {/* MODALS */}
      {showAddExp && <AddExpenseModal userId={user.id} onClose={() => { setShowAddExp(false); load(); }} onXp={() => gainXp("addExpense")} />}
      {showAddCC && <AddCCModal userId={user.id} onClose={() => { setShowAddCC(false); load(); }} onXp={() => gainXp("addCC")} />}
      {showAddIncome && <AddIncomeModal userId={user.id} onClose={() => { setShowAddIncome(false); load(); }} />}
      {showSettings && <SettingsModal user={user} salary={salary} onSave={(s: number) => { setSalary(s); setShowSettings(false); }} onClose={() => setShowSettings(false)} onReset={() => { setShowSettings(false); setShowReset(true); }} />}
      {showMethodology && <MethodologyModal onClose={() => setShowMethodology(false)} />}
      {showReset && <ResetModal userId={user.id} onClose={() => setShowReset(false)} onConfirm={() => { setShowReset(false); load(); }} />}
    </div>
  );
}

// ── MODALS ────────────────────────────────────────────────────────────────────
function AddExpenseModal({ userId, onClose, onXp }: any) {
  const [form, setForm] = useState({ categoryId: "4", name: "", amount: "", subcategory: "", dueDate: "", recurring: false });
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    if (!form.name || !form.amount) return;
    setLoading(true);
    await fetch(`${API}/users/${userId}/expenses`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, categoryId: parseInt(form.categoryId), amount: parseFloat(form.amount) }) });
    onXp(); setLoading(false); onClose();
  };
  return (
    <Modal title="💸 Nova Despesa" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <select value={form.categoryId} onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))}>
          {CATS.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
        </select>
        <input placeholder="Nome da despesa *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        <input type="number" placeholder="Valor (R$) *" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
        <input placeholder="Subcategoria (opcional)" value={form.subcategory} onChange={e => setForm(f => ({ ...f, subcategory: e.target.value }))} />
        <input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text2)" }}>
          <input type="checkbox" checked={form.recurring} onChange={e => setForm(f => ({ ...f, recurring: e.target.checked }))} />
          Despesa recorrente 🔄
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn-ghost" onClick={onClose} style={{ flex: 1 }}>Cancelar</button>
          <button className="btn-primary" onClick={submit} disabled={loading} style={{ flex: 1 }}>{loading ? "..." : "Adicionar"}</button>
        </div>
      </div>
    </Modal>
  );
}

function AddCCModal({ userId, onClose, onXp }: any) {
  const [form, setForm] = useState({ subcategory: "Outros", description: "", amount: "" });
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    if (!form.description || !form.amount) return;
    setLoading(true);
    await fetch(`${API}/users/${userId}/credit-card`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, amount: parseFloat(form.amount) }) });
    onXp(); setLoading(false); onClose();
  };
  return (
    <Modal title="💳 Gasto no Cartão" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <select value={form.subcategory} onChange={e => setForm(f => ({ ...f, subcategory: e.target.value }))}>
          {CC_CATS.map(c => <option key={c}>{c}</option>)}
        </select>
        <input placeholder="Descrição *" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
        <input type="number" placeholder="Valor (R$) *" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn-ghost" onClick={onClose} style={{ flex: 1 }}>Cancelar</button>
          <button className="btn-primary" onClick={submit} disabled={loading} style={{ flex: 1 }}>{loading ? "..." : "Adicionar"}</button>
        </div>
      </div>
    </Modal>
  );
}

function AddIncomeModal({ userId, onClose }: any) {
  const [form, setForm] = useState({ description: "", amount: "" });
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    if (!form.description || !form.amount) return;
    setLoading(true);
    await fetch(`${API}/users/${userId}/extra-income`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, amount: parseFloat(form.amount) }) });
    setLoading(false); onClose();
  };
  return (
    <Modal title="💵 Renda Extra" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <input placeholder="Descrição (ex: Freelance, Venda...) *" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
        <input type="number" placeholder="Valor (R$) *" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn-ghost" onClick={onClose} style={{ flex: 1 }}>Cancelar</button>
          <button className="btn-primary" onClick={submit} disabled={loading} style={{ flex: 1 }}>{loading ? "..." : "Registrar"}</button>
        </div>
      </div>
    </Modal>
  );
}

function SettingsModal({ user, salary, onSave, onClose, onReset }: any) {
  const [s, setS] = useState(String(salary));
  const [loading, setLoading] = useState(false);
  const save = async () => {
    setLoading(true);
    await fetch(`${API}/users/${user.id}/settings`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ salaryBase: s }) });
    onSave(parseFloat(s)); setLoading(false);
  };
  return (
    <Modal title="⚙️ Configurações" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label style={{ fontSize: 11, color: "var(--text2)", fontWeight: 700, display: "block", marginBottom: 6 }}>SALÁRIO BASE (R$)</label>
          <input type="number" value={s} onChange={e => setS(e.target.value)} />
        </div>
        <button className="btn-primary" onClick={save} disabled={loading} style={{ width: "100%" }}>{loading ? "Salvando..." : "Salvar"}</button>
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}>
          <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: 10 }}>⚠️ Zona de perigo</div>
          <button onClick={onReset} style={{ width: "100%", background: "rgba(255,77,106,.15)", color: "var(--red)", padding: "12px", borderRadius: 12, fontSize: 13, fontWeight: 700, border: "1px solid rgba(255,77,106,.3)" }}>
            🔄 Virar Mês (arquiva e limpa dados)
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ResetModal({ userId, onClose, onConfirm }: any) {
  const [loading, setLoading] = useState(false);
  const confirm = async () => {
    setLoading(true);
    await fetch(`${API}/users/${userId}/reset-month`, { method: "POST" });
    setLoading(false); onConfirm();
  };
  return (
    <Modal title="🔄 Virar o Mês" onClose={onClose}>
      <p style={{ color: "var(--text2)", fontSize: 14, marginBottom: 20, lineHeight: 1.6 }}>
        Os dados do mês atual serão <strong style={{ color: "var(--green)" }}>arquivados</strong> e você começa um mês limpo. Seu histórico fica salvo.
      </p>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn-ghost" onClick={onClose} style={{ flex: 1 }}>Cancelar</button>
        <button onClick={confirm} disabled={loading} style={{ flex: 1, background: "var(--primary)", color: "white", padding: "12px", borderRadius: 12, fontSize: 14, fontWeight: 700 }}>
          {loading ? "Arquivando..." : "Confirmar"}
        </button>
      </div>
    </Modal>
  );
}

function MethodologyModal({ onClose }: any) {
  const POTES = [
    { cat: "Pagar-se", pct: "5-10%", color: "#6c63ff", emoji: "💆", desc: "Invista em você mesmo. Um presente, um passeio, um momento de prazer." },
    { cat: "Doar/Ajudar", pct: "5-10%", color: "#ff6b9d", emoji: "💝", desc: "Generosidade quebra a mentalidade de escassez e cria energia de abundância." },
    { cat: "Investir", pct: "5-10%", color: "#00d68f", emoji: "📈", desc: "Construa patrimônio. Quanto mais cedo começa, mais os juros compostos trabalham." },
    { cat: "Contas", pct: "60-70%", color: "#ffb703", emoji: "📋", desc: "Suas obrigações mensais. Aprenda a viver bem gastando menos." },
    { cat: "Sonho", pct: "5-10%", color: "#8b5cf6", emoji: "✨", desc: "Seu objetivo motivador. Transforma controle financeiro em aventura." },
    { cat: "Abundar", pct: "5-10%", color: "#f97316", emoji: "🌟", desc: "Os luxos da vida. Restaurante melhor, hobby, experiências." },
  ];
  return (
    <Modal title="📚 Metodologia dos 6 Potes" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ background: "var(--bg3)", borderRadius: 12, padding: 14, fontSize: 13, color: "var(--text2)", lineHeight: 1.6 }}>
          A metodologia dos 6 Potes da Riqueza propõe que riqueza é um estado mental baseado em inteligência emocional. A chave está em como você distribui o que ganha.
        </div>
        {POTES.map((p, i) => (
          <div key={i} style={{ display: "flex", gap: 12, padding: "10px 12px", background: "var(--bg3)", borderRadius: 12, borderLeft: `3px solid ${p.color}` }}>
            <span style={{ fontSize: 22, flexShrink: 0 }}>{p.emoji}</span>
            <div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                <span style={{ fontWeight: 700, fontSize: 13 }}>{p.cat}</span>
                <span style={{ fontSize: 11, color: p.color, fontWeight: 700 }}>{p.pct}</span>
              </div>
              <div style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.5 }}>{p.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
