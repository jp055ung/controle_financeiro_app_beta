import { useState, useEffect, useCallback } from "react";

const API = "/api";
const fmt = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
const num = (s: any) => parseFloat(String(s || 0));

type User = { id: number; name: string; email: string; salaryBase?: string; reserveMeta?: string; xp?: number; level?: string; levelNum?: number; positiveMonths?: number };
type Expense = { id: number; categoryId: number; name: string; amount: string; subcategory?: string; paid: number; dueDate?: string; recurring?: number };
type CC = { id: number; description: string; amount: string; subcategory?: string };
type Income = { id: number; description: string; amount: string; date: string };

const CATS = [
  { id: 1, name: "Pagar-se", emoji: "💆", color: "#6c63ff", desc: "Invista em você mesmo" },
  { id: 2, name: "Doar/Ajudar", emoji: "💝", color: "#ff6b9d", desc: "Generosidade gera abundância" },
  { id: 3, name: "Investir", emoji: "📈", color: "#00d68f", desc: "Construa seu patrimônio" },
  { id: 4, name: "Contas", emoji: "📋", color: "#ffb703", desc: "Suas obrigações mensais" },
  { id: 5, name: "Objetivo", emoji: "🎯", color: "#8b5cf6", desc: "Seu sonho de curto prazo" },
  { id: 6, name: "Sonho", emoji: "✨", color: "#06b6d4", desc: "Sua meta de longo prazo" },
  { id: 7, name: "Abundar", emoji: "🌟", color: "#f97316", desc: "Aproveite a vida" },
  { id: 8, name: "Gastos Variáveis", emoji: "🛒", color: "#ef4444", desc: "Gastos do dia a dia" },
];
const CC_CATS = ["Comida","Roupas","Gasolina","Transporte","Saúde","Streaming","Outros"];

const JULIO_QUOTES = [
  "Por que eu vou sair pra relaxar se eu posso relaxar em casa que é grátis? 🏠",
  "Se eu não comprar nada, o desconto é maior! 😂",
  "A diferença entre o duro e o pão duro é que um faz de tudo pra não gastar nada... e o outro não faz nada porque já gastou tudo! 💸",
  "Sorte de hoje: Não me torra que não sou pão duro. 🍞",
  "Você precisa criar sua própria sorte. O sucesso vem de oportunidade e preparação! 💪",
];

const XP_REWARDS: Record<string, number> = {
  addExpense: 10, addIncome: 25, payBill: 50, addCC: 10,
};

function XPLevel({ xp, level, levelNum }: { xp: number; level: string; levelNum: number }) {
  const xpPerLevel = 100;
  const currentLevelXp = xp % xpPerLevel;
  const pct = Math.round((currentLevelXp / xpPerLevel) * 100);
  const levelLabel = level === 'avancado' ? 'AVANÇADO' : 'INICIANTE';
  const color = level === 'avancado' ? '#ffd700' : '#6c63ff';
  return (
    <div style={{ background: "var(--bg3)", borderRadius: 14, padding: "12px 16px", marginBottom: 16, border: "1px solid var(--border)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 800, color, letterSpacing: 1 }}>⚔️ {levelLabel} NV.{levelNum}</span>
        <span style={{ fontSize: 11, color: "var(--text2)" }}>{currentLevelXp}/{xpPerLevel} XP · {pct}%</span>
      </div>
      <div className="xp-bar-wrap">
        <div className="xp-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <div style={{ fontSize: 10, color: "var(--text2)", marginTop: 4 }}>Total: {xp} XP acumulado</div>
    </div>
  );
}

function Toast({ msg, onDone }: { msg: string; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 2500); return () => clearTimeout(t); }, []);
  return <div className="toast">{msg}</div>;
}

