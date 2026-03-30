import { useState, useEffect, useCallback } from "react";

// Logo MoneyGame — fundo roxo #820AD1 estilo Nubank com emoji 💸
function CoinIcon({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="100" height="100" rx="24" ry="24" fill="#820AD1"/>
      <text x="50" y="72" fontSize="56" textAnchor="middle" fontFamily="Segoe UI Emoji,Apple Color Emoji,Noto Color Emoji,sans-serif">💸</text>
    </svg>
  );
}

const API = "/api";
const fmt = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
const num = (s: any) => parseFloat(String(s || 0)) || 0;

// ── TOKEN STORAGE ─────────────────────────────────────────────────────────────
function getToken(): string { return sessionStorage.getItem("mg_token") || ""; }
function authHeaders(): Record<string,string> {
  const t = getToken();
  return t ? { "Content-Type": "application/json", "Authorization": `Bearer ${t}` } : { "Content-Type": "application/json" };
}
async function apiFetch(url: string, opts: RequestInit = {}): Promise<Response> {
  const headers = { ...authHeaders(), ...(opts.headers as any || {}) };
  return fetch(url, { ...opts, headers });
}

type User = {
  id: number; name: string; email: string;
  salaryBase?: string|number; xp?: number; level?: string; levelNum?: number;
  streakDays?: number; lastCheckin?: string; isNewUser?: boolean;
  emoji?: string; nickname?: string;
};
type Expense = { id: number; categoryId: number; name: string; amount: string; subcategory?: string; paid: number; dueDate?: string; recurring?: number; recurringMonths?: number; recurringGoal?: number };
type CC = { id: number; description: string; amount: string; subcategory?: string };
type Income = { id: number; description: string; amount: string; date: string };
type RankUser = { id: number; name: string; nickname?: string; emoji?: string; xp: number; levelNum: number; level: string; streakDays: number };

const CATS = [
  { id: 1, name: "Pagar-se",  emoji: "💆", color: "#6c63ff" },
  { id: 2, name: "Doar",      emoji: "💝", color: "#ff6b9d" },
  { id: 3, name: "Investir",  emoji: "📈", color: "#00d68f" },
  { id: 4, name: "Contas",    emoji: "📋", color: "#ffb703" },
  { id: 5, name: "Objetivo",  emoji: "🎯", color: "#8b5cf6" },
  { id: 6, name: "Sonho",     emoji: "✨", color: "#06b6d4" },
  { id: 7, name: "Abundar",   emoji: "🌟", color: "#f97316" },
  { id: 8, name: "Variáveis", emoji: "🛒", color: "#ef4444" },
];
const CC_CATS = ["Comida","Roupas","Gasolina","Transporte","Saúde","Streaming","Outros"];
const SONHO_ID = 6;
const calcXpIncome  = (a: number) => Math.max(1, Math.round(a));
const calcXpExpense = (a: number) => Math.max(1, Math.round(a * 0.05));
const XP_PAY_BILL = 15;

// ── SAÚDE FINANCEIRA ──────────────────────────────────────────────────────────
function calcHealthScore(salary: number, totalExp: number, totalIncome: number, totalPaid: number, totalAll: number, streakDays: number): number {
  if (salary <= 0) return 0;
  const receita = salary + totalIncome;
  const balanceRatio = receita > 0 ? Math.max(0, (receita - totalAll) / receita) : 0;
  const scoreBalance = Math.min(40, Math.round(balanceRatio * 60));
  const scorePaid = totalAll > 0 ? Math.min(30, Math.round((totalPaid / totalAll) * 30)) : 15;
  const scoreStreak = Math.min(20, Math.round((Math.min(streakDays, 30) / 30) * 20));
  const scoreExtra = totalIncome > 0 ? Math.min(10, Math.round((totalIncome / (salary * 0.3)) * 10)) : 0;
  return Math.min(100, scoreBalance + scorePaid + scoreStreak + scoreExtra);
}

function getHealthBand(score: number): { label: string; color: string; bg: string; desc: string } {
  if (score >= 83) return { label: "Ótima",       color: "#00d68f", bg: "rgba(0,214,143,0.12)",   desc: "Vida financeira sem estresse — segurança e liberdade." };
  if (score >= 69) return { label: "Muito Boa",   color: "#4ade80", bg: "rgba(74,222,128,0.1)",   desc: "Domínio do dia a dia. Foque agora no patrimônio." };
  if (score >= 61) return { label: "Boa",         color: "#a3e635", bg: "rgba(163,230,53,0.1)",   desc: "Básico bem feito. Continue registrando." };
  if (score >= 57) return { label: "Ok",          color: "#facc15", bg: "rgba(250,204,21,0.1)",   desc: "Equilíbrio no limite. Pouco espaço para erro." };
  if (score >= 50) return { label: "Baixa",       color: "#fb923c", bg: "rgba(251,146,60,0.1)",   desc: "Primeiros sinais de desequilíbrio. Atenção agora." };
  if (score >= 37) return { label: "Muito Baixa", color: "#f97316", bg: "rgba(249,115,22,0.1)",   desc: "Risco de situação crítica. Revise seus gastos." };
  return              { label: "Ruim",            color: "#ff4d6a", bg: "rgba(255,77,106,0.12)",  desc: "Círculo de fragilidade. É hora de agir." };
}

const STREAK_PHRASES: Record<string, string[]> = {
  "1-3":  ["Controle hoje, tranquilidade amanhã.","Dinheiro visto é dinheiro protegido.","O hábito está nascendo. Não pare agora."],
  "3-7":  ["O controle está virando rotina.","Dinheiro organizado rende mais que dinheiro esquecido.","Você já não gasta no automático."],
  "7-14": ["Uma semana controlando o dinheiro. Isso não é sorte.","Controle é consistência. Você está comprovando isso."],
  "14-25":["Quinze dias. Disciplina cria liberdade.","O controle já virou hábito. Agora vira identidade."],
  "25-30":["Quase um mês. Isso é diferente de 99% das pessoas."],
  "30+":  ["Um mês inteiro. Isso é mentalidade, não sorte.","Riqueza nasce da constância."],
};
const REGISTRO_TEXTOS = [
  "Cada real registrado é um passo na direção da riqueza. Quem vê para onde o dinheiro vai, aprende a mandar nele.",
  "Riqueza não nasce do quanto você ganha — nasce do quanto você acompanha.",
  "O segredo dos ricos é saber exatamente o que entra e o que sai. Cada lançamento é um treino.",
];

function rnd<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function getStreakPhrase(d: number) { return d>=30?rnd(STREAK_PHRASES["30+"]):d>=25?rnd(STREAK_PHRASES["25-30"]):d>=14?rnd(STREAK_PHRASES["14-25"]):d>=7?rnd(STREAK_PHRASES["7-14"]):d>=3?rnd(STREAK_PHRASES["3-7"]):rnd(STREAK_PHRASES["1-3"]); }
function getStreakIcon(d: number) { return d>=30?"👑":d>=14?"💎":d>=7?"⚡":"🔥"; }
function getStreakXP(d: number) { return 10 + Math.max(0, d - 1) * 5; }