// ─── AUTH ────────────────────────────────────────────────────────────────────
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
      <div style={{ fontSize: 64, marginBottom: 16 }}>🪙</div>
      <h1 style={{ fontSize: 36, fontWeight: 900, background: "linear-gradient(135deg,#6c63ff,#b44fff,#ffd700)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: 8 }}>MONEYGAME</h1>
      <p style={{ color: "var(--text2)", fontSize: 15, marginBottom: 32, maxWidth: 320 }}>Gamifique seu controle financeiro com a metodologia de Paulo Vieira</p>

      <div style={{ width: "100%", maxWidth: 360, display: "flex", flexDirection: "column", gap: 12, marginBottom: 40 }}>
        {[
          { emoji: "⚔️", title: "Suba de Nível", desc: "Ganhe XP a cada ação financeira e evolua de Iniciante a Avançado" },
          { emoji: "🏆", title: "Metodologia Provada", desc: "6 potes de riqueza baseados no método de Paulo Vieira" },
          { emoji: "📊", title: "Relatórios Visuais", desc: "Gráficos de evolução e distribuição de gastos" },
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
          <div style={{ fontSize: 40, marginBottom: 8 }}>🪙</div>
          <h1 style={{ fontSize: 24, fontWeight: 900, background: "linear-gradient(135deg,#6c63ff,#b44fff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>MONEYGAME</h1>
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

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState<User | null>(() => { try { return JSON.parse(sessionStorage.getItem("mg_user") || "null"); } catch { return null; } });
  const [tab, setTab] = useState("dashboard");
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [cc, setCC] = useState<CC[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [salary, setSalary] = useState(2300);
  const [xp, setXp] = useState(0);
  const [level, setLevel] = useState("iniciante");
  const [levelNum, setLevelNum] = useState(1);
  const [toast, setToast] = useState("");
  const [showAddExp, setShowAddExp] = useState(false);
  const [showAddCC, setShowAddCC] = useState(false);
  const [showAddIncome, setShowAddIncome] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showMethodology, setShowMethodology] = useState(false);
  const [showReports, setShowReports] = useState(false);
  const [showReset, setShowReset] = useState(false);

  const showToast = (msg: string) => setToast(msg);

  const gainXp = useCallback(async (action: string) => {
    if (!user) return;
    const xpGain = XP_REWARDS[action] || 10;
    try {
      const res = await fetch(`${API}/users/${user.id}/xp`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ xpGain }) });
      const data = await res.json();
      setXp(data.xp);
      setLevelNum(data.levelNum);
      setLevel(data.level);
      const u = { ...user, xp: data.xp, levelNum: data.levelNum, level: data.level };
      sessionStorage.setItem("mg_user", JSON.stringify(u));
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

  // Check vencimentos hoje
  useEffect(() => {
    if (!expenses.length) return;
    const today = new Date();
    const dueSoon = expenses.filter(e => {
      if (!e.dueDate || e.paid) return false;
      const due = new Date(e.dueDate);
      const diff = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return diff >= 0 && diff <= 3;
    });
    if (dueSoon.length > 0) {
      setTimeout(() => showToast(`⚠️ ${dueSoon.length} conta(s) vencem em breve!`), 1500);
    }
  }, [expenses]);

  if (!user) return <Auth onLogin={login} />;

  const totalExp = expenses.reduce((s, e) => s + num(e.amount), 0);
  const totalCC = cc.reduce((s, c) => s + num(c.amount), 0);
  const totalIncome = incomes.reduce((s, i) => s + num(i.amount), 0);
  const totalPaid = expenses.filter(e => e.paid).reduce((s, e) => s + num(e.amount), 0);
  const totalPending = totalExp - totalPaid;
  const totalAll = totalExp + totalCC;
  const balance = salary + totalIncome - totalAll;
  const extraNeeded = Math.max(0, totalAll - salary);
  const byCategory = CATS.map(cat => ({ ...cat, items: expenses.filter(e => e.categoryId === cat.id), total: expenses.filter(e => e.categoryId === cat.id).reduce((s, e) => s + num(e.amount), 0) }));

  const julio = JULIO_QUOTES[Math.floor(Math.random() * JULIO_QUOTES.length)];

  const NAV = [
    { id: "dashboard", icon: "📊", label: "Dashboard" },
    { id: "expenses", icon: "💸", label: "Despesas" },
    { id: "credit", icon: "💳", label: "Cartão" },
    { id: "income", icon: "💵", label: "Renda Extra" },
    { id: "reports", icon: "📈", label: "Relatórios" },
  ];

  return (
    <div style={{ minHeight: "100vh", paddingBottom: 80 }}>
      {toast && <Toast msg={toast} onDone={() => setToast("")} />}

      {/* HEADER */}
      <header style={{ background: "var(--bg2)", borderBottom: "1px solid var(--border)", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 900, background: "linear-gradient(135deg,#6c63ff,#b44fff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>🪙 MONEYGAME</div>
          <div style={{ fontSize: 11, color: "var(--text2)" }}>Olá, {user.name?.split(" ")[0]}! ⚔️ {level === 'avancado' ? 'AVANÇADO' : 'INICIANTE'} NV.{levelNum}</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setShowMethodology(true)} style={{ background: "var(--bg3)", border: "1px solid var(--border)", color: "var(--text2)", padding: "8px 12px", borderRadius: 10, fontSize: 12 }}>📚</button>
          <button onClick={() => setShowSettings(true)} style={{ background: "var(--bg3)", border: "1px solid var(--border)", color: "var(--text2)", padding: "8px 12px", borderRadius: 10, fontSize: 12 }}>⚙️</button>
          <button onClick={logout} style={{ background: "var(--bg3)", border: "1px solid var(--border)", color: "var(--text2)", padding: "8px 12px", borderRadius: 10, fontSize: 12 }}>🚪</button>
        </div>
      </header>

      {/* CONTENT */}
      <main style={{ padding: "16px 16px 0" }}>

        {/* XP BAR — sempre visível */}
        <XPLevel xp={xp} level={level} levelNum={levelNum} />

        {/* DASHBOARD */}
        {tab === "dashboard" && (
          <div>
            {/* KPI */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
              {[
                { label: "Salário Base", value: fmt(salary), color: "var(--primary)", icon: "💼" },
                { label: "Total Despesas", value: fmt(totalAll), color: "var(--red)", icon: "💸" },
                { label: "Renda Extra", value: fmt(totalIncome), color: "var(--green)", icon: "💵" },
                { label: "Saldo Livre", value: fmt(balance), color: balance >= 0 ? "var(--green)" : "var(--red)", icon: balance >= 0 ? "✅" : "⚠️" },
              ].map((k, i) => (
                <div key={i} style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 14, padding: "14px", borderTop: `3px solid ${k.color}` }}>
                  <div style={{ fontSize: 18, marginBottom: 4 }}>{k.icon}</div>
                  <div style={{ fontSize: 10, color: "var(--text2)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>{k.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: k.color, marginTop: 2 }}>{k.value}</div>
                </div>
              ))}
            </div>

            {/* Status */}
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
                <div className="progress-fill" style={{ width: `${totalExp > 0 ? Math.min(totalPaid / totalExp * 100, 100) : 0}%`, background: "var(--green)" }} />
              </div>
            </div>

            {/* Meta renda extra */}
            <div className="card" style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>🎯 Meta de Renda Extra</div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text2)", marginBottom: 6 }}>
                <span>Necessário: {fmt(extraNeeded)}</span><span>Ganhou: {fmt(totalIncome)}</span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${extraNeeded > 0 ? Math.min(totalIncome / extraNeeded * 100, 100) : 100}%`, background: "linear-gradient(90deg,var(--primary),var(--purple))" }} />
              </div>
              <div style={{ marginTop: 10, padding: "8px 12px", background: balance < 0 ? "rgba(255,77,106,.1)" : "rgba(0,214,143,.1)", borderRadius: 8, fontSize: 12, color: balance < 0 ? "var(--red)" : "var(--green)" }}>
                {balance < 0 ? `⚠️ ${julio}` : `✅ Saldo positivo de ${fmt(balance)}! Continue assim! 🔥`}
              </div>
            </div>

            {/* Categorias */}
            <div className="card" style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>📂 Por Categoria</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {byCategory.map(cat => (
                  <div key={cat.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 16, width: 24 }}>{cat.emoji}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 600 }}>
                        <span>{cat.name}</span><span style={{ color: cat.total > 0 ? "var(--text)" : "var(--text2)" }}>{fmt(cat.total)}</span>
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
                        <span>Cartão de Crédito</span><span style={{ color: "var(--red)" }}>{fmt(totalCC)}</span>
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
                          {isDueSoon && " ⚠️"}
                          {exp.recurring ? " 🔄" : ""}
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
            <div className="card" style={{ marginBottom: 14, borderTop: "3px solid var(--red)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 10, color: "var(--text2)", fontWeight: 700, textTransform: "uppercase" }}>Total da Fatura</div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: "var(--red)" }}>{fmt(totalCC)}</div>
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
                <span style={{ fontWeight: 800, color: "var(--red)" }}>{fmt(num(c.amount))}</span>
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
                  <div style={{ fontSize: 28, fontWeight: 900, color: "var(--green)" }}>{fmt(totalIncome)}</div>
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
            <div className="card" style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>🍕 Distribuição por Categoria</div>
              {byCategory.filter(c => c.total > 0).map(cat => {
                const pct = totalAll > 0 ? Math.round(cat.total / totalAll * 100) : 0;
                return (
                  <div key={cat.id} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                      <span>{cat.emoji} {cat.name}</span>
                      <span style={{ fontWeight: 700 }}>{pct}% · {fmt(cat.total)}</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${pct}%`, background: cat.color }} />
                    </div>
                  </div>
                );
              })}
              {totalCC > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                    <span>💳 Cartão</span>
                    <span style={{ fontWeight: 700 }}>{totalAll > 0 ? Math.round(totalCC / totalAll * 100) : 0}% · {fmt(totalCC)}</span>
                  </div>
                  <div className="progress-bar"><div className="progress-fill" style={{ width: `${totalAll > 0 ? Math.round(totalCC / totalAll * 100) : 0}%`, background: "var(--red)" }} /></div>
                </div>
              )}
            </div>

            <div className="card" style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>💰 Resumo Financeiro</div>
              {[
                { label: "Receita Total", value: salary + totalIncome, color: "var(--green)" },
                { label: "Total Despesas", value: totalAll, color: "var(--red)" },
                { label: "Total Pago", value: totalPaid, color: "var(--green)" },
                { label: "Total Pendente", value: totalPending + totalCC, color: "var(--yellow)" },
                { label: "Saldo Final", value: balance, color: balance >= 0 ? "var(--green)" : "var(--red)" },
              ].map((item, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: i < 4 ? "1px solid var(--border)" : "none" }}>
                  <span style={{ fontSize: 13, color: "var(--text2)" }}>{item.label}</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: item.color }}>{fmt(item.value)}</span>
                </div>
              ))}
            </div>

            <div className="card" style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>📊 Meta Paulo Vieira vs Realidade</div>
              {[
                { cat: "Pagar-se", rec: 10, real: totalAll > 0 ? Math.round(byCategory[0].total / (salary || 1) * 100) : 0 },
                { cat: "Investir", rec: 10, real: totalAll > 0 ? Math.round(byCategory[2].total / (salary || 1) * 100) : 0 },
                { cat: "Contas", rec: 60, real: totalAll > 0 ? Math.round(byCategory[3].total / (salary || 1) * 100) : 0 },
                { cat: "Sonho", rec: 10, real: totalAll > 0 ? Math.round(byCategory[5].total / (salary || 1) * 100) : 0 },
              ].map((item, i) => (
                <div key={i} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
                    <span style={{ color: "var(--text2)" }}>{item.cat}</span>
                    <span><span style={{ color: "var(--primary)", fontWeight: 700 }}>Rec: {item.rec}%</span> · <span style={{ color: item.real <= item.rec + 5 ? "var(--green)" : "var(--red)", fontWeight: 700 }}>Real: {item.real}%</span></span>
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <div style={{ flex: item.rec, height: 6, background: "var(--primary)", borderRadius: 3, opacity: .5 }} />
                    <div style={{ flex: 100 - item.rec, height: 6, background: "var(--border)", borderRadius: 3 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* BOTTOM NAV */}
      <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "var(--bg2)", borderTop: "1px solid var(--border)", display: "flex", zIndex: 50 }}>
        {NAV.map(item => (
          <button key={item.id} onClick={() => setTab(item.id)}
            style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "10px 4px", background: "transparent", borderRadius: 0,
              color: tab === item.id ? "var(--primary-light)" : "var(--text2)", fontSize: 10, fontWeight: tab === item.id ? 700 : 400, gap: 3,
              borderTop: tab === item.id ? "2px solid var(--primary)" : "2px solid transparent" }}>
            <span style={{ fontSize: 20 }}>{item.icon}</span>{item.label}
          </button>
        ))}
      </nav>

      {/* MODALS */}
      {showAddExp && <AddExpModal userId={user.id} onClose={() => { setShowAddExp(false); load(); gainXp("addExpense"); }} />}
      {showAddCC && <AddCCModal userId={user.id} onClose={() => { setShowAddCC(false); load(); gainXp("addCC"); }} />}
      {showAddIncome && <AddIncomeModal userId={user.id} onClose={() => { setShowAddIncome(false); load(); gainXp("addIncome"); }} />}
      {showSettings && <SettingsModal user={user} salary={salary} onSave={(s) => { setSalary(s); setShowSettings(false); }} onClose={() => setShowSettings(false)} onReset={() => { setShowSettings(false); setShowReset(true); }} />}
      {showMethodology && <MethodologyModal onClose={() => setShowMethodology(false)} />}
      {showReset && <ResetModal userId={user.id} onClose={() => setShowReset(false)} onConfirm={() => { setShowReset(false); load(); showToast("🔄 Mês resetado!"); }} />}
    </div>
  );
}

function Modal({ title, children, onClose }: any) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ fontWeight: 800, fontSize: 16 }}>{title}</h3>
          <button onClick={onClose} style={{ background: "var(--bg3)", color: "var(--text2)", padding: "6px 10px", borderRadius: 8, fontSize: 16 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function AddExpModal({ userId, onClose }: any) {
  const [form, setForm] = useState({ categoryId: 1, name: "", amount: "", subcategory: "", dueDate: "", recurring: false });
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    if (!form.name || !form.amount) return;
    setLoading(true);
    await fetch(`${API}/users/${userId}/expenses`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, amount: parseFloat(form.amount) }) });
    setLoading(false); onClose();
  };
  return (
    <Modal title="💸 Nova Despesa" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <select value={form.categoryId} onChange={e => setForm(f => ({ ...f, categoryId: Number(e.target.value) }))}>
          {CATS.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
        </select>
        <input placeholder="Nome da despesa" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        <input placeholder="Subcategoria (opcional)" value={form.subcategory} onChange={e => setForm(f => ({ ...f, subcategory: e.target.value }))} />
        <input type="number" placeholder="Valor (R$)" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
        <div>
          <label style={{ fontSize: 11, color: "var(--text2)", fontWeight: 600, display: "block", marginBottom: 6 }}>DATA DE VENCIMENTO</label>
          <input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
          <input type="checkbox" checked={form.recurring} onChange={e => setForm(f => ({ ...f, recurring: e.target.checked }))} style={{ width: "auto" }} />
          🔄 Despesa recorrente (mensal)
        </label>
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <button className="btn-ghost" onClick={onClose} style={{ flex: 1 }}>Cancelar</button>
          <button className="btn-primary" onClick={submit} disabled={loading} style={{ flex: 1 }}>{loading ? "..." : "Adicionar"}</button>
        </div>
      </div>
    </Modal>
  );
}