// ── XP BAR ────────────────────────────────────────────────────────────────────
function XPLevel({ xp, level, levelNum }: { xp:number; level:string; levelNum:number }) {
  const cur = xp % 1000, pct = Math.round(cur / 10);
  const color = level === "avancado" ? "#ffd700" : level === "investidor" ? "#a78bfa" : "#6c63ff";
  const tierLabel = level === "avancado" ? "AVANÇADO" : level === "investidor" ? "INVESTIDOR" : "INICIANTE";
  return (
    <div style={{ background:"var(--bg3)", borderRadius:14, padding:"12px 16px", marginBottom:14, border:"1px solid var(--border)" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
        <span style={{ fontSize:12, fontWeight:800, color, letterSpacing:1 }}>⚔️ {tierLabel} NV.{levelNum}</span>
        <span style={{ fontSize:11, color:"var(--text2)", fontVariantNumeric:"tabular-nums" }}>{cur}/1000 XP · {pct}%</span>
      </div>
      <div className="xp-bar-wrap"><div className="xp-bar-fill" style={{ width:`${pct}%` }}/></div>
      <div style={{ fontSize:10, color:"var(--text2)", marginTop:4 }}>Total: {xp} XP acumulado</div>
    </div>
  );
}

function Toast({ msg, onDone }: { msg:string; onDone:()=>void }) {
  useEffect(() => { const t = setTimeout(onDone, 2500); return () => clearTimeout(t); }, []);
  return <div className="toast">{msg}</div>;
}

function Modal({ title, onClose, children }: any) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.78)", display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:100 }} onClick={onClose}>
      <div style={{ background:"var(--bg2)", borderRadius:"20px 20px 0 0", width:"100%", maxWidth:480, maxHeight:"90vh", overflowY:"auto", padding:"20px 20px 40px" }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
          <h3 style={{ fontSize:17, fontWeight:800 }}>{title}</h3>
          <button onClick={onClose} style={{ background:"var(--bg3)", border:"1px solid var(--border)", color:"var(--text2)", width:32, height:32, borderRadius:8, fontSize:16 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── STREAK MODAL ──────────────────────────────────────────────────────────────
function StreakModal({ user, onClose, onClaim }: { user:User; onClose:()=>void; onClaim:(d:any)=>void }) {
  const [streakData, setStreakData] = useState<{streakDays:number;claimedToday:boolean;expiresIn:string}|null>(null);
  const [claimed, setClaimed] = useState<boolean|null>(null);
  const [claimResult, setClaimResult] = useState<any>(null);
  const [phrase, setPhrase] = useState("");
  const [loading, setLoading] = useState(false);
  const [animPhase, setAnimPhase] = useState<"idle"|"burst"|"done">("idle");
  const [particles, setParticles] = useState<{id:number;x:number;y:number;color:string;angle:number}[]>([]);

  useEffect(() => {
    apiFetch(`${API}/users/${user.id}/streak`).then(r=>r.json()).then(d=>{
      setStreakData(d); setClaimed(!!d.claimedToday);
      setPhrase(getStreakPhrase(d.claimedToday ? d.streakDays : d.streakDays+1));
    });
  }, []);

  const triggerAnim = () => {
    setAnimPhase("burst");
    const cols = ["#ffd700","#6c63ff","#00d68f","#ff6b9d","#f97316","#a78bfa"];
    setParticles(Array.from({length:20},(_,i)=>({ id:i, x:40+Math.random()*20, y:40+Math.random()*20, color:cols[i%cols.length], angle:(i/20)*360 })));
    setTimeout(()=>{ setAnimPhase("done"); setParticles([]); }, 1200);
  };

  const handleClaim = async () => {
    if (claimed || loading || claimed===null) return;
    setLoading(true);
    try {
      const res = await apiFetch(`${API}/users/${user.id}/streak/checkin`, { method:"POST" });
      const data = await res.json();
      if (res.ok) {
        setClaimed(true); setClaimResult(data);
        setStreakData(s => s ? {...s, streakDays:data.streakDays, claimedToday:true} : s);
        setPhrase(getStreakPhrase(data.streakDays));
        triggerAnim(); onClaim(data);
      } else { setClaimed(true); }
    } catch {}
    setLoading(false);
  };

  const days = streakData?.streakDays ?? 0;
  const nextDays = claimed ? days : days+1;
  const xpNext = getStreakXP(nextDays);
  const accent = nextDays>=30?"#ffd700":nextDays>=14?"#a78bfa":nextDays>=7?"#6c63ff":"#f97316";
  const MILESTONES = [1,3,7,14,21,30];

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.85)", display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:100 }} onClick={onClose}>
      <div style={{ background:"var(--bg2)", borderRadius:"24px 24px 0 0", width:"100%", maxWidth:440, padding:"28px 24px 44px", position:"relative", overflow:"hidden", border:"1px solid rgba(108,99,255,0.2)", borderBottom:"none" }} onClick={e=>e.stopPropagation()}>
        <style>{`
          @keyframes floatUp{from{opacity:1;transform:translateX(-50%) translateY(0)}to{opacity:0;transform:translateX(-50%) translateY(-55px)}}
          @keyframes burstP{0%{opacity:1;transform:translate(0,0)}100%{opacity:0;transform:translate(var(--tx),var(--ty))}}
          @keyframes popIn{0%{transform:scale(0.7);opacity:0}60%{transform:scale(1.08)}100%{transform:scale(1);opacity:1}}
          @keyframes pulseAccent{0%,100%{opacity:0.7}50%{opacity:1}}
        `}</style>

        {particles.map(p=>(
          <div key={p.id} style={{ position:"absolute", top:`${p.y}%`, left:`${p.x}%`, width:9, height:9, borderRadius:"50%", background:p.color,
            // @ts-ignore
            "--tx":`${Math.cos(p.angle*Math.PI/180)*120}px`, "--ty":`${Math.sin(p.angle*Math.PI/180)*80}px`,
            animation:"burstP 0.9s ease-out forwards", pointerEvents:"none", zIndex:20 }}/>
        ))}

        <button onClick={onClose} style={{ position:"absolute", top:14, right:14, background:"rgba(255,255,255,0.06)", border:"1px solid var(--border)", color:"var(--text2)", width:30, height:30, borderRadius:8, fontSize:13 }}>✕</button>

        <div style={{ textAlign:"center", marginBottom:20 }}>
          <span style={{ display:"inline-block", padding:"3px 14px", borderRadius:20, background:"rgba(108,99,255,0.12)", border:"1px solid rgba(108,99,255,0.3)", fontSize:10, fontWeight:800, color:"#a78bfa", letterSpacing:3, textTransform:"uppercase" }}>BÔNUS DIÁRIO</span>
        </div>

        {/* Ícone + número */}
        <div style={{ textAlign:"center", marginBottom:20, position:"relative" }}>
          <div style={{ fontSize:52, lineHeight:1, marginBottom:8, filter:`drop-shadow(0 0 20px ${accent}aa)` }}>{getStreakIcon(nextDays)}</div>
          <div style={{ fontSize:80, fontWeight:900, lineHeight:1, color:accent, letterSpacing:"-4px", fontVariantNumeric:"tabular-nums", animation:animPhase==="idle"?"pulseAccent 2s ease infinite":"none" }}>{nextDays}</div>
          <div style={{ fontSize:12, color:"var(--text2)", textTransform:"uppercase", letterSpacing:3, marginTop:6, fontWeight:700 }}>DIAS SEGUIDOS</div>
          {animPhase==="burst"&&(
            <div style={{ position:"absolute", top:10, left:"50%", fontSize:22, fontWeight:900, color:"#ffd700", animation:"floatUp 1.1s ease forwards", whiteSpace:"nowrap" }}>
              +{claimResult?.xpGained??xpNext} XP ⚡
            </div>
          )}
        </div>

        {streakData && !claimed && (
          <div style={{ textAlign:"center", marginBottom:14 }}>
            <span style={{ background:"rgba(255,183,3,0.1)", border:"1px solid rgba(255,183,3,0.2)", borderRadius:8, padding:"5px 12px", color:"#ffb703", fontSize:12, fontWeight:600 }}>⏱ Expira em {streakData.expiresIn}</span>
          </div>
        )}

        {/* Marcos */}
        <div style={{ display:"flex", gap:6, marginBottom:16, justifyContent:"center" }}>
          {MILESTONES.map(d=>{
            const isDone = claimed ? d<=days : d<nextDays;
            const isCurrent = d===nextDays;
            return (
              <div key={d} style={{ flex:"0 0 auto", width:50, background:isCurrent?`${accent}20`:isDone?"rgba(0,214,143,0.08)":"var(--bg3)", border:`1.5px solid ${isCurrent?accent:isDone?"rgba(0,214,143,0.35)":"var(--border)"}`, borderRadius:12, padding:"8px 4px", textAlign:"center", transform:isCurrent?"scale(1.1)":"scale(1)", transition:"transform 0.2s" }}>
                <div style={{ fontSize:14 }}>{isDone&&!isCurrent?"✅":getStreakIcon(d)}</div>
                <div style={{ fontSize:11, fontWeight:800, color:isCurrent?accent:isDone?"var(--green)":"var(--text2)", marginTop:2 }}>{d}</div>
                <div style={{ fontSize:9, color:"var(--text2)", marginTop:1 }}>{getStreakXP(d)}xp</div>
              </div>
            );
          })}
        </div>

        {!claimed && claimed!==null && (
          <div style={{ textAlign:"center", marginBottom:12 }}>
            <span style={{ fontSize:28, fontWeight:900, color:"#ffd700", letterSpacing:-1 }}>+{xpNext}</span>
            <span style={{ fontSize:14, color:"var(--text2)", marginLeft:5 }}>XP</span>
          </div>
        )}

        {/* Frase motivacional */}
        <div style={{ background:"rgba(108,99,255,0.07)", border:"1px solid rgba(108,99,255,0.2)", borderRadius:12, padding:"12px 16px", marginBottom:18 }}>
          <p style={{ fontSize:14, fontWeight:600, color:"var(--text)", lineHeight:1.6, textAlign:"center" }}>
            {claimed&&claimResult ? "Sequência mantida. Volte amanhã e não quebre o ritmo." : phrase}
          </p>
        </div>

        {claimed===null ? (
          <div style={{ width:"100%", padding:"15px", borderRadius:14, background:"var(--bg3)", textAlign:"center", color:"var(--text2)", fontSize:14 }}>Carregando...</div>
        ) : claimed ? (
          <div style={{ width:"100%", padding:"16px", borderRadius:14, background:"linear-gradient(135deg,rgba(0,214,143,0.15),rgba(0,214,143,0.08))", border:"1px solid rgba(0,214,143,0.35)", textAlign:"center", animation:animPhase!=="idle"?"popIn 0.5s ease":"none" }}>
            <div style={{ fontSize:22, marginBottom:4 }}>✅</div>
            <div style={{ fontSize:16, fontWeight:800, color:"var(--green)" }}>Resgatado hoje{claimResult?` · +${claimResult.xpGained} XP`:""}</div>
            <div style={{ fontSize:12, color:"var(--text2)", marginTop:3 }}>Volte amanhã para o dia {days+1} 🔥</div>
          </div>
        ) : (
          <button onClick={handleClaim} disabled={loading} style={{ width:"100%", padding:"16px", border:"none", borderRadius:14, background:loading?"var(--bg3)":"linear-gradient(135deg,#6c63ff,#b44fff)", color:loading?"var(--text2)":"white", fontSize:16, fontWeight:800, cursor:loading?"default":"pointer", letterSpacing:0.5, boxShadow:loading?"none":"0 4px 24px rgba(108,99,255,0.45)" }}>
            {loading ? "⏳ Salvando..." : "🎁 Resgatar bônus"}
          </button>
        )}
      </div>
    </div>
  );
}

// ── BAR CHART ─────────────────────────────────────────────────────────────────
function BarChart({ data }: { data:{label:string;value:number;color:string;emoji:string}[] }) {
  const max = Math.max(...data.map(d=>d.value), 1);
  return (
    <div style={{ display:"flex", alignItems:"flex-end", gap:6, height:110, padding:"0 2px" }}>
      {data.map((d,i)=>(
        <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
          <div style={{ fontSize:9, color:"var(--text2)", fontWeight:700, whiteSpace:"nowrap", overflow:"hidden", maxWidth:"100%", textAlign:"center" }}>{d.value>0?fmt(d.value).replace("R$\u00a0","").replace(",00",""):""}</div>
          <div style={{ width:"100%", borderRadius:"4px 4px 0 0", background:d.value>0?d.color:"var(--bg3)", height:`${Math.max(d.value/max*85,d.value>0?6:2)}px`, transition:"height .6s ease", opacity:d.value>0?1:0.3 }}/>
          <div style={{ fontSize:13 }}>{d.emoji}</div>
        </div>
      ))}
    </div>
  );
}

// ── ONBOARDING ────────────────────────────────────────────────────────────────
function Onboarding({ user, onDone }: { user:User; onDone:()=>void }) {
  const [step, setStep] = useState(0);
  const POTES = [
    { emoji:"💆", name:"Pagar-se",  pct:"5-10%",  color:"#6c63ff", desc:"Invista em você mesmo — prazer, saúde, desenvolvimento" },
    { emoji:"💝", name:"Doar",      pct:"5-10%",  color:"#ff6b9d", desc:"Generosidade quebra a mentalidade de escassez" },
    { emoji:"📈", name:"Investir",  pct:"5-10%",  color:"#00d68f", desc:"Construa patrimônio. Os juros compostos trabalham por você" },
    { emoji:"📋", name:"Contas",    pct:"60-70%", color:"#ffb703", desc:"Obrigações mensais. Aprenda a viver bem gastando menos" },
    { emoji:"✨", name:"Sonho",     pct:"5-10%",  color:"#8b5cf6", desc:"Sua meta de longo prazo. Transforma controle em aventura" },
    { emoji:"🌟", name:"Abundar",   pct:"5-10%",  color:"#f97316", desc:"Restaurante melhor, hobby, experiências — você merece" },
  ];
  const steps = [
    <div style={{ textAlign:"center", padding:"0 8px" }}>
      <div style={{ marginBottom:16, display:"flex", justifyContent:"center" }}><CoinIcon size={72}/></div>
      <h2 style={{ fontSize:24, fontWeight:900, background:"linear-gradient(135deg,#6c63ff,#b44fff,#ffd700)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", marginBottom:12 }}>Bem-vindo, {user.name?.split(" ")[0]}!</h2>
      <p style={{ color:"var(--text2)", fontSize:14, lineHeight:1.65, marginBottom:20 }}>No MoneyGame, cada ação financeira vira experiência. Registre, ganhe XP e suba de nível enquanto constrói riqueza de verdade.</p>
      {[{icon:"⚔️",text:"Ganhe XP proporcional a cada registro"},{icon:"🔥",text:"Mantenha sua streak diária e acumule bônus"},{icon:"📈",text:"Suba de nível e desbloqueie títulos exclusivos"}].map((f,i)=>(
        <div key={i} style={{ display:"flex", alignItems:"center", gap:12, background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:12, padding:"12px 14px", textAlign:"left", marginBottom:8 }}>
          <span style={{ fontSize:22 }}>{f.icon}</span><span style={{ fontSize:14, fontWeight:600 }}>{f.text}</span>
        </div>
      ))}
    </div>,
    <div>
      <h2 style={{ fontSize:18, fontWeight:900, textAlign:"center", marginBottom:14 }}>🏺 Os 6 Potes da Riqueza</h2>
      <div style={{ background:"rgba(108,99,255,0.07)", border:"1px solid rgba(108,99,255,0.2)", borderRadius:12, padding:"12px 16px", marginBottom:14 }}>
        <div style={{ fontSize:10, fontWeight:800, color:"#a78bfa", textTransform:"uppercase", letterSpacing:2, marginBottom:6 }}>CADA REGISTRO CONTA</div>
        <p style={{ fontSize:13, color:"var(--text)", lineHeight:1.6 }}>{rnd(REGISTRO_TEXTOS)}</p>
      </div>
      {POTES.map((p,i)=>(
        <div key={i} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 14px", background:"var(--bg3)", borderRadius:12, borderLeft:`3px solid ${p.color}`, marginBottom:7 }}>
          <span style={{ fontSize:20, flexShrink:0 }}>{p.emoji}</span>
          <div style={{ flex:1 }}>
            <div style={{ display:"flex", justifyContent:"space-between" }}>
              <span style={{ fontWeight:700, fontSize:13 }}>{p.name}</span>
              <span style={{ fontSize:11, color:p.color, fontWeight:700 }}>{p.pct}</span>
            </div>
            <div style={{ fontSize:11, color:"var(--text2)", marginTop:2 }}>{p.desc}</div>
          </div>
        </div>
      ))}
    </div>,
    <OnboardingSalary user={user} onDone={onDone}/>,
  ];
  return (
    <div style={{ minHeight:"100vh", background:"var(--bg)", display:"flex", flexDirection:"column", padding:"20px 20px" }}>
      <div style={{ display:"flex", justifyContent:"center", gap:6, marginBottom:28 }}>
        {[0,1,2].map(i=><div key={i} style={{ width:i===step?20:8, height:8, borderRadius:4, background:i===step?"#6c63ff":"var(--bg3)", transition:"all .3s" }}/>)}
      </div>
      <div style={{ flex:1, overflowY:"auto" }}>{steps[step]}</div>
      {step<2&&<button className="btn-primary" onClick={()=>setStep(s=>s+1)} style={{ width:"100%", marginTop:20, padding:"15px", fontSize:15 }}>{step===0?"Ver metodologia →":"Configurar meu perfil →"}</button>}
    </div>
  );
}

function OnboardingSalary({ user, onDone }: { user:User; onDone:()=>void }) {
  const [salary, setSalary] = useState("");
  const [loading, setLoading] = useState(false);
  const save = async () => {
    if (salary && parseFloat(salary) > 0) {
      setLoading(true);
      await apiFetch(`${API}/users/${user.id}/settings`,{method:"PUT",body:JSON.stringify({salaryBase:parseFloat(salary)})});
      setLoading(false);
    }
    onDone();
  };
  return (
    <div style={{ textAlign:"center" }}>
      <div style={{ fontSize:48, marginBottom:14 }}>💰</div>
      <h2 style={{ fontSize:19, fontWeight:900, marginBottom:8 }}>Qual é seu salário base?</h2>
      <p style={{ color:"var(--text2)", fontSize:13, marginBottom:20, lineHeight:1.5 }}>Isso ajuda a calcular seu saldo e saúde financeira.</p>
      <input type="number" placeholder="Ex: 3000" value={salary} onChange={e=>setSalary(e.target.value)} style={{ width:"100%", fontSize:18, textAlign:"center", marginBottom:14 }}/>
      <button className="btn-primary" onClick={save} disabled={loading} style={{ width:"100%", padding:"15px", fontSize:15 }}>{loading?"Salvando...":"🚀 Começar minha jornada"}</button>
      <button className="btn-ghost" onClick={onDone} style={{ width:"100%", marginTop:8, fontSize:13 }}>Pular por agora</button>
    </div>
  );
}

// ── AUTH ──────────────────────────────────────────────────────────────────────
function Auth({ onLogin }: { onLogin:(u:User,token:string)=>void }) {
  const [mode, setMode] = useState<"login"|"register"|"intro"|"reset">("intro");
  const [form, setForm] = useState({ name:"", email:"", password:"", newPassword:"" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  const submit = async () => {
    setLoading(true); setError("");
    try {
      const body = mode==="reset"
        ? { email:form.email, newPassword:form.newPassword }
        : form;
      const endpoint = mode==="reset" ? "reset-password" : mode;
      const res = await fetch(`${API}/auth/${endpoint}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
      const data = await res.json();
      if (!res.ok) { setError(data.error||"Erro"); return; }
      if (mode==="reset") { setResetDone(true); return; }
      onLogin(data.user, data.token);
    } catch { setError("Erro de conexão"); } finally { setLoading(false); }
  };

  if (mode==="intro") return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(135deg,#0a0d14,#111420)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"24px 20px", textAlign:"center" }}>
      <div style={{ marginBottom:14 }}><CoinIcon size={68}/></div>
      <h1 style={{ fontSize:34, fontWeight:900, background:"linear-gradient(135deg,#6c63ff,#b44fff,#ffd700)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", marginBottom:8 }}>MONEYGAME</h1>
      <p style={{ color:"var(--text2)", fontSize:14, marginBottom:30, maxWidth:300 }}>Gamifique seu controle financeiro com a metodologia dos 6 potes</p>
      <div style={{ width:"100%", maxWidth:340, display:"flex", flexDirection:"column", gap:10, marginBottom:36 }}>
        {[{emoji:"⚔️",title:"Suba de Nível",desc:"Ganhe XP a cada ação financeira"},{emoji:"🔥",title:"Streak Diária",desc:"Apareça todo dia e acumule recompensas"},{emoji:"📊",title:"Controle Total",desc:"Despesas, cartão, renda extra e sonhos"}].map((f,i)=>(
          <div key={i} style={{ background:"var(--bg2)", border:"1px solid var(--border)", borderRadius:14, padding:"12px 14px", display:"flex", alignItems:"center", gap:12, textAlign:"left" }}>
            <span style={{ fontSize:26 }}>{f.emoji}</span>
            <div><div style={{ fontWeight:700, fontSize:14 }}>{f.title}</div><div style={{ fontSize:12, color:"var(--text2)", marginTop:2 }}>{f.desc}</div></div>
          </div>
        ))}
      </div>
      <div style={{ width:"100%", maxWidth:340, display:"flex", flexDirection:"column", gap:10 }}>
        <button className="btn-primary" onClick={()=>setMode("register")} style={{ width:"100%", fontSize:15, padding:"15px" }}>🚀 COMEÇAR MINHA JORNADA</button>
        <button className="btn-ghost" onClick={()=>setMode("login")} style={{ width:"100%" }}>Já tenho conta</button>
      </div>
    </div>
  );

  if (mode==="reset") return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"var(--bg)", padding:"20px" }}>
      <div style={{ width:"100%", maxWidth:370 }}>
        <div style={{ textAlign:"center", marginBottom:24 }}>
          <div style={{ marginBottom:8, display:"flex", justifyContent:"center" }}><CoinIcon size={44}/></div>
          <h1 style={{ fontSize:22, fontWeight:900, color:"var(--text)" }}>Redefinir Senha</h1>
        </div>
        <div className="card">
          {resetDone ? (
            <div style={{ textAlign:"center", padding:"16px 0" }}>
              <div style={{ fontSize:36, marginBottom:12 }}>✅</div>
              <div style={{ fontSize:16, fontWeight:700, color:"var(--green)", marginBottom:8 }}>Senha redefinida!</div>
              <button className="btn-ghost" onClick={()=>setMode("login")} style={{ width:"100%", marginTop:8 }}>Entrar agora</button>
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              <input type="email" placeholder="Seu e-mail" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))}/>
              <input type="password" placeholder="Nova senha (mín. 6 caracteres)" value={form.newPassword} onChange={e=>setForm(f=>({...f,newPassword:e.target.value}))}/>
              {error&&<p style={{ color:"var(--red)", fontSize:13, textAlign:"center" }}>{error}</p>}
              <button className="btn-primary" onClick={submit} disabled={loading} style={{ width:"100%" }}>{loading?"Aguarde...":"Redefinir Senha"}</button>
              <button className="btn-ghost" onClick={()=>setMode("login")} style={{ width:"100%", fontSize:12 }}>← Voltar</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"var(--bg)", padding:"20px" }}>
      <div style={{ width:"100%", maxWidth:370 }}>
        <div style={{ textAlign:"center", marginBottom:24 }}>
          <div style={{ marginBottom:8, display:"flex", justifyContent:"center" }}><CoinIcon size={44}/></div>
          <h1 style={{ fontSize:22, fontWeight:900, background:"linear-gradient(135deg,#6c63ff,#b44fff)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>MONEYGAME</h1>
        </div>
        <div className="card">
          <div style={{ display:"flex", gap:8, marginBottom:18 }}>
            {(["login","register"] as const).map(m=>(
              <button key={m} onClick={()=>setMode(m)} style={{ flex:1, padding:"10px", borderRadius:10, fontWeight:700, fontSize:13, background:mode===m?"var(--primary)":"var(--bg3)", color:mode===m?"white":"var(--text2)", border:"1.5px solid var(--border)" }}>{m==="login"?"Entrar":"Cadastrar"}</button>
            ))}
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            {mode==="register"&&<input placeholder="Seu nome" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/>}
            <input type="email" placeholder="E-mail" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))}/>
            <input type="password" placeholder="Senha (mín. 6 caracteres)" value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&submit()}/>
            {error&&<p style={{ color:"var(--red)", fontSize:13, textAlign:"center" }}>{error}</p>}
            <button className="btn-primary" onClick={submit} disabled={loading} style={{ width:"100%", marginTop:4 }}>{loading?"Aguarde...":mode==="login"?"Entrar":"Criar conta"}</button>
            {mode==="login"&&<button className="btn-ghost" onClick={()=>setMode("reset")} style={{ width:"100%", fontSize:12 }}>Esqueci minha senha</button>}
            <button className="btn-ghost" onClick={()=>setMode("intro")} style={{ width:"100%", fontSize:12 }}>← Voltar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── SAÚDE FINANCEIRA CARD ─────────────────────────────────────────────────────
function HealthCard({ score, salary }: { score:number; salary:number }) {
  const band = getHealthBand(score);
  const pct = score;
  const barColor = band.color;
  const needsSalary = salary <= 0;

  if (needsSalary) return (
    <div style={{ background:"rgba(255,183,3,0.08)", border:"1px solid rgba(255,183,3,0.3)", borderRadius:14, padding:"14px 16px", marginBottom:14 }}>
      <div style={{ fontSize:11, fontWeight:800, color:"#ffb703", textTransform:"uppercase", letterSpacing:1, marginBottom:6 }}>💡 CONFIGURE SEU PERFIL</div>
      <div style={{ fontSize:14, color:"var(--text2)", lineHeight:1.5 }}>Defina seu salário base em Configurações para ver sua saúde financeira.</div>
    </div>
  );

  return (
    <div style={{ background:band.bg, border:`1px solid ${band.color}44`, borderRadius:14, padding:"14px 16px", marginBottom:14 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
        <div>
          <div style={{ fontSize:10, fontWeight:800, color:"var(--text2)", textTransform:"uppercase", letterSpacing:1, marginBottom:3 }}>SAÚDE FINANCEIRA</div>
          <div style={{ display:"flex", alignItems:"baseline", gap:8 }}>
            <span style={{ fontSize:28, fontWeight:900, color:band.color, fontVariantNumeric:"tabular-nums" }}>{score}</span>
            <span style={{ fontSize:12, color:"var(--text2)" }}>/100</span>
            <span style={{ fontSize:14, fontWeight:800, color:band.color }}>{band.label}</span>
          </div>
        </div>
        <div style={{ position:"relative", width:52, height:52, flexShrink:0 }}>
          <svg viewBox="0 0 36 36" width={52} height={52}>
            <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--bg3)" strokeWidth="3.5"/>
            <circle cx="18" cy="18" r="15.9" fill="none" stroke={barColor} strokeWidth="3.5"
              strokeDasharray={`${pct} ${100-pct}`} strokeDashoffset="25" strokeLinecap="round"
              style={{ transition:"stroke-dasharray 1s ease" }}/>
            <text x="18" y="21" textAnchor="middle" fontSize="9" fontWeight="900" fill={barColor} fontFamily="Figtree,sans-serif">{score}</text>
          </svg>
        </div>
      </div>
      <div style={{ height:5, background:"var(--bg3)", borderRadius:3, overflow:"hidden", marginBottom:6 }}>
        <div style={{ height:"100%", width:`${pct}%`, background:`linear-gradient(90deg,${barColor}88,${barColor})`, borderRadius:3, transition:"width 1s ease" }}/>
      </div>
      <div style={{ fontSize:12, color:"var(--text2)", lineHeight:1.45 }}>{band.desc}</div>
    </div>
  );
}

// ── AI INSIGHT BUTTON ──────────────────────────────────────────────────────────
function AIInsightButton({ salary, totalExp, totalCC, totalIncome, healthScore, streakDays, xp }: any) {
  const [loading, setLoading] = useState(false);
  const [insight, setInsight] = useState("");
  const [show, setShow] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const weekKey = `nc_ia_week_${Math.floor(Date.now() / (7*24*3600*1000))}`;
  const lastGenerated = localStorage.getItem(weekKey);
  const alreadyUsed = !!lastGenerated;

  const generate = async () => {
    if (alreadyUsed || loading) return;
    setLoading(true); setShow(true); setInsight("");
    try {
      const saldo = salary + totalIncome - totalExp - totalCC;
      const prompt = `Você é consultor financeiro da metodologia dos 6 potes. Dê exatamente 3 insights práticos, curtos e diretos (máximo 3 linhas cada).\n\nDados:\n- Salário: R$ ${salary.toFixed(2)}\n- Despesas: R$ ${(totalExp+totalCC).toFixed(2)}\n- Renda extra: R$ ${totalIncome.toFixed(2)}\n- Saldo: R$ ${saldo.toFixed(2)}\n- Saúde: ${healthScore}/100\n- Streak: ${streakDays} dias\n\nResponda APENAS com os 3 insights numerados.`;
      const res = await apiFetch(`${API}/ai/insights`, { method:"POST", body: JSON.stringify({ prompt }) });
      const data = await res.json();
      if (res.ok) { setInsight(data.text); localStorage.setItem(weekKey, String(Date.now())); }
      else setInsight("Não foi possível gerar agora.");
    } catch { setInsight("Erro de conexão."); }
    setLoading(false);
  };
  const daysLeft = alreadyUsed ? Math.max(1, 7 - Math.floor((Date.now() - parseInt(lastGenerated!)) / 86400000)) : 0;

  return (
    <>
      <div style={{ background:"var(--bg2)", borderRadius:14, overflow:"hidden", marginBottom:8 }}>
        <div style={{ padding:"13px 16px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:34, height:34, borderRadius:"50%", background:"rgba(130,10,209,0.15)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>🤖</div>
            <div>
              <div style={{ fontSize:13, fontWeight:600, color:"var(--text)" }}>Análise com IA</div>
              <div style={{ fontSize:11, color:"var(--text2)", marginTop:1 }}>{alreadyUsed ? `Próxima em ${daysLeft} dia${daysLeft>1?"s":""}` : "3 insights personalizados"}</div>
            </div>
          </div>
          <button onClick={alreadyUsed ? ()=>setShow(s=>!s) : generate} disabled={loading}
            style={{ background:alreadyUsed?"var(--bg3)":"rgba(130,10,209,0.2)", border:`0.5px solid ${alreadyUsed?"var(--border)":"rgba(130,10,209,0.4)"}`, color:alreadyUsed?"var(--text2)":"#c084fc", borderRadius:8, padding:"6px 12px", fontSize:12, fontWeight:600, cursor:loading?"default":"pointer", whiteSpace:"nowrap" as any }}>
            {loading ? "..." : alreadyUsed ? (show?"ocultar":"ver") : "gerar"}
          </button>
        </div>
        {show && (
          <div style={{ borderTop:"0.5px solid var(--border)", padding:"12px 16px" }}>
            {loading ? <div style={{ color:"var(--text2)", fontSize:13, textAlign:"center" }}>Analisando...</div>
              : <div style={{ fontSize:13, color:"var(--text)", lineHeight:1.7, whiteSpace:"pre-wrap" }}>{insight}</div>}
          </div>
        )}
      </div>
      <ReportButton/>
    </>
  );
}

function ReportButton() {
  const [show, setShow] = useState(false);
  return (
    <>
      <div onClick={()=>setShow(true)} style={{ background:"var(--bg2)", borderRadius:14, padding:"13px 16px", marginBottom:8, display:"flex", alignItems:"center", justifyContent:"space-between", cursor:"pointer" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:34, height:34, borderRadius:"50%", background:"rgba(0,214,143,0.12)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>📄</div>
          <div>
            <div style={{ fontSize:13, fontWeight:600, color:"var(--text)" }}>Relatório Mensal PDF</div>
            <div style={{ fontSize:11, color:"var(--text2)", marginTop:1 }}>Resumo completo do mês</div>
          </div>
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text2)" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
      </div>
      {show && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:200, padding:20 }} onClick={()=>setShow(false)}>
          <div style={{ background:"var(--bg2)", borderRadius:18, padding:"28px 22px", maxWidth:340, width:"100%", textAlign:"center" }} onClick={e=>e.stopPropagation()}>
            <div style={{ fontSize:36, marginBottom:12 }}>📄</div>
            <div style={{ fontSize:16, fontWeight:700, color:"var(--text)", marginBottom:8 }}>Relatório Mensal</div>
            <div style={{ fontSize:13, color:"var(--text2)", lineHeight:1.6, marginBottom:20 }}>Em desenvolvimento. Disponível em breve no NaCarteira!</div>
            <button onClick={()=>setShow(false)} style={{ width:"100%", padding:"12px", borderRadius:10, background:"rgba(130,10,209,0.2)", border:"0.5px solid rgba(130,10,209,0.4)", color:"#c084fc", fontSize:14, fontWeight:600, cursor:"pointer" }}>Entendido</button>
          </div>
        </div>
      )}
    </>
  );
}


// ── RANKING CONTENT ───────────────────────────────────────────────────────────
function RankingContent({ currentUserId }: { currentUserId: number }) {
  const [ranking, setRanking] = useState<RankUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/ranking`).then(r=>r.json()).then(d=>{
      setRanking(Array.isArray(d)?d:[]);
    }).catch(()=>setRanking([])).finally(()=>setLoading(false));
  }, []);

  const tierColor = (level: string) => level==="avancado"?"#ffd700":level==="investidor"?"#a78bfa":"#6c63ff";
  const tierLabel = (level: string) => level==="avancado"?"AVANÇADO":level==="investidor"?"INVESTIDOR":"INICIANTE";
  const medalEmoji = (pos: number) => pos===0?"🥇":pos===1?"🥈":pos===2?"🥉":"";

  if (loading) return <div style={{ textAlign:"center", color:"var(--text2)", padding:40 }}>Carregando ranking...</div>;

  return (
    <div>
      <h2 style={{ fontSize:17, fontWeight:800, marginBottom:16 }}>🏆 Ranking Global</h2>

      {ranking.length === 0 ? (
        <div className="card" style={{ textAlign:"center", color:"var(--text2)", padding:40 }}>
          Nenhum usuário no ranking ainda.
        </div>
      ) : (
        <>
          {/* Top 3 destaque */}
          {ranking.length >= 3 && (
            <div style={{ display:"flex", gap:10, marginBottom:16, alignItems:"flex-end" }}>
              {/* 2° lugar */}
              <div style={{ flex:1, background:"rgba(192,192,192,0.08)", border:"1px solid rgba(192,192,192,0.2)", borderRadius:14, padding:"14px 10px", textAlign:"center" }}>
                <div style={{ fontSize:28, marginBottom:4 }}>{ranking[1]?.emoji || "💸"}</div>
                <div style={{ fontSize:11, fontWeight:800, color:"#a0a0a0", marginBottom:3 }}>🥈 2°</div>
                <div style={{ fontSize:13, fontWeight:700, color:"var(--text)", marginBottom:1 }}>{ranking[1]?.nickname || ranking[1]?.name?.split(" ")[0]}</div>
                <div style={{ fontSize:11, color:"#a0a0a0", fontVariantNumeric:"tabular-nums" }}>{ranking[1]?.xp} XP</div>
              </div>
              {/* 1° lugar */}
              <div style={{ flex:1, background:"rgba(255,215,0,0.1)", border:"1px solid rgba(255,215,0,0.3)", borderRadius:14, padding:"18px 10px", textAlign:"center", transform:"translateY(-8px)" }}>
                <div style={{ fontSize:34, marginBottom:4 }}>{ranking[0]?.emoji || "💸"}</div>
                <div style={{ fontSize:12, fontWeight:800, color:"#ffd700", marginBottom:3 }}>🥇 1°</div>
                <div style={{ fontSize:14, fontWeight:800, color:"var(--text)", marginBottom:1 }}>{ranking[0]?.nickname || ranking[0]?.name?.split(" ")[0]}</div>
                <div style={{ fontSize:12, color:"#ffd700", fontWeight:700, fontVariantNumeric:"tabular-nums" }}>{ranking[0]?.xp} XP</div>
              </div>
              {/* 3° lugar */}
              <div style={{ flex:1, background:"rgba(205,127,50,0.08)", border:"1px solid rgba(205,127,50,0.2)", borderRadius:14, padding:"14px 10px", textAlign:"center" }}>
                <div style={{ fontSize:28, marginBottom:4 }}>{ranking[2]?.emoji || "💸"}</div>
                <div style={{ fontSize:11, fontWeight:800, color:"#cd7f32", marginBottom:3 }}>🥉 3°</div>
                <div style={{ fontSize:13, fontWeight:700, color:"var(--text)", marginBottom:1 }}>{ranking[2]?.nickname || ranking[2]?.name?.split(" ")[0]}</div>
                <div style={{ fontSize:11, color:"#cd7f32", fontVariantNumeric:"tabular-nums" }}>{ranking[2]?.xp} XP</div>
              </div>
            </div>
          )}

          {/* Lista completa */}
          <div className="card" style={{ padding:0, overflow:"hidden" }}>
            {ranking.map((u, i) => {
              const isMe = u.id === currentUserId;
              return (
                <div key={u.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 16px", borderBottom:i<ranking.length-1?"1px solid var(--border)":"none", background:isMe?"rgba(108,99,255,0.08)":"transparent" }}>
                  <div style={{ width:28, textAlign:"center", fontSize:i<3?18:13, fontWeight:800, color:i===0?"#ffd700":i===1?"#a0a0a0":i===2?"#cd7f32":"var(--text2)", flexShrink:0 }}>
                    {i<3 ? medalEmoji(i) : `${i+1}`}
                  </div>
                  <div style={{ fontSize:22, flexShrink:0 }}>{u.emoji || "💸"}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <span style={{ fontWeight:700, fontSize:14, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                        {u.nickname || u.name?.split(" ")[0]}
                        {isMe && <span style={{ marginLeft:6, fontSize:10, background:"rgba(108,99,255,0.2)", color:"#a78bfa", padding:"1px 6px", borderRadius:6, fontWeight:700 }}>VOCÊ</span>}
                      </span>
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:2 }}>
                      <span style={{ fontSize:10, fontWeight:700, color:tierColor(u.level) }}>{tierLabel(u.level)} NV.{u.levelNum}</span>
                      {u.streakDays > 0 && <span style={{ fontSize:10, color:"var(--text2)" }}>🔥 {u.streakDays}d</span>}
                    </div>
                  </div>
                  <div style={{ textAlign:"right", flexShrink:0 }}>
                    <div style={{ fontSize:14, fontWeight:800, color:tierColor(u.level), fontVariantNumeric:"tabular-nums" }}>{u.xp.toLocaleString()}</div>
                    <div style={{ fontSize:10, color:"var(--text2)" }}>XP</div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ── POP-UP DOAÇÃO ─────────────────────────────────────────────────────────────
const DONATION_MSGS = [
  ["Você também faz parte desse projeto ✨", "Criado por uma pessoa só, para quem quer superar sua situação financeira com método."],
  ["Apoie um criador independente ☕", "O MoneyGame nasceu de uma necessidade real. Se ele está te ajudando, considere retribuir."],
  ["Sua ajuda chega mais longe do que você imagina 🚀", "Com R$25 você mantém o servidor no ar por um mês inteiro."],
  ["O dinheiro pode mudar de lado — comece aqui 💚", "Criado por alguém que também está nessa jornada. Juntos chegamos mais longe."],
  ["Que tal um café para quem criou isso pra você? ☕", "Um gesto simples que mantém vivo um projeto feito com propósito."],
  ["Há saída — e esse app prova isso todo dia 🌱", "Foi criado porque quem o fez também precisava de esperança financeira."],
  ["Você merece clareza financeira. O criador merece seu apoio 💜", "Sem patrocínio, sem investidor. Só um projeto feito com método."],
  ["Cada real aqui volta como funcionalidade pra você 🔄", "O apoio dos usuários financia melhorias e novas ferramentas."],
  ["Sua opinião e apoio constroem o futuro do app 💬", "Tem uma sugestão também? Manda junto com seu café!"],
  ["Controle financeiro é possível — acredite nisso 🏆", "Esse app existe porque alguém acreditou que era possível mudar de vida."],
];

function DonationPopup({ onClose }: { onClose: () => void }) {
  const idx = parseInt(localStorage.getItem("mg_donation_idx") || "0") % DONATION_MSGS.length;
  const [title, sub] = DONATION_MSGS[idx];
  const [copied, setCopied] = useState(false);
  const copyPix = () => {
    navigator.clipboard.writeText("11976016950").then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.82)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:300, padding:20 }} onClick={onClose}>
      <div style={{ background:"var(--bg2)", borderRadius:20, width:"100%", maxWidth:380, overflow:"hidden", border:"1px solid rgba(130,10,209,0.3)" }} onClick={e=>e.stopPropagation()}>
        <div style={{ background:"var(--bg3)", padding:"18px 20px 14px", borderBottom:"1px solid var(--border)", position:"relative" }}>
          <button onClick={onClose} style={{ position:"absolute", top:12, right:14, background:"var(--bg2)", border:"1px solid var(--border)", color:"var(--text2)", width:26, height:26, borderRadius:"50%", fontSize:13, cursor:"pointer" }}>✕</button>
          <div style={{ display:"inline-block", background:"rgba(130,10,209,0.2)", color:"#c084fc", fontSize:10, fontWeight:700, letterSpacing:0.8, padding:"3px 9px", borderRadius:20, marginBottom:10, textTransform:"uppercase" }}>Apoie o projeto</div>
          <div style={{ fontSize:15, fontWeight:700, color:"var(--text)", lineHeight:1.4, marginBottom:5 }}>{title}</div>
          <div style={{ fontSize:12, color:"var(--text2)", lineHeight:1.5 }}>{sub}</div>
        </div>
        <div style={{ padding:"16px 20px" }}>
          <div style={{ background:"rgba(130,10,209,0.07)", border:"0.5px solid rgba(130,10,209,0.2)", borderRadius:10, padding:"11px 13px", marginBottom:12, fontSize:12, color:"var(--text2)", lineHeight:1.6 }}>
            As análises e insights são de <strong style={{color:"#c084fc"}}>inteligência artificial</strong>, mas seu criador não — por isso, para o projeto se manter, precisamos do seu apoio.
          </div>
          <div style={{ background:"rgba(0,214,143,0.06)", border:"0.5px solid rgba(0,214,143,0.2)", borderRadius:10, padding:"11px 14px", marginBottom:12, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div>
              <div style={{ fontSize:10, color:"var(--text2)", textTransform:"uppercase", letterSpacing:0.6, fontWeight:700, marginBottom:3 }}>Contribuição sugerida</div>
              <div style={{ fontSize:22, fontWeight:800, color:"var(--green)", lineHeight:1 }}>R$ 25</div>
              <div style={{ fontSize:11, color:"var(--text2)", marginTop:2 }}>cobre 1 mês do servidor</div>
            </div>
            <div style={{ background:"rgba(0,214,143,0.12)", color:"var(--green)", fontSize:10, fontWeight:700, padding:"6px 10px", borderRadius:8, textAlign:"center", lineHeight:1.5 }}>Sua ajuda<br/>chega longe 🚀</div>
          </div>
          <div style={{ background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:10, padding:"13px", marginBottom:10 }}>
            <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:10 }}>
              <div style={{ width:8, height:8, borderRadius:"50%", background:"#820AD1", flexShrink:0 }}/>
              <span style={{ fontSize:11, color:"var(--text2)", fontWeight:700 }}>PIX · Nubank</span>
            </div>
            <div style={{ display:"flex", gap:10, alignItems:"center" }}>
              <div style={{ flex:1 }}>
                <div style={{ fontFamily:"monospace", fontSize:13, color:"var(--text)", fontWeight:600 }}>11976016950</div>
                <div style={{ fontSize:11, color:"var(--text2)", marginTop:2 }}>João P S Saraiva</div>
              </div>
              <button onClick={copyPix} style={{ background:"rgba(130,10,209,0.15)", border:"0.5px solid rgba(130,10,209,0.35)", color:"#c084fc", fontSize:11, fontWeight:700, padding:"7px 12px", borderRadius:7, cursor:"pointer", whiteSpace:"nowrap" }}>
                {copied ? "✓ Copiado!" : "Copiar Pix"}
              </button>
            </div>
          </div>
          <a href="https://ko-fi.com/moneygame" target="_blank" rel="noopener noreferrer"
            style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, background:"rgba(255,215,0,0.06)", border:"0.5px solid rgba(255,215,0,0.2)", color:"#c9a800", fontSize:12, fontWeight:600, padding:"10px", borderRadius:8, textDecoration:"none", marginBottom:4 }}>
            ☕ Pague um Ko-fi ao criador
          </a>
          <div style={{ fontSize:10, color:"var(--text2)", textAlign:"center", marginBottom:10, lineHeight:1.5 }}>Ko-fi aceita cartão de crédito ou pagamento recorrente — ideal para quem quer apoiar mensalmente</div>
          <div style={{ fontSize:11, color:"var(--text2)", textAlign:"center" }}>Sem cobrança automática. Você decide se e quanto quer apoiar.</div>
        </div>
      </div>
    </div>
  );
}

function useDonationPopup(createdAt?: string) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!createdAt) return;
    const daysSince = (Date.now() - new Date(createdAt).getTime()) / 86400000;
    if (daysSince < 7) return;
    const lastTs = parseInt(localStorage.getItem("mg_donation_last") || "0");
    if ((Date.now() - lastTs) / 86400000 < 7) return;
    const monthKey = `mg_donation_month_${new Date().toISOString().slice(0,7)}`;
    if (parseInt(localStorage.getItem(monthKey) || "0") >= 4) return;
    const t = setTimeout(() => {
      setShow(true);
      localStorage.setItem("mg_donation_last", String(Date.now()));
      localStorage.setItem(monthKey, String(parseInt(localStorage.getItem(monthKey)||"0") + 1));
      const idx = parseInt(localStorage.getItem("mg_donation_idx") || "0");
      localStorage.setItem("mg_donation_idx", String((idx + 1) % DONATION_MSGS.length));
    }, 2000);
    return () => clearTimeout(t);
  }, [createdAt]);
  return { show, close: () => setShow(false) };
}

// ── EMOJI PICKER ──────────────────────────────────────────────────────────────
const EMOJI_OPTIONS = ["💸","🦁","🐯","🦊","🐺","🦅","🐉","🌟","🚀","💎","⚡","🔥","🎯","🏆","💪","🧠","👑","🌙","🎲","🌊"];

function EmojiPickerModal({ onSave, onClose, current }: { onSave:(emoji:string,nick:string)=>void; onClose:()=>void; current?:{emoji?:string;nick?:string} }) {
  const [emoji, setEmoji] = useState(current?.emoji || "💸");
  const [nick, setNick]   = useState(current?.nick  || "");
  return (
    <Modal title="🎮 Sua identidade no ranking" onClose={onClose}>
      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        <div>
          <div style={{ fontSize:11, color:"var(--text2)", fontWeight:700, marginBottom:8, letterSpacing:1 }}>ESCOLHA SEU EMOJI</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
            {EMOJI_OPTIONS.map(e=>(
              <button key={e} onClick={()=>setEmoji(e)}
                style={{ width:44, height:44, fontSize:22, borderRadius:10, border:`2px solid ${emoji===e?"#820AD1":"var(--border)"}`, background:emoji===e?"rgba(130,10,209,0.15)":"var(--bg3)", cursor:"pointer" }}>
                {e}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label style={{ fontSize:11, color:"var(--text2)", fontWeight:700, display:"block", marginBottom:6, letterSpacing:1 }}>APELIDO (opcional)</label>
          <input placeholder={`Deixe em branco para usar ${emoji}`} value={nick} onChange={e=>setNick(e.target.value)} maxLength={20}/>
          <div style={{ fontSize:11, color:"var(--text2)", marginTop:4 }}>Aparece no ranking. Nenhum dado pessoal é exibido.</div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button className="btn-ghost" onClick={onClose} style={{ flex:1 }}>Cancelar</button>
          <button className="btn-primary" onClick={()=>onSave(emoji, nick.trim() || emoji)} style={{ flex:1 }}>Salvar identidade</button>
        </div>
      </div>
    </Modal>
  );
}

// ── DASHBOARD CONTENT ─────────────────────────────────────────────────────────
// ── SEÇÃO COLAPSÁVEL ─────────────────────────────────────────────────────────
function CollapsibleSection({ title, sub, defaultOpen=false, children }: { title:string; sub?:string; defaultOpen?:boolean; children:React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ background:"var(--bg2)", borderRadius:16, overflow:"hidden", marginBottom:8 }}>
      <div onClick={()=>setOpen(o=>!o)} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 16px", cursor:"pointer", userSelect:"none" as any }}>
        <div>
          <div style={{ fontSize:14, fontWeight:700, color:"var(--text)" }}>{title}</div>
          {sub && <div style={{ fontSize:11, color:"var(--text2)", marginTop:2 }}>{sub}</div>}
        </div>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ transition:"transform 0.25s", transform:open?"rotate(180deg)":"rotate(0deg)", flexShrink:0 }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>
      {open && <div style={{ borderTop:"0.5px solid var(--border)" }}>{children}</div>}
    </div>
  );
}

function SectionRow({ icon, iconBg, label, sub, value, valueColor, badge, bar, barPct, barColor }: any) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:12, padding:"11px 16px", borderBottom:"0.5px solid var(--border)" }}>
      {icon && (
        <div style={{ width:34, height:34, borderRadius:"50%", background:iconBg||"var(--bg3)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
          {icon}
        </div>
      )}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, color:"var(--text)", fontWeight:500 }}>{label}</div>
        {sub && <div style={{ fontSize:11, color:"var(--text2)", marginTop:1 }}>{sub}</div>}
        {bar && (
          <div style={{ height:3, background:"var(--bg3)", borderRadius:2, marginTop:5, overflow:"hidden" }}>
            <div style={{ height:"100%", width:`${barPct||0}%`, background:barColor||"var(--primary)", borderRadius:2, transition:"width 0.6s ease" }}/>
          </div>
        )}
      </div>
      <div style={{ textAlign:"right", flexShrink:0 }}>
        {value && <div style={{ fontSize:14, fontWeight:700, color:valueColor||"var(--text)", fontVariantNumeric:"tabular-nums" }} className="hideable">{value}</div>}
        {badge && <div style={{ fontSize:10, padding:"2px 8px", borderRadius:20, marginTop:3, background:badge.bg, color:badge.color, fontWeight:700 }}>{badge.label}</div>}
      </div>
    </div>
  );
}