function AddCCModal({ userId, onClose }: any) {
  const [form, setForm] = useState({ description: "", amount: "", subcategory: CC_CATS[0] });
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    if (!form.description || !form.amount) return;
    setLoading(true);
    await fetch(`${API}/users/${userId}/credit-card`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, amount: parseFloat(form.amount) }) });
    setLoading(false); onClose();
  };
  return (
    <Modal title="💳 Gasto no Cartão" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <select value={form.subcategory} onChange={e => setForm(f => ({ ...f, subcategory: e.target.value }))}>
          {CC_CATS.map(c => <option key={c}>{c}</option>)}
        </select>
        <input placeholder="Descrição" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
        <input type="number" placeholder="Valor (R$)" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
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
        <input placeholder="Descrição (ex: Freelance, Venda...)" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
        <input type="number" placeholder="Valor (R$)" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
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
            🔄 Resetar Mês (apaga todos os dados do mês atual)
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
    <Modal title="🔄 Resetar Mês" onClose={onClose}>
      <p style={{ color: "var(--text2)", fontSize: 14, marginBottom: 20, lineHeight: 1.6 }}>
        Isso vai apagar <strong style={{ color: "var(--red)" }}>todas as despesas, cartão e renda extra</strong> do mês atual. Esta ação não pode ser desfeita.
      </p>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn-ghost" onClick={onClose} style={{ flex: 1 }}>Cancelar</button>
        <button onClick={confirm} disabled={loading} style={{ flex: 1, background: "var(--red)", color: "white", padding: "12px", borderRadius: 12, fontSize: 14, fontWeight: 700 }}>
          {loading ? "Resetando..." : "Confirmar Reset"}
        </button>
      </div>
    </Modal>
  );
}

function MethodologyModal({ onClose }: any) {
  const POTES_INICIANTE = [
    { cat: "Pagar-se", pct: "5-10%", color: "#6c63ff", emoji: "💆", desc: "Invista em você mesmo. Um presente, um passeio, um momento de prazer. Você merece!" },
    { cat: "Doar/Ajudar", pct: "5-10%", color: "#ff6b9d", emoji: "💝", desc: "Generosidade quebra a mentalidade de escassez e cria uma energia de abundância." },
    { cat: "Investir", pct: "5-10%", color: "#00d68f", emoji: "📈", desc: "Construa patrimônio. Quanto mais cedo começa, mais os juros compostos trabalham para você." },
    { cat: "Contas", pct: "60-70%", color: "#ffb703", emoji: "📋", desc: "Suas obrigações mensais. A maioria usa 100% aqui — aprenda a viver bem gastando menos." },
    { cat: "Sonho", pct: "5-10%", color: "#8b5cf6", emoji: "✨", desc: "Seu objetivo motivador: viagem, casa, carro. Transforma controle financeiro em aventura." },
    { cat: "Abundar", pct: "5-10%", color: "#f97316", emoji: "🌟", desc: "Os luxos da vida. Restaurante melhor, hobby, experiências. Abundância é saber aproveitar." },
  ];
  return (
    <Modal title="📚 Metodologia Paulo Vieira" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ background: "var(--bg3)", borderRadius: 12, padding: 14, fontSize: 13, color: "var(--text2)", lineHeight: 1.6 }}>
          A metodologia de Criação de Riqueza de Paulo Vieira propõe que <strong style={{ color: "var(--text)" }}>riqueza é um estado mental</strong> baseado em inteligência emocional. A chave está em como você distribui o que ganha nos <strong style={{ color: "var(--primary)" }}>6 Potes da Riqueza</strong>.
        </div>
        <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text2)", textTransform: "uppercase", letterSpacing: 1 }}>🌱 Nível Iniciante</div>
        {POTES_INICIANTE.map((p, i) => (
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
        <div style={{ background: "rgba(255,215,0,.1)", border: "1px solid rgba(255,215,0,.2)", borderRadius: 12, padding: 14, fontSize: 12, color: "var(--text2)", lineHeight: 1.6 }}>
          🏆 <strong style={{ color: "var(--gold)" }}>Nível Avançado</strong> — desbloqueado quando você mantém saldo positivo acima de R$1.000 por 3 meses seguidos. O foco muda para multiplicar riqueza através de investimentos!
        </div>
      </div>
    </Modal>
  );
}