function DashboardContent({ expenses,cc,incomes,salary,balance,totalExpSemSonho,totalCC,totalIncome,totalPaid,totalPending,extraNeeded,sonhoTotal,sonhoPago,sonhoRecorrente,sonhoProgresso,byCategory,streakDays,streakClaimed,healthScore,xp,onStreak,onCreditClick }: any) {
  const totalGasto = totalExpSemSonho + totalCC;
  const pendingCount = expenses.filter((e:any)=>!e.paid).length + cc.filter((c:any)=>!c.paid).length;
  const investTotal = byCategory.find((c:any)=>c.id===3)?.total||0;
  const sonhoItems = byCategory.find((c:any)=>c.id===6)?.items||[];

  return (
    <div style={{ paddingBottom:8 }}>

      {/* SEÇÃO 1 — Resumo */}
      <CollapsibleSection title="Resumo do mês" sub={new Date().toLocaleDateString("pt-BR",{month:"long",year:"numeric"})} defaultOpen={true}>
        <SectionRow
          icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#00d68f" strokeWidth="2.5" strokeLinecap="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/></svg>}
          iconBg="rgba(0,214,143,0.12)" label="Receita total" sub="Salário + extras"
          value={fmt(salary+totalIncome)} valueColor="var(--green)"
        />
        <SectionRow
          icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ff4d6a" strokeWidth="2.5" strokeLinecap="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/></svg>}
          iconBg="rgba(255,77,106,0.12)" label="Total gasto" sub="Todas as categorias"
          value={fmt(totalGasto)} valueColor="var(--red)"
        />
        <SectionRow
          icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={balance>=0?"#00d68f":"#ff4d6a"} strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>}
          iconBg={balance>=0?"rgba(0,214,143,0.12)":"rgba(255,77,106,0.12)"}
          label="Saldo livre" sub={`${salary+totalIncome>0?Math.round(balance/(salary+totalIncome)*100):0}% da receita`}
          value={fmt(balance)} valueColor={balance>=0?"var(--green)":"var(--red)"}
        />
        <div style={{ padding:"10px 16px", display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ fontSize:12, color:"var(--text2)", minWidth:80 }}>Saúde {healthScore}/100</div>
          <div style={{ flex:1, height:4, background:"var(--bg3)", borderRadius:2, overflow:"hidden" }}>
            <div style={{ height:"100%", width:`${healthScore}%`, background:`linear-gradient(90deg,#ff4d6a,#ffd700,#00d68f)`, borderRadius:2 }}/>
          </div>
          <div style={{ fontSize:12, fontWeight:700, color:healthScore<34?"var(--red)":healthScore<67?"var(--yellow)":"var(--green)" }}>{getHealthBand(healthScore).label}</div>
        </div>
      </CollapsibleSection>

      {/* SEÇÃO 2 — Contas e cartão */}
      <CollapsibleSection title="Contas e cartão" sub={pendingCount>0?`${pendingCount} pendente${pendingCount>1?"s":""}`:"Tudo em dia"}>
        {totalCC>0 && (
          <div onClick={onCreditClick} style={{ cursor:"pointer" }}>
            <SectionRow
              icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>}
              iconBg="rgba(167,139,250,0.12)" label="Cartão de crédito" sub={`${cc.length} lançamento${cc.length!==1?"s":""}`}
              value={fmt(totalCC)} valueColor="var(--yellow)"
              badge={{ label:"ver fatura", bg:"rgba(167,139,250,0.15)", color:"#a78bfa" }}
            />
          </div>
        )}
        {byCategory.filter((c:any)=>c.id===4&&c.items.length>0).flatMap((c:any)=>c.items).map((exp:any)=>(
          <SectionRow key={exp.id}
            icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={exp.paid?"#00d68f":"#ffd700"} strokeWidth="2" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
            iconBg={exp.paid?"rgba(0,214,143,0.1)":"rgba(255,215,0,0.1)"}
            label={exp.name} sub={exp.recurring?"Recorrente":exp.dueDate?`Vence ${new Date(exp.dueDate).toLocaleDateString("pt-BR")}`:undefined}
            value={fmt(num(exp.amount))} valueColor={exp.paid?"var(--text2)":"var(--text)"}
            badge={exp.paid?{label:"pago",bg:"rgba(0,214,143,0.12)",color:"#00d68f"}:{label:"pendente",bg:"rgba(255,77,106,0.12)",color:"#ff4d6a"}}
          />
        ))}
        {totalCC===0&&byCategory.filter((c:any)=>c.id===4).flatMap((c:any)=>c.items).length===0&&(
          <div style={{ padding:"16px", textAlign:"center", color:"var(--text2)", fontSize:13 }}>Nenhuma conta cadastrada</div>
        )}
        <div style={{ padding:"10px 16px", display:"flex", justifyContent:"space-between", fontSize:12 }}>
          <span style={{ color:"var(--text2)" }}>Pago: <span style={{ color:"var(--green)", fontWeight:700 }} className="hideable">{fmt(totalPaid)}</span></span>
          <span style={{ color:"var(--text2)" }}>Pendente: <span style={{ color:"var(--yellow)", fontWeight:700 }} className="hideable">{fmt(totalPending)}</span></span>
        </div>
      </CollapsibleSection>

      {/* SEÇÃO 3 — Investimentos e sonhos */}
      {(investTotal>0||sonhoTotal>0) && (
        <CollapsibleSection title="Investimentos e sonhos" sub="Este mês">
          {investTotal>0 && (
            <SectionRow
              icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#00d68f" strokeWidth="2.5" strokeLinecap="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>}
              iconBg="rgba(0,214,143,0.12)" label="Investimentos" sub="Capital alocado"
              value={fmt(investTotal)} valueColor="var(--green)"
              badge={{ label:`${salary+totalIncome>0?Math.round(investTotal/(salary+totalIncome)*100):0}% da receita`, bg:"rgba(0,214,143,0.1)", color:"#00d68f" }}
            />
          )}
          {sonhoTotal>0 && (
            <>
              <SectionRow
                icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" strokeWidth="2" strokeLinecap="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>}
                iconBg="rgba(6,182,212,0.12)" label="Sonhos" sub={sonhoRecorrente?`Meta: ${fmt(num(sonhoRecorrente.recurringGoal))}`:undefined}
                value={fmt(sonhoTotal)} valueColor="#06b6d4"
                badge={sonhoPago?{label:"pago",bg:"rgba(0,214,143,0.12)",color:"#00d68f"}:{label:"pendente",bg:"rgba(255,183,3,0.12)",color:"#ffd700"}}
                bar={!!sonhoRecorrente} barPct={sonhoProgresso} barColor="linear-gradient(90deg,#06b6d4,#8b5cf6)"
              />
            </>
          )}
        </CollapsibleSection>
      )}

      {/* SEÇÃO 4 — Por categoria (colapsada por padrão) */}
      <CollapsibleSection title="Por categoria" sub="Distribuição dos gastos">
        {byCategory.filter((c:any)=>c.total>0).map((cat:any)=>(
          <SectionRow key={cat.id}
            icon={<span style={{ fontSize:14 }}>{cat.emoji}</span>}
            iconBg="var(--bg3)" label={cat.name}
            value={fmt(cat.total)}
            bar={true} barPct={totalGasto>0?Math.min(cat.total/totalGasto*100,100):0} barColor={cat.color}
          />
        ))}
        {byCategory.every((c:any)=>c.total===0)&&(
          <div style={{ padding:"16px", textAlign:"center", color:"var(--text2)", fontSize:13 }}>Nenhum gasto registrado ainda</div>
        )}
      </CollapsibleSection>

      {/* STREAK — compacto */}
      <div onClick={onStreak} style={{ background:streakClaimed?"rgba(0,214,143,0.06)":"rgba(130,10,209,0.08)", border:`0.5px solid ${streakClaimed?"rgba(0,214,143,0.25)":"rgba(130,10,209,0.3)"}`, borderRadius:12, padding:"12px 16px", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:20 }}>{getStreakIcon(streakDays)}</span>
          <div>
            <div style={{ fontSize:11, color:"var(--text2)", fontWeight:700, textTransform:"uppercase", letterSpacing:0.8, marginBottom:1 }}>Streak diária</div>
            <div style={{ fontSize:14, fontWeight:700, color:streakClaimed?"var(--green)":"#c084fc" }}>
              {streakClaimed?`${streakDays} dias ✅`:`${streakDays} dias · resgatar`}
            </div>
          </div>
        </div>
        {!streakClaimed && <div style={{ fontSize:12, fontWeight:700, color:"#c084fc", background:"rgba(130,10,209,0.15)", border:"0.5px solid rgba(130,10,209,0.3)", padding:"4px 10px", borderRadius:8 }}>+{getStreakXP(streakDays+1)} XP</div>}
      </div>

      {/* IA */}
      <AIInsightButton salary={salary} totalExp={totalExpSemSonho} totalCC={totalCC} totalIncome={totalIncome} healthScore={healthScore} streakDays={streakDays} xp={xp}/>

      {/* META RENDA */}
      {extraNeeded>0 && (
        <div style={{ background:"var(--bg2)", borderRadius:12, padding:"12px 16px", marginBottom:8 }}>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"var(--text2)", marginBottom:6 }}>
            <span>Meta renda extra</span>
            <span className="hideable" style={{ color:"var(--green)", fontWeight:700 }}>{fmt(totalIncome)} / {fmt(extraNeeded)}</span>
          </div>
          <div style={{ height:4, background:"var(--bg3)", borderRadius:2, overflow:"hidden" }}>
            <div style={{ height:"100%", width:`${Math.min(totalIncome/extraNeeded*100,100)}%`, background:"var(--primary)", borderRadius:2, transition:"width 0.6s ease" }}/>
          </div>
        </div>
      )}
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState<User|null>(()=>{ try{return JSON.parse(sessionStorage.getItem("mg_user")||"null")}catch{return null} });
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [tab, setTab] = useState("dashboard");
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [cc, setCC] = useState<CC[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [salary, setSalary] = useState(0);
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
  const [showDonation, setShowDonation] = useState(false);
  const donation = useDonationPopup((user as any)?.createdAt);
  const [isPC, setIsPC] = useState(typeof window!=="undefined" && window.innerWidth>=1024);

  useEffect(()=>{ const h=()=>setIsPC(window.innerWidth>=1024); window.addEventListener("resize",h); return()=>window.removeEventListener("resize",h); },[]);

  const showToast = (msg:string) => setToast(msg);

  const gainXpRaw = useCallback(async (xpGain:number) => {
    if (!user) return;
    try {
      const res = await apiFetch(`${API}/users/${user.id}/xp`,{method:"POST",body:JSON.stringify({xpGain})});
      const data = await res.json();
      setXp(data.xp); setLevelNum(data.levelNum); setLevel(data.level);
      showToast(`+${xpGain} XP ⚔️`);
    } catch {}
  },[user]);

  const login = (u:User, token:string) => {
    sessionStorage.setItem("mg_token", token);
    sessionStorage.setItem("mg_user", JSON.stringify(u));
    setUser(u);
    setSalary(num(u.salaryBase));
    if (u.xp) setXp(u.xp);
    if (u.levelNum) setLevelNum(u.levelNum);
    if (u.level) setLevel(u.level);
    if (u.streakDays) setStreakDays(u.streakDays);
    if (u.isNewUser) setShowOnboarding(true);
    if (u.lastCheckin) {
      const today=new Date(); today.setHours(0,0,0,0);
      const last=new Date(u.lastCheckin); last.setHours(0,0,0,0);
      setStreakClaimed(last.getTime()===today.getTime());
    }
  };

  const logout = () => {
    sessionStorage.removeItem("mg_user");
    sessionStorage.removeItem("mg_token");
    setUser(null); setSalary(0);
  };

  const load = useCallback(async () => {
    if (!user) return;
    const [e,c,i] = await Promise.all([
      apiFetch(`${API}/users/${user.id}/expenses`).then(r=>r.json()).catch(()=>[]),
      apiFetch(`${API}/users/${user.id}/credit-card`).then(r=>r.json()).catch(()=>[]),
      apiFetch(`${API}/users/${user.id}/extra-income`).then(r=>r.json()).catch(()=>[]),
    ]);
    setExpenses(Array.isArray(e)?e:[]); setCC(Array.isArray(c)?c:[]); setIncomes(Array.isArray(i)?i:[]);
    try {
      const uRes = await apiFetch(`${API}/auth/me/${user.id}`);
      if (uRes.ok) {
        const uData = await uRes.json();
        if (uData.salaryBase !== undefined) setSalary(num(uData.salaryBase));
        // Sync streak do servidor — fonte de verdade
        if (uData.streakDays !== undefined) setStreakDays(num(uData.streakDays));
        if (uData.lastCheckin !== undefined) {
          const today = new Date(); today.setHours(0,0,0,0);
          const last = uData.lastCheckin ? new Date(uData.lastCheckin) : null;
          if (last) { last.setHours(0,0,0,0); setStreakClaimed(last.getTime()===today.getTime()); }
          else setStreakClaimed(false);
        }
      }
    } catch {}
  },[user]);

  useEffect(()=>{load();},[load]);

  useEffect(()=>{
    if (!expenses.length) return;
    const dueSoon = expenses.filter(e=>{ if (!e.dueDate||e.paid) return false; const diff=Math.ceil((new Date(e.dueDate).getTime()-new Date().getTime())/86400000); return diff>=0&&diff<=3; });
    if (dueSoon.length>0) setTimeout(()=>showToast(`⚠️ ${dueSoon.length} conta(s) vencem em breve!`),1500);
  },[expenses]);

  // Verifica se temos token salvo mas sem usuário (sessão antiga sem token)
  useEffect(()=>{
    if (user && !getToken()) logout();
  },[]);

  if (!user) return <Auth onLogin={login}/>;
  if (showOnboarding) return <Onboarding user={user} onDone={()=>{setShowOnboarding(false);load();}}/>;

  // CÁLCULOS
  const totalExpSemSonho = expenses.filter(e=>e.categoryId!==SONHO_ID).reduce((s,e)=>s+num(e.amount),0);
  const totalCC = cc.reduce((s,c)=>s+num(c.amount),0);
  const totalIncome = incomes.reduce((s,i)=>s+num(i.amount),0);
  const totalPaid = expenses.filter(e=>e.paid&&e.categoryId!==SONHO_ID).reduce((s,e)=>s+num(e.amount),0)+totalCC;
  const totalPending = totalExpSemSonho+totalCC-totalPaid;
  const balance = salary+totalIncome-totalExpSemSonho-totalCC;
  const extraNeeded = Math.max(0,totalExpSemSonho+totalCC-salary);
  const sonhoExp = expenses.filter(e=>Number(e.categoryId)===SONHO_ID);
  const sonhoTotal = sonhoExp.reduce((s,e)=>s+num(e.amount),0);
  const sonhoPago = sonhoExp.some(e=>!!e.paid);
  const sonhoRecorrente = sonhoExp.find(e=>e.recurring && num(e.recurringGoal)>0 && num(e.recurringMonths)>0);
  const sonhoProgresso = sonhoRecorrente ? Math.min(sonhoTotal/num(sonhoRecorrente.recurringGoal)*100,100) : 0;
  const byCategory = CATS.map(cat=>({...cat,items:expenses.filter(e=>Number(e.categoryId)===cat.id),total:expenses.filter(e=>Number(e.categoryId)===cat.id).reduce((s,e)=>s+num(e.amount),0)}));
  const healthScore = calcHealthScore(salary, totalExpSemSonho, totalIncome, totalPaid, totalExpSemSonho+totalCC, streakDays);

  const NAV = [
    {id:"dashboard",icon:"📊",label:"Dashboard"},
    {id:"expenses",icon:"💸",label:"Despesas"},
    {id:"credit",icon:"💳",label:"Cartão"},
    {id:"income",icon:"💵",label:"Renda"},
    {id:"ranking",icon:"🏆",label:"Ranking"},
    {id:"reports",icon:"📈",label:"Relatórios"},
  ];

  const onStreakClaim = (data:any) => { setXp(data.xp); setLevelNum(data.levelNum); setLevel(data.level); setStreakDays(data.streakDays); setStreakClaimed(true); showToast(`+${data.xpGained} XP 🔥 ${data.streakDays} dias!`); };

  const handleReset = async () => {
    const res = await apiFetch(`${API}/users/${user.id}/reset-month`,{method:"POST"});
    const data = await res.json();
    if (res.ok && data.user) {
      setXp(data.user.xp||xp); setLevelNum(data.user.levelNum||levelNum);
    }
    setShowReset(false); load();
    showToast("✅ Mês arquivado com sucesso!");
  };

  const sharedModals = (
    <>
      {toast&&<Toast msg={toast} onDone={()=>setToast("")}/>}
      {showStreak&&<StreakModal user={user} onClose={()=>setShowStreak(false)} onClaim={onStreakClaim}/>}
      {showAddExp&&<AddExpenseModal userId={user.id} onClose={()=>{setShowAddExp(false);load();}} onXp={gainXpRaw}/>}
      {showAddCC&&<AddCCModal userId={user.id} onClose={()=>{setShowAddCC(false);load();}} onXp={gainXpRaw}/>}
      {showAddIncome&&<AddIncomeModal userId={user.id} onClose={()=>{setShowAddIncome(false);load();}} onXp={gainXpRaw}/>}
      {showSettings&&<SettingsModal user={user} salary={salary} onSave={(s:number,newUser?:Partial<User>)=>{setSalary(s);if(newUser?.nickname!==undefined)setUser(u=>u?{...u,...newUser}:u);showToast("✅ Configurações salvas!");setShowSettings(false);}} onClose={()=>setShowSettings(false)} onReset={()=>{setShowSettings(false);setShowReset(true);}}/>}
      {showMethodology&&<MethodologyModal onClose={()=>setShowMethodology(false)}/>}
      {showReset&&<ResetModal onClose={()=>setShowReset(false)} onConfirm={handleReset}/>}
      {(showDonation||donation.show)&&<DonationPopup onClose={()=>{setShowDonation(false);donation.close();}}/>}
    </>
  );

  const dashProps = { expenses,cc,incomes,salary,balance,totalExpSemSonho,totalCC,totalIncome,totalPaid,totalPending,extraNeeded,sonhoTotal,sonhoPago,sonhoRecorrente,sonhoProgresso,byCategory,streakDays,streakClaimed,healthScore,xp,onStreak:()=>setShowStreak(true),onCreditClick:()=>setTab("credit") };

  // ── PC LAYOUT ─────────────────────────────────────────────────────────────
  if (isPC) return (
    <>
      {sharedModals}
      <div style={{ display:"flex", height:"100vh", overflow:"hidden", background:"var(--bg)" }}>
        <aside style={{ width:235, background:"var(--bg2)", borderRight:"1px solid var(--border)", display:"flex", flexDirection:"column", flexShrink:0, overflowY:"auto" }}>
          <div style={{ padding:"22px 18px 14px", borderBottom:"1px solid var(--border)" }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4 }}>
              <CoinIcon size={26}/>
              <span style={{ fontSize:16, fontWeight:900, background:"linear-gradient(135deg,#6c63ff,#b44fff)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>MONEYGAME</span>
            </div>
            <div style={{ fontSize:11, color:"var(--text2)", paddingLeft:36 }}>Olá, {user.nickname || user.name?.split(" ")[0]}! {user.emoji || "💸"}</div>
          </div>
          <div style={{ padding:"12px 16px", borderBottom:"1px solid var(--border)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:5 }}>
              <span style={{ fontSize:10, fontWeight:800, color:"#6c63ff" }}>⚔️ {level==="avancado"?"AVANÇADO":level==="investidor"?"INVESTIDOR":"INICIANTE"} NV.{levelNum}</span>
              <span style={{ fontSize:10, color:"var(--text2)" }}>{xp%1000}/1000</span>
            </div>
            <div className="xp-bar-wrap"><div className="xp-bar-fill" style={{ width:`${(xp%1000)/10}%` }}/></div>
            <div style={{ fontSize:9, color:"var(--text2)", marginTop:3 }}>{xp} XP total</div>
          </div>
          <div onClick={()=>setShowStreak(true)} style={{ margin:"10px 10px 0", padding:"11px 13px", borderRadius:12, cursor:"pointer", background:streakClaimed?"rgba(0,214,143,0.06)":"rgba(108,99,255,0.08)", border:`1px solid ${streakClaimed?"rgba(0,214,143,0.22)":"rgba(108,99,255,0.28)"}`, display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:36, height:36, borderRadius:10, background:streakClaimed?"rgba(0,214,143,0.12)":"rgba(108,99,255,0.15)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0 }}>{getStreakIcon(streakDays)}</div>
            <div>
              <div style={{ fontSize:9, color:"var(--text2)", fontWeight:700, textTransform:"uppercase", letterSpacing:0.5 }}>STREAK</div>
              <div style={{ fontSize:13, fontWeight:800, color:streakClaimed?"var(--green)":"#a78bfa" }}>{streakDays} dias {streakClaimed?"✅":`· +${getStreakXP(streakDays+1)}XP`}</div>
            </div>
          </div>
          <nav style={{ padding:"12px 10px", flex:1 }}>
            {NAV.map(n=>(
              <button key={n.id} onClick={()=>setTab(n.id)} style={{ width:"100%", display:"flex", alignItems:"center", gap:10, padding:"9px 13px", borderRadius:10, marginBottom:3, background:tab===n.id?"rgba(108,99,255,0.15)":"transparent", border:`1px solid ${tab===n.id?"rgba(108,99,255,0.28)":"transparent"}`, color:tab===n.id?"#a78bfa":"var(--text2)", fontSize:13, fontWeight:tab===n.id?700:500, cursor:"pointer", textAlign:"left", transition:"all 0.15s" }}>
                <span style={{ fontSize:16 }}>{n.icon}</span> {n.label}
              </button>
            ))}
          </nav>
          <div style={{ padding:"10px 10px 20px", borderTop:"1px solid var(--border)", display:"flex", flexDirection:"column", gap:6 }}>
            <button onClick={()=>setShowMethodology(true)} style={{ width:"100%", background:"var(--bg3)", border:"1px solid var(--border)", color:"var(--text2)", padding:"9px 12px", borderRadius:10, fontSize:12, textAlign:"left", cursor:"pointer" }}>📚 Metodologia</button>
            <button onClick={()=>setShowSettings(true)} style={{ width:"100%", background:"var(--bg3)", border:"1px solid var(--border)", color:"var(--text2)", padding:"9px 12px", borderRadius:10, fontSize:12, textAlign:"left", cursor:"pointer" }}>⚙️ Configurações</button>
            <button onClick={()=>setShowDonation(true)} style={{ width:"100%", background:"rgba(255,215,0,0.06)", border:"1px solid rgba(255,215,0,0.2)", color:"#c9a800", padding:"9px 12px", borderRadius:10, fontSize:12, textAlign:"left", cursor:"pointer" }}>☕ Pague um Ko-fi ao criador</button>
            <button onClick={logout} style={{ width:"100%", background:"rgba(255,77,106,0.08)", border:"1px solid rgba(255,77,106,0.2)", color:"var(--red)", padding:"9px 12px", borderRadius:10, fontSize:12, textAlign:"left", cursor:"pointer" }}>🚪 Sair</button>
          </div>
        </aside>
        <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
          <div style={{ background:"var(--bg2)", borderBottom:"1px solid var(--border)", padding:"14px 22px", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
            <div>
              <h1 style={{ fontSize:19, fontWeight:900, color:"var(--text)", margin:0 }}>{NAV.find(n=>n.id===tab)?.icon} {NAV.find(n=>n.id===tab)?.label}</h1>
              <div style={{ fontSize:11, color:"var(--text2)", marginTop:2 }}>{new Date().toLocaleDateString("pt-BR",{weekday:"long",day:"numeric",month:"long"})}</div>
            </div>
            <div style={{ display:"flex", gap:10 }}>
              {[{label:"Saldo",value:fmt(balance),color:balance>=0?"var(--green)":"var(--red)"},{label:"Despesas",value:fmt(totalExpSemSonho+totalCC),color:"var(--red)"},{label:"Saúde",value:`${healthScore}/100`,color:getHealthBand(healthScore).color}].map((k,i)=>(
                <div key={i} style={{ background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:10, padding:"7px 13px", textAlign:"center" }}>
                  <div style={{ fontSize:9, color:"var(--text2)", fontWeight:700, textTransform:"uppercase", letterSpacing:0.5 }}>{k.label}</div>
                  <div style={{ fontSize:14, fontWeight:800, fontVariantNumeric:"tabular-nums", color:k.color }}>{k.value}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ flex:1, overflowY:"auto", padding:"20px 22px" }}>
            <XPLevel xp={xp} level={level} levelNum={levelNum}/>
            {tab==="dashboard"&&<DashboardContent {...dashProps}/>}
            {tab==="expenses"&&<ExpensesContent expenses={expenses} byCategory={byCategory} onAdd={()=>setShowAddExp(true)} onPay={async(exp:Expense)=>{ await apiFetch(`${API}/expenses/${exp.id}/paid`,{method:"PATCH",body:JSON.stringify({paid:!exp.paid})}); if(!exp.paid)gainXpRaw(XP_PAY_BILL); load(); }} onDelete={async(id:number)=>{ await apiFetch(`${API}/expenses/${id}`,{method:"DELETE"}); load(); }}/>}
            {tab==="credit"&&<CreditContent cc={cc} totalCC={totalCC} onAdd={()=>setShowAddCC(true)} onDelete={async(id:number)=>{ await apiFetch(`${API}/credit-card/${id}`,{method:"DELETE"}); load(); }}/>}
            {tab==="income"&&<IncomeContent incomes={incomes} totalIncome={totalIncome} extraNeeded={extraNeeded} onAdd={()=>setShowAddIncome(true)} onDelete={async(id:number)=>{ await apiFetch(`${API}/extra-income/${id}`,{method:"DELETE"}); load(); }}/>}
            {tab==="ranking"&&<RankingContent currentUserId={user.id}/>}
            {tab==="reports"&&<ReportsContent byCategory={byCategory} totalExpSemSonho={totalExpSemSonho} totalCC={totalCC} totalIncome={totalIncome} expenses={expenses} cc={cc} xp={xp} userId={user.id} salary={salary} healthScore={healthScore}/>}
          </div>
        </div>
      </div>
    </>
  );

  // ── MOBILE LAYOUT ─────────────────────────────────────────────────────────
  const [valuesHidden, setValuesHidden] = useState(false);

  // Aba Perfil — abre Settings diretamente (fix tela preta)
  const ProfileTab = () => {
    useEffect(() => { setShowSettings(true); setTab("dashboard"); }, []);
    return null;
  };

  return (
    <div style={{ minHeight:"100vh", paddingBottom:16, background:"var(--bg)" }}>
      {sharedModals}

      {/* HEADER ROXO */}
      <div style={{ background:"#820AD1", padding:"20px 18px 24px", position:"sticky", top:0, zIndex:50 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
          {/* Avatar — abre configurações */}
          <button onClick={()=>setShowSettings(true)} style={{ width:38, height:38, borderRadius:"50%", background:"rgba(255,255,255,0.2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, border:"none", cursor:"pointer" }}>{user.emoji||"💸"}</button>
          <div style={{ display:"flex", gap:14 }}>
            <button onClick={()=>setValuesHidden(h=>!h)} style={{ background:"none", border:"none", cursor:"pointer", padding:4 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                {valuesHidden
                  ? <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>
                  : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>
                }
              </svg>
            </button>
            <button onClick={()=>setShowMethodology(true)} style={{ background:"none", border:"none", cursor:"pointer", padding:4 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </button>
          </div>
        </div>
        <div style={{ fontSize:12, color:"rgba(255,255,255,0.7)", marginBottom:4 }}>Olá, {user.nickname||user.name?.split(" ")[0]}</div>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div>
            <div style={{ fontSize:26, fontWeight:600, color:"white", filter:valuesHidden?"blur(8px)":"none", transition:"filter 0.2s", userSelect:valuesHidden?"none" as any:"auto" }}>{fmt(balance)}</div>
            <div style={{ fontSize:11, color:"rgba(255,255,255,0.6)", marginTop:2 }}>saldo livre este mês</div>
          </div>
          <div onClick={()=>setShowStreak(true)} style={{ marginLeft:"auto", background:"rgba(255,255,255,0.15)", border:"0.5px solid rgba(255,255,255,0.25)", borderRadius:20, padding:"4px 10px", fontSize:11, color:"white", display:"flex", alignItems:"center", gap:4, cursor:"pointer" }}>
            <span style={{ fontSize:14 }}>{getStreakIcon(streakDays)}</span> {streakDays} dias
          </div>
        </div>
      </div>

      {/* AÇÕES RÁPIDAS — Cartão integrado em Despesas */}
      <div style={{ display:"flex", justifyContent:"space-around", background:"var(--bg2)", padding:"14px 8px 12px", borderBottom:"0.5px solid var(--border)", marginBottom:10 }}>
        {[
          {label:"Despesa", action:()=>setShowAddExp(true), icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>},
          {label:"Cartão",  action:()=>setTab("credit"),   icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>},
          {label:"Renda",   action:()=>setShowAddIncome(true), icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/></svg>},
          {label:"Mais",    action:()=>setTab("expenses"), icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>},
        ].map((a,i)=>(
          <button key={i} onClick={a.action} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:6, background:"none", border:"none", cursor:"pointer" }}>
            <div style={{ width:44, height:44, borderRadius:"50%", background:"var(--bg3)", display:"flex", alignItems:"center", justifyContent:"center" }}>{a.icon}</div>
            <span style={{ fontSize:11, color:"var(--text2)" }}>{a.label}</span>
          </button>
        ))}
      </div>

      {/* CONTEÚDO — sem nav inferior */}
      <main style={{ padding:"0 12px" }}>
        <style>{valuesHidden ? `.hideable{filter:blur(6px);user-select:none;transition:filter 0.2s}` : `.hideable{filter:none;transition:filter 0.2s}`}</style>

        {tab==="dashboard" && (
          <>
            <DashboardContent {...dashProps}/>
            <button onClick={()=>setTab("ranking")} style={{ width:"100%", background:"var(--bg2)", border:"0.5px solid var(--border)", borderRadius:12, padding:"10px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", cursor:"pointer", marginBottom:10 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, fontSize:12, color:"var(--text2)" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text2)" strokeWidth="2" strokeLinecap="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                Ver minha posição no ranking
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text2)" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
            <button onClick={()=>setShowDonation(true)} style={{ width:"100%", background:"rgba(255,215,0,0.06)", border:"0.5px solid rgba(255,215,0,0.2)", borderRadius:12, padding:"10px 16px", display:"flex", alignItems:"center", gap:8, cursor:"pointer", marginBottom:10 }}>
              <span style={{ fontSize:14 }}>☕</span>
              <span style={{ fontSize:12, color:"#c9a800" }}>Pague um Ko-fi ao criador</span>
            </button>
          </>
        )}
        {tab==="expenses"&&<ExpensesContent expenses={expenses} byCategory={byCategory} onAdd={()=>setShowAddExp(true)} onPay={async(exp:Expense)=>{ await apiFetch(`${API}/expenses/${exp.id}/paid`,{method:"PATCH",body:JSON.stringify({paid:!exp.paid})}); if(!exp.paid)gainXpRaw(XP_PAY_BILL); load(); }} onDelete={async(id:number)=>{ await apiFetch(`${API}/expenses/${id}`,{method:"DELETE"}); load(); }}/>}
        {tab==="credit"&&(
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
              <button onClick={()=>setTab("dashboard")} style={{ background:"var(--bg2)", border:"0.5px solid var(--border)", borderRadius:8, padding:"6px 10px", color:"var(--text2)", fontSize:12, cursor:"pointer" }}>← Voltar</button>
              <h2 style={{ fontSize:16, fontWeight:700 }}>Cartão de Crédito</h2>
            </div>
            <CreditContent cc={cc} totalCC={totalCC} onAdd={()=>setShowAddCC(true)} onDelete={async(id:number)=>{ await apiFetch(`${API}/credit-card/${id}`,{method:"DELETE"}); load(); }}/>
          </div>
        )}
        {tab==="income"&&<IncomeContent incomes={incomes} totalIncome={totalIncome} extraNeeded={extraNeeded} onAdd={()=>setShowAddIncome(true)} onDelete={async(id:number)=>{ await apiFetch(`${API}/extra-income/${id}`,{method:"DELETE"}); load(); }}/>}
        {tab==="ranking"&&(
          <div>
            <button onClick={()=>setTab("dashboard")} style={{ background:"var(--bg2)", border:"0.5px solid var(--border)", borderRadius:8, padding:"6px 10px", color:"var(--text2)", fontSize:12, cursor:"pointer", marginBottom:14 }}>← Voltar</button>
            <RankingContent currentUserId={user.id}/>
          </div>
        )}
        {tab==="reports"&&<ReportsContent byCategory={byCategory} totalExpSemSonho={totalExpSemSonho} totalCC={totalCC} totalIncome={totalIncome} expenses={expenses} cc={cc} xp={xp} userId={user.id} salary={salary} healthScore={healthScore}/>}
      </main>
    </div>
  );
}


// ── ABA DESPESAS ──────────────────────────────────────────────────────────────
function ExpensesContent({ expenses,byCategory,onAdd,onPay,onDelete }: any) {
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <h2 style={{ fontSize:17, fontWeight:800 }}>💸 Despesas</h2>
        <button className="btn-primary" onClick={onAdd} style={{ padding:"9px 16px", fontSize:13 }}>+ Adicionar</button>
      </div>
      {byCategory.map((cat:any)=>(
        <div key={cat.id} className="card" style={{ marginBottom:10 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:cat.items.length?10:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontSize:17 }}>{cat.emoji}</span>
              <span style={{ fontWeight:700, fontSize:14 }}>{cat.name}</span>
            </div>
            <span style={{ fontWeight:800, fontSize:14, fontVariantNumeric:"tabular-nums", color:cat.total>0?"var(--text)":"var(--text2)" }}>{cat.total>0?fmt(cat.total):"—"}</span>
          </div>
          {cat.items.map((exp:any)=>(
            <div key={exp.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 0", borderTop:"1px solid var(--border)" }}>
              <button onClick={()=>onPay(exp)} style={{ width:22, height:22, borderRadius:6, border:`1.5px solid ${exp.paid?"var(--green)":"var(--border)"}`, background:exp.paid?"rgba(0,214,143,0.15)":"transparent", flexShrink:0, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11 }}>{exp.paid?"✓":""}</button>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:600, textDecoration:exp.paid?"line-through":"none", color:exp.paid?"var(--text2)":"var(--text)" }}>{exp.name}</div>
                {exp.subcategory&&<div style={{ fontSize:11, color:"var(--text2)" }}>{exp.subcategory}</div>}
                {exp.dueDate&&<div style={{ fontSize:10, color:"var(--text2)" }}>Vence: {new Date(exp.dueDate).toLocaleDateString("pt-BR")}</div>}
              </div>
              <span style={{ fontWeight:700, fontSize:13, fontVariantNumeric:"tabular-nums", color:exp.paid?"var(--green)":"var(--text)" }}>{fmt(num(exp.amount))}</span>
              <button className="btn-danger" onClick={()=>onDelete(exp.id)} style={{ padding:"5px 8px", fontSize:11 }}>🗑</button>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── ABA CARTÃO ────────────────────────────────────────────────────────────────
function CreditContent({ cc,totalCC,onAdd,onDelete }: any) {
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <h2 style={{ fontSize:17, fontWeight:800 }}>💳 Cartão</h2>
        <button className="btn-primary" onClick={onAdd} style={{ padding:"9px 16px", fontSize:13 }}>+ Adicionar</button>
      </div>
      <div className="card" style={{ marginBottom:14, borderTop:"3px solid var(--yellow)" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ fontSize:10, color:"var(--text2)", fontWeight:700, textTransform:"uppercase" }}>Total da Fatura</div>
            <div style={{ fontSize:26, fontWeight:900, fontVariantNumeric:"tabular-nums", color:"var(--yellow)" }}>{fmt(totalCC)}</div>
          </div>
          <span style={{ fontSize:38 }}>💳</span>
        </div>
      </div>
      {cc.length===0&&<div className="card" style={{ textAlign:"center", color:"var(--text2)", padding:38 }}>Nenhum gasto no cartão</div>}
      {cc.map((c:CC)=>(
        <div key={c.id} className="card" style={{ display:"flex", alignItems:"center", gap:12, padding:"11px 14px", marginBottom:7 }}>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:600, fontSize:14 }}>{c.description}</div>
            {c.subcategory&&<div style={{ fontSize:11, color:"var(--text2)" }}>{c.subcategory}</div>}
          </div>
          <span style={{ fontWeight:800, fontVariantNumeric:"tabular-nums", color:"var(--yellow)" }}>{fmt(num(c.amount))}</span>
          <button className="btn-danger" onClick={()=>onDelete(c.id)}>🗑</button>
        </div>
      ))}
    </div>
  );
}

// ── ABA RENDA EXTRA ───────────────────────────────────────────────────────────
function IncomeContent({ incomes,totalIncome,extraNeeded,onAdd,onDelete }: any) {
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <h2 style={{ fontSize:17, fontWeight:800 }}>💵 Renda Extra</h2>
        <button className="btn-primary" onClick={onAdd} style={{ padding:"9px 16px", fontSize:13 }}>+ Registrar</button>
      </div>
      <div className="card" style={{ marginBottom:14, borderTop:"3px solid var(--green)" }}>
        <div style={{ display:"flex", justifyContent:"space-between" }}>
          <div>
            <div style={{ fontSize:10, color:"var(--text2)", fontWeight:700, textTransform:"uppercase" }}>Total Ganho</div>
            <div style={{ fontSize:26, fontWeight:900, fontVariantNumeric:"tabular-nums", color:"var(--green)" }}>{fmt(totalIncome)}</div>
          </div>
          {extraNeeded>0&&<div style={{ textAlign:"right" }}>
            <div style={{ fontSize:10, color:"var(--text2)" }}>Meta necessária</div>
            <div style={{ fontSize:17, fontWeight:700, fontVariantNumeric:"tabular-nums", color:"var(--yellow)" }}>{fmt(extraNeeded)}</div>
          </div>}
        </div>
        {extraNeeded>0&&<div className="progress-bar" style={{ marginTop:10 }}><div className="progress-fill" style={{ width:`${Math.min(totalIncome/extraNeeded*100,100)}%`, background:"linear-gradient(90deg,var(--green),var(--primary))" }}/></div>}
      </div>
      {incomes.length===0&&<div className="card" style={{ textAlign:"center", color:"var(--text2)", padding:38 }}>Nenhuma renda extra registrada</div>}
      {incomes.map((inc:Income)=>(
        <div key={inc.id} className="card" style={{ display:"flex", alignItems:"center", gap:12, padding:"11px 14px", marginBottom:7 }}>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:600, fontSize:14 }}>{inc.description}</div>
            <div style={{ fontSize:11, color:"var(--text2)" }}>{new Date(inc.date).toLocaleDateString("pt-BR")}</div>
          </div>
          <span style={{ fontWeight:800, fontVariantNumeric:"tabular-nums", color:"var(--green)" }}>+{fmt(num(inc.amount))}</span>
          <button className="btn-danger" onClick={()=>onDelete(inc.id)}>🗑</button>
        </div>
      ))}
    </div>
  );
}

// ── ABA RELATÓRIOS ────────────────────────────────────────────────────────────
function ReportsContent({ byCategory,totalExpSemSonho,totalCC,totalIncome,expenses,cc,xp,userId,salary,healthScore }: any) {
  const [history, setHistory] = useState<any[]>([]);
  const [loadingH, setLoadingH] = useState(true);

  useEffect(()=>{
    setLoadingH(true);
    apiFetch(`${API}/users/${userId}/history`).then(r=>r.json()).then(d=>{ setHistory(Array.isArray(d)?d:[]); }).catch(()=>setHistory([])).finally(()=>setLoadingH(false));
  },[userId]);

  const band = getHealthBand(healthScore);
  const monthLabel = new Date().toLocaleDateString("pt-BR",{month:"long",year:"numeric"});

  return (
    <div>
      <h2 style={{ fontSize:17, fontWeight:800, marginBottom:14 }}>📈 Relatórios</h2>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
        {[
          { label:"Despesas",    value:fmt(totalExpSemSonho+totalCC), color:"var(--red)"     },
          { label:"Renda Extra", value:fmt(totalIncome),              color:"var(--green)"   },
          { label:"Registros",   value:`${expenses.length+cc.length}`,color:"var(--primary)" },
          { label:"XP Total",    value:`${xp} XP`,                   color:"var(--yellow)"  },
        ].map((k,i)=>(
          <div key={i} className="card" style={{ borderTop:`3px solid ${k.color}` }}>
            <div style={{ fontSize:10, color:"var(--text2)", fontWeight:700, textTransform:"uppercase", marginBottom:4 }}>{k.label}</div>
            <div style={{ fontSize:17, fontWeight:800, fontVariantNumeric:"tabular-nums", color:k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginBottom:14 }}>
        <div style={{ fontSize:13, fontWeight:700, marginBottom:10 }}>💚 Saúde Financeira — {monthLabel}</div>
        <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:10 }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:32, fontWeight:900, color:band.color, fontVariantNumeric:"tabular-nums" }}>{healthScore}<span style={{ fontSize:14, color:"var(--text2)" }}>/100</span></div>
            <div style={{ fontSize:14, fontWeight:700, color:band.color }}>{band.label}</div>
            <div style={{ fontSize:12, color:"var(--text2)", marginTop:3, lineHeight:1.4 }}>{band.desc}</div>
          </div>
          <div>
            {[{min:83,label:"Ótima",c:"#00d68f"},{min:69,label:"Muito Boa",c:"#4ade80"},{min:61,label:"Boa",c:"#a3e635"},{min:57,label:"Ok",c:"#facc15"},{min:50,label:"Baixa",c:"#fb923c"},{min:37,label:"Muito Baixa",c:"#f97316"},{min:0,label:"Ruim",c:"#ff4d6a"}].map((b,i)=>(
              <div key={i} style={{ display:"flex", alignItems:"center", gap:6, marginBottom:3 }}>
                <div style={{ width:8, height:8, borderRadius:2, background:b.c, flexShrink:0, opacity:healthScore>=b.min?1:0.3 }}/>
                <span style={{ fontSize:11, color:healthScore>=b.min?"var(--text)":"var(--text2)", fontWeight:healthScore>=b.min?700:400 }}>{b.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ height:8, background:"var(--bg3)", borderRadius:4, overflow:"hidden" }}>
          <div style={{ height:"100%", width:`${healthScore}%`, background:`linear-gradient(90deg,#ff4d6a,#fb923c,#facc15,#a3e635,#00d68f)`, transition:"width 1s ease" }}/>
        </div>
      </div>

      <div className="card" style={{ marginBottom:14 }}>
        <div style={{ fontSize:13, fontWeight:700, marginBottom:14 }}>📊 Gastos por Pote — {monthLabel}</div>
        <BarChart data={byCategory.map((cat:any)=>({label:cat.name,value:cat.total,color:cat.color,emoji:cat.emoji}))}/>
      </div>

      <div className="card" style={{ marginBottom:14 }}>
        <div style={{ fontSize:13, fontWeight:700, marginBottom:12 }}>🏺 Distribuição por Pote</div>
        {byCategory.filter((c:any)=>c.total>0).map((cat:any)=>(
          <div key={cat.id} style={{ marginBottom:10 }}>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:4 }}>
              <span style={{ fontWeight:600 }}>{cat.emoji} {cat.name}</span>
              <span style={{ fontWeight:700, fontVariantNumeric:"tabular-nums" }}>{fmt(cat.total)} · {(totalExpSemSonho+totalCC)>0?Math.round(cat.total/(totalExpSemSonho+totalCC)*100):0}%</span>
            </div>
            <div className="progress-bar"><div className="progress-fill" style={{ width:`${(totalExpSemSonho+totalCC)>0?Math.min(cat.total/(totalExpSemSonho+totalCC)*100,100):0}%`, background:cat.color }}/></div>
          </div>
        ))}
        {byCategory.every((c:any)=>c.total===0)&&<div style={{ textAlign:"center", color:"var(--text2)", padding:16, fontSize:13 }}>Nenhum gasto registrado ainda</div>}
      </div>

      <div className="card" style={{ marginBottom:14 }}>
        <div style={{ fontSize:13, fontWeight:700, marginBottom:12 }}>📅 Histórico de Meses</div>
        {loadingH ? (
          <div style={{ textAlign:"center", color:"var(--text2)", padding:16 }}>Carregando...</div>
        ) : history.length===0 ? (
          <div style={{ textAlign:"center", color:"var(--text2)", padding:16, fontSize:13, lineHeight:1.5 }}>
            Nenhum mês arquivado ainda.<br/>Use "Virar Mês" em Configurações ao final de cada mês.
          </div>
        ) : (
          <>
            <div style={{ display:"flex", alignItems:"flex-end", gap:6, height:80, marginBottom:14, paddingBottom:2 }}>
              {history.slice().reverse().map((h:any,i:number)=>{
                const maxVal = Math.max(...history.map((x:any)=>x.totalExpenses),1);
                const pct = Math.max(h.totalExpenses/maxVal*70, 4);
                const isPositive = h.balance >= 0;
                return (
                  <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
                    <div style={{ width:"100%", borderRadius:"3px 3px 0 0", background:isPositive?"var(--green)":"var(--red)", height:`${pct}px`, transition:"height .6s", opacity:0.85 }}/>
                    <div style={{ fontSize:8, color:"var(--text2)", textAlign:"center", whiteSpace:"nowrap" }}>{h.month.slice(5)}/{h.month.slice(2,4)}</div>
                  </div>
                );
              })}
            </div>
            {history.map((h:any,i:number)=>(
              <div key={i} style={{ padding:"10px 12px", background:"var(--bg3)", borderRadius:10, marginBottom:7, borderLeft:`3px solid ${h.balance>=0?"var(--green)":"var(--red)"}` }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                  <span style={{ fontWeight:700, fontSize:13 }}>
                    {new Date(h.month+"-01").toLocaleDateString("pt-BR",{month:"long",year:"numeric"})}
                  </span>
                  <span style={{ fontSize:12, fontWeight:800, color:h.balance>=0?"var(--green)":"var(--red)", fontVariantNumeric:"tabular-nums" }}>
                    {h.balance>=0?"+":""}{fmt(h.balance)}
                  </span>
                </div>
                <div style={{ display:"flex", gap:14, fontSize:11, color:"var(--text2)" }}>
                  <span>💸 {fmt(h.totalExpenses)}</span>
                  <span>💵 {fmt(h.totalIncome)}</span>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      <div className="card" style={{ marginBottom:14 }}>
        <div style={{ fontSize:13, fontWeight:700, marginBottom:12 }}>⚔️ Como ganhar XP</div>
        {[
          {label:"Renda extra registrada",desc:"1 real = 1 XP",color:"var(--green)",emoji:"💵"},
          {label:"Despesa ou cartão",desc:"1 real = 0,05 XP",color:"var(--primary)",emoji:"💸"},
          {label:"Conta marcada como paga",desc:"+15 XP fixo",color:"var(--purple)",emoji:"✅"},
          {label:"Streak diária",desc:"10 XP + 5 por dia",color:"#f97316",emoji:"🔥"},
        ].map((r,i)=>(
          <div key={i} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 0", borderBottom:i<3?"1px solid var(--border)":"none" }}>
            <span style={{ fontSize:17 }}>{r.emoji}</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:600 }}>{r.label}</div>
              <div style={{ fontSize:11, color:"var(--text2)" }}>{r.desc}</div>
            </div>
            <div style={{ width:8, height:8, borderRadius:4, background:r.color }}/>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── MODAIS ────────────────────────────────────────────────────────────────────
function AddExpenseModal({ userId, onClose, onXp }: any) {
  const [form, setForm] = useState({ categoryId:"4", name:"", amount:"", subcategory:"", dueDate:"", recurring:false, recurringMonths:"", recurringGoal:"" });
  const [loading, setLoading] = useState(false);
  const isSonho = parseInt(form.categoryId)===SONHO_ID;

  const submit = async () => {
    const sonhoAutoCalc = isSonho && form.recurring && form.recurringGoal && form.recurringMonths;
    if (!form.name) return;
    if (!sonhoAutoCalc && !form.amount) return;
    setLoading(true);
    try {
      const computedAmount = sonhoAutoCalc && (!form.amount || parseFloat(form.amount) <= 0)
        ? parseFloat(form.recurringGoal) / parseInt(form.recurringMonths)
        : parseFloat(form.amount);
      const payload: any = {
        categoryId: parseInt(form.categoryId), name: form.name, amount: computedAmount,
        subcategory: form.subcategory || undefined, dueDate: form.dueDate || undefined,
        recurring: form.recurring ? 1 : 0,
      };
      if (sonhoAutoCalc) { payload.recurringGoal = parseFloat(form.recurringGoal); payload.recurringMonths = parseInt(form.recurringMonths); }
      const res = await apiFetch(`${API}/users/${userId}/expenses`,{method:"POST",body:JSON.stringify(payload)});
      if (res.ok) { onXp(calcXpExpense(computedAmount)); onClose(); }
    } catch {}
    setLoading(false);
  };

  const monthlyCalc = isSonho && form.recurring && form.recurringGoal && form.recurringMonths
    ? parseFloat(form.recurringGoal) / parseInt(form.recurringMonths) : null;

  return (
    <Modal title="💸 Nova Despesa" onClose={onClose}>
      <div style={{ display:"flex", flexDirection:"column", gap:11 }}>
        <select value={form.categoryId} onChange={e=>setForm(f=>({...f,categoryId:e.target.value}))}>
          {CATS.map(c=><option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
        </select>
        <input placeholder="Nome da despesa *" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/>
        <input type="number" placeholder={isSonho&&form.recurring?"Valor mensal (deixe em branco p/ calcular)":"Valor (R$) *"} value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))}/>
        <input placeholder="Subcategoria (opcional)" value={form.subcategory} onChange={e=>setForm(f=>({...f,subcategory:e.target.value}))}/>
        <input type="date" value={form.dueDate} onChange={e=>setForm(f=>({...f,dueDate:e.target.value}))}/>
        <label style={{ display:"flex", alignItems:"center", gap:8, fontSize:13, color:"var(--text2)", cursor:"pointer" }}>
          <input type="checkbox" checked={form.recurring} onChange={e=>setForm(f=>({...f,recurring:e.target.checked}))}/> Recorrente 🔄
        </label>
        {isSonho && form.recurring && (
          <div style={{ background:"rgba(6,182,212,0.07)", border:"1px solid rgba(6,182,212,0.22)", borderRadius:12, padding:"12px 14px", display:"flex", flexDirection:"column", gap:9 }}>
            <div style={{ fontSize:10, color:"#06b6d4", fontWeight:800, textTransform:"uppercase", letterSpacing:1 }}>✨ META DO SONHO</div>
            <input type="number" placeholder="Valor total do sonho (R$)" value={form.recurringGoal} onChange={e=>setForm(f=>({...f,recurringGoal:e.target.value}))}/>
            <input type="number" placeholder="Em quantos meses?" value={form.recurringMonths} onChange={e=>setForm(f=>({...f,recurringMonths:e.target.value}))}/>
            {monthlyCalc !== null && (
              <div style={{ fontSize:12, color:"var(--green)", fontWeight:600 }}>
                📅 {fmt(monthlyCalc)}/mês durante {form.recurringMonths} meses
              </div>
            )}
          </div>
        )}
        <div style={{ display:"flex", gap:8, marginTop:2 }}>
          <button className="btn-ghost" onClick={onClose} style={{ flex:1 }}>Cancelar</button>
          <button className="btn-primary" onClick={submit} disabled={loading||!form.name||(!(isSonho&&form.recurring&&form.recurringGoal&&form.recurringMonths)&&!form.amount)} style={{ flex:1 }}>{loading?"...":"Adicionar"}</button>
        </div>
      </div>
    </Modal>
  );
}

function AddCCModal({ userId, onClose, onXp }: any) {
  const [form, setForm] = useState({ subcategory:"Outros", description:"", amount:"" });
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    if (!form.description||!form.amount) return;
    setLoading(true);
    try {
      const res = await apiFetch(`${API}/users/${userId}/credit-card`,{method:"POST",body:JSON.stringify({...form,amount:parseFloat(form.amount)})});
      if (res.ok) { onXp(calcXpExpense(parseFloat(form.amount))); onClose(); }
    } catch {}
    setLoading(false);
  };
  return (
    <Modal title="💳 Gasto no Cartão" onClose={onClose}>
      <div style={{ display:"flex", flexDirection:"column", gap:11 }}>
        <select value={form.subcategory} onChange={e=>setForm(f=>({...f,subcategory:e.target.value}))}>{CC_CATS.map(c=><option key={c}>{c}</option>)}</select>
        <input placeholder="Descrição *" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))}/>
        <input type="number" placeholder="Valor (R$) *" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))}/>
        <div style={{ display:"flex", gap:8 }}>
          <button className="btn-ghost" onClick={onClose} style={{ flex:1 }}>Cancelar</button>
          <button className="btn-primary" onClick={submit} disabled={loading||!form.description||!form.amount} style={{ flex:1 }}>{loading?"...":"Adicionar"}</button>
        </div>
      </div>
    </Modal>
  );
}

function AddIncomeModal({ userId, onClose, onXp }: any) {
  const [form, setForm] = useState({ description:"", amount:"" });
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    if (!form.description||!form.amount) return;
    setLoading(true);
    try {
      const res = await apiFetch(`${API}/users/${userId}/extra-income`,{method:"POST",body:JSON.stringify({...form,amount:parseFloat(form.amount)})});
      if (res.ok) { onXp(calcXpIncome(parseFloat(form.amount))); onClose(); }
    } catch {}
    setLoading(false);
  };
  return (
    <Modal title="💵 Renda Extra" onClose={onClose}>
      <div style={{ display:"flex", flexDirection:"column", gap:11 }}>
        <input placeholder="Descrição (ex: Freelance, Venda...) *" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))}/>
        <input type="number" placeholder="Valor (R$) *" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))}/>
        {form.amount&&parseFloat(form.amount)>0&&(
          <div style={{ fontSize:12, color:"var(--green)", fontWeight:600, padding:"8px 12px", background:"rgba(0,214,143,0.08)", borderRadius:8 }}>
            ⚔️ +{calcXpIncome(parseFloat(form.amount))} XP com esse registro!
          </div>
        )}
        <div style={{ display:"flex", gap:8 }}>
          <button className="btn-ghost" onClick={onClose} style={{ flex:1 }}>Cancelar</button>
          <button className="btn-primary" onClick={submit} disabled={loading||!form.description||!form.amount} style={{ flex:1 }}>{loading?"...":"Registrar"}</button>
        </div>
      </div>
    </Modal>
  );
}

// ── SETTINGS MODAL — agora com emoji + apelido ────────────────────────────────
function SettingsModal({ user, salary, onSave, onClose, onReset }: any) {
  const [s, setS] = useState(String(salary||""));
  const [nick, setNick] = useState(user.nickname || "");
  const [emoji, setEmoji] = useState(user.emoji || "💸");
  const [loading, setLoading] = useState(false);
  const EMOJIS = ["💸","💰","🤑","💎","👑","🦁","🐉","🚀","⚡","🔥","🎯","🌟","💪","🧠","🎮","🏆","🦅","🌈","⚔️","🛡️"];

  const save = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`${API}/users/${user.id}/settings`,{method:"PUT",body:JSON.stringify({
        salaryBase: s ? parseFloat(s) : undefined,
        nickname: nick.trim() || null,
        emoji: emoji,
      })});
      const data = await res.json();
      if (res.ok) {
        onSave(parseFloat((data.salaryBase ?? s) || "0"), { nickname: data.nickname, emoji: data.emoji });
      }
    } catch { onSave(parseFloat(s||"0")); }
    setLoading(false);
  };

  return (
    <Modal title="⚙️ Configurações" onClose={onClose}>
      <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
        {/* Emoji */}
        <div>
          <label style={{ fontSize:11, color:"var(--text2)", fontWeight:700, display:"block", marginBottom:8, letterSpacing:1 }}>MEU EMOJI</label>
          <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
            {EMOJIS.map(e=>(
              <button key={e} onClick={()=>setEmoji(e)} style={{ width:40, height:40, borderRadius:10, border:`2px solid ${emoji===e?"var(--primary)":"var(--border)"}`, background:emoji===e?"rgba(108,99,255,0.15)":"var(--bg3)", fontSize:20, cursor:"pointer", transition:"all 0.15s" }}>{e}</button>
            ))}
          </div>
        </div>

        {/* Apelido */}
        <div>
          <label style={{ fontSize:11, color:"var(--text2)", fontWeight:700, display:"block", marginBottom:6, letterSpacing:1 }}>APELIDO (aparece no ranking)</label>
          <input placeholder={`Ex: ${user.name?.split(" ")[0]}Money`} value={nick} onChange={e=>setNick(e.target.value.slice(0,40))} maxLength={40}/>
          <div style={{ fontSize:10, color:"var(--text2)", marginTop:4 }}>{nick.length}/40 caracteres</div>
        </div>

        {/* Salário */}
        <div>
          <label style={{ fontSize:11, color:"var(--text2)", fontWeight:700, display:"block", marginBottom:6, letterSpacing:1 }}>SALÁRIO BASE (R$)</label>
          <input type="number" value={s} onChange={e=>setS(e.target.value)}/>
        </div>

        <button className="btn-primary" onClick={save} disabled={loading} style={{ width:"100%" }}>{loading?"Salvando...":"Salvar"}</button>

        <div style={{ borderTop:"1px solid var(--border)", paddingTop:14 }}>
          <div style={{ fontSize:12, color:"var(--text2)", marginBottom:10 }}>⚠️ Zona de perigo</div>
          <button onClick={onReset} style={{ width:"100%", background:"rgba(255,77,106,.15)", color:"var(--red)", padding:"12px", borderRadius:12, fontSize:13, fontWeight:700, border:"1px solid rgba(255,77,106,.3)" }}>
            🔄 Virar Mês — Arquivar e limpar
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ResetModal({ onClose, onConfirm }: any) {
  const [loading, setLoading] = useState(false);
  const confirm = async () => { setLoading(true); await onConfirm(); setLoading(false); };
  return (
    <Modal title="🔄 Virar o Mês" onClose={onClose}>
      <p style={{ color:"var(--text2)", fontSize:14, marginBottom:8, lineHeight:1.6 }}>
        Os dados serão <strong style={{ color:"var(--green)" }}>arquivados</strong> e você começa o mês limpo.
      </p>
      <p style={{ color:"var(--text2)", fontSize:13, marginBottom:20, lineHeight:1.5 }}>
        Seu XP e nível <strong style={{ color:"var(--primary)" }}>não são zerados</strong> — apenas despesas, cartão e renda extra.
      </p>
      <div style={{ display:"flex", gap:8 }}>
        <button className="btn-ghost" onClick={onClose} style={{ flex:1 }}>Cancelar</button>
        <button onClick={confirm} disabled={loading} style={{ flex:1, background:"var(--primary)", color:"white", padding:"12px", borderRadius:12, fontSize:14, fontWeight:700 }}>{loading?"Arquivando...":"Confirmar"}</button>
      </div>
    </Modal>
  );
}

function MethodologyModal({ onClose }: any) {
  const POTES = [
    { cat:"Pagar-se",  pct:"5-10%",  color:"#6c63ff", emoji:"💆", desc:"Invista em você mesmo. Um presente, um passeio, um momento de prazer." },
    { cat:"Doar",      pct:"5-10%",  color:"#ff6b9d", emoji:"💝", desc:"Generosidade quebra a mentalidade de escassez e cria energia de abundância." },
    { cat:"Investir",  pct:"5-10%",  color:"#00d68f", emoji:"📈", desc:"Construa patrimônio. Quanto mais cedo começa, mais os juros compostos trabalham." },
    { cat:"Contas",    pct:"60-70%", color:"#ffb703", emoji:"📋", desc:"Suas obrigações mensais. Aprenda a viver bem gastando menos." },
    { cat:"Sonho",     pct:"5-10%",  color:"#8b5cf6", emoji:"✨", desc:"Seu objetivo motivador. Transforma controle financeiro em aventura." },
    { cat:"Abundar",   pct:"5-10%",  color:"#f97316", emoji:"🌟", desc:"Os luxos da vida. Restaurante melhor, hobby, experiências." },
  ];
  return (
    <Modal title="📚 Metodologia dos 6 Potes" onClose={onClose}>
      <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
        <div style={{ background:"var(--bg3)", borderRadius:12, padding:12, fontSize:13, color:"var(--text2)", lineHeight:1.6 }}>
          A metodologia dos 6 Potes propõe que riqueza é um estado mental baseado em inteligência emocional. A chave está em como você distribui o que ganha.
        </div>
        {POTES.map((p,i)=>(
          <div key={i} style={{ display:"flex", gap:12, padding:"10px 12px", background:"var(--bg3)", borderRadius:12, borderLeft:`3px solid ${p.color}` }}>
            <span style={{ fontSize:20, flexShrink:0 }}>{p.emoji}</span>
            <div>
              <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:3 }}>
                <span style={{ fontWeight:700, fontSize:13 }}>{p.cat}</span>
                <span style={{ fontSize:11, color:p.color, fontWeight:700 }}>{p.pct}</span>
              </div>
              <div style={{ fontSize:12, color:"var(--text2)", lineHeight:1.5 }}>{p.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
