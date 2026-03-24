import express from "express";
import cors from "cors";
import mysql from "mysql2/promise";
import "dotenv/config";
import path from "path";

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(process.cwd(), "dist", "client")));

let pool: mysql.Pool | null = null;
function getPool() {
  if (!pool && process.env.DATABASE_URL) pool = mysql.createPool(process.env.DATABASE_URL);
  return pool;
}

// ── MIGRAÇÕES ─────────────────────────────────────────────────────────────────
async function runMigrations() {
  const p = getPool();
  if (!p) { console.log("⚠️  Sem DATABASE_URL"); return; }
  console.log("🔄 Migrações...");

  await p.execute(`CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255), email VARCHAR(320) UNIQUE, password VARCHAR(255),
    salaryBase DECIMAL(10,2) DEFAULT 0,
    level VARCHAR(20) DEFAULT 'iniciante', levelNum INT DEFAULT 1,
    xp INT DEFAULT 0, streakDays INT DEFAULT 0,
    lastCheckin TIMESTAMP NULL,
    lastCheckinMonth VARCHAR(7) NULL,
    nickname VARCHAR(40) NULL, emoji VARCHAR(10) DEFAULT '💸',
    createdAt TIMESTAMP DEFAULT NOW()
  )`);

  await p.execute(`CREATE TABLE IF NOT EXISTS expenses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userId INT NOT NULL, categoryId INT NOT NULL,
    name VARCHAR(255) NOT NULL, amount DECIMAL(10,2) NOT NULL,
    subcategory VARCHAR(100), paid INT DEFAULT 0, dueDate TIMESTAMP NULL,
    recurring INT DEFAULT 0, recurringMonths INT NULL, recurringGoal DECIMAL(10,2) NULL,
    createdAt TIMESTAMP DEFAULT NOW()
  )`);

  await p.execute(`CREATE TABLE IF NOT EXISTS creditCardExpenses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userId INT NOT NULL, description VARCHAR(255) NOT NULL,
    amount DECIMAL(10,2) NOT NULL, paid INT DEFAULT 0, subcategory VARCHAR(100),
    totalAmount DECIMAL(10,2) NULL, installments INT DEFAULT 1,
    installmentCurrent INT DEFAULT 1, dueDay INT NULL,
    createdAt TIMESTAMP DEFAULT NOW()
  )`);

  await p.execute(`CREATE TABLE IF NOT EXISTS extraIncomes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userId INT NOT NULL, description VARCHAR(255) NOT NULL,
    amount DECIMAL(10,2) NOT NULL, date TIMESTAMP DEFAULT NOW()
  )`);

  await p.execute(`CREATE TABLE IF NOT EXISTS monthArchive (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userId INT NOT NULL, month VARCHAR(7) NOT NULL,
    expensesJson TEXT, creditCardJson TEXT, incomesJson TEXT,
    totalExpenses DECIMAL(10,2) DEFAULT 0, totalIncome DECIMAL(10,2) DEFAULT 0,
    createdAt TIMESTAMP DEFAULT NOW(),
    UNIQUE KEY user_month (userId, month)
  )`);

  // Colunas novas em bancos existentes — ignora se já existem
  const alters = [
    "ALTER TABLE users ADD COLUMN xp INT DEFAULT 0",
    "ALTER TABLE users ADD COLUMN streakDays INT DEFAULT 0",
    "ALTER TABLE users ADD COLUMN lastCheckin TIMESTAMP NULL",
    "ALTER TABLE users ADD COLUMN lastCheckinMonth VARCHAR(7) NULL",
    "ALTER TABLE users ADD COLUMN nickname VARCHAR(40) NULL",
    "ALTER TABLE users ADD COLUMN emoji VARCHAR(10) DEFAULT '💸'",
    "ALTER TABLE users ADD COLUMN salaryBase DECIMAL(10,2) DEFAULT 0",
    "ALTER TABLE users ADD COLUMN level VARCHAR(20) DEFAULT 'iniciante'",
    "ALTER TABLE users ADD COLUMN levelNum INT DEFAULT 1",
    "ALTER TABLE users ADD COLUMN createdAt TIMESTAMP DEFAULT NOW()",
    "ALTER TABLE expenses ADD COLUMN recurring INT DEFAULT 0",
    "ALTER TABLE expenses ADD COLUMN recurringMonths INT NULL",
    "ALTER TABLE expenses ADD COLUMN recurringGoal DECIMAL(10,2) NULL",
    "ALTER TABLE expenses ADD COLUMN dueDate TIMESTAMP NULL",
    "ALTER TABLE expenses ADD COLUMN subcategory VARCHAR(100)",
    "ALTER TABLE creditCardExpenses ADD COLUMN paid INT DEFAULT 0",
    "ALTER TABLE creditCardExpenses ADD COLUMN subcategory VARCHAR(100)",
    "ALTER TABLE creditCardExpenses ADD COLUMN totalAmount DECIMAL(10,2) NULL",
    "ALTER TABLE creditCardExpenses ADD COLUMN installments INT DEFAULT 1",
    "ALTER TABLE creditCardExpenses ADD COLUMN installmentCurrent INT DEFAULT 1",
    "ALTER TABLE creditCardExpenses ADD COLUMN dueDay INT NULL",
    "ALTER TABLE monthArchive ADD COLUMN totalExpenses DECIMAL(10,2) DEFAULT 0",
    "ALTER TABLE monthArchive ADD COLUMN totalIncome DECIMAL(10,2) DEFAULT 0",
  ];
  for (const sql of alters) { try { await p.execute(sql); } catch {} }
  console.log("✅ Migrações OK");
}

// ── HELPERS DE NÍVEL ──────────────────────────────────────────────────────────
const XP_PER_LEVEL = 1000;
const MAX_LEVEL    = 100;
const TIER_BREAK   = 50;

function calcLevel(xpTotal: number) {
  const rawLevel = Math.floor(xpTotal / XP_PER_LEVEL) + 1;
  const levelNum  = Math.min(rawLevel, MAX_LEVEL);
  let tier = "iniciante";
  if (levelNum >= MAX_LEVEL) tier = "avancado";
  else if (levelNum >= TIER_BREAK) tier = "investidor";
  return { levelNum, tier };
}

// XP do streak: dia 1=10, dia 2=15, dia 3=20... (+5 por dia)
function streakXP(day: number): number {
  return 10 + Math.max(0, day - 1) * 5;
}

// ── AUTH ──────────────────────────────────────────────────────────────────────
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const p = getPool(); if (!p) return res.status(500).json({ error: "DB indisponivel" });
    const [ex] = await p.execute("SELECT id FROM users WHERE email=?", [email]) as any;
    if (ex.length > 0) return res.status(400).json({ error: "Email ja cadastrado" });
    await p.execute(
      "INSERT INTO users (name,email,password,salaryBase,xp,streakDays,levelNum,level,emoji) VALUES (?,?,?,0,0,0,1,'iniciante','💸')",
      [name, email, password]
    );
    const [rows] = await p.execute("SELECT * FROM users WHERE email=?", [email]) as any;
    const u = rows[0];
    res.json({ user: {
      id: u.id, name: u.name, email: u.email,
      salaryBase: 0, xp: 0, level: "iniciante", levelNum: 1,
      streakDays: 0, emoji: u.emoji || "💸", nickname: u.nickname || null,
      createdAt: u.createdAt, isNewUser: true
    }});
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const p = getPool(); if (!p) return res.status(500).json({ error: "DB indisponivel" });
    const [rows] = await p.execute(
      "SELECT * FROM users WHERE email=? AND password=?", [email, password]
    ) as any;
    if (!rows.length) return res.status(401).json({ error: "Credenciais invalidas" });
    const u = rows[0];
    res.json({ user: {
      id: u.id, name: u.name, email: u.email,
      salaryBase: u.salaryBase || 0, xp: u.xp || 0,
      level: u.level || "iniciante", levelNum: u.levelNum || 1,
      streakDays: u.streakDays || 0, lastCheckin: u.lastCheckin || null,
      emoji: u.emoji || "💸", nickname: u.nickname || null,
      createdAt: u.createdAt
    }});
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post("/api/auth/reset-password", async (req, res) => {
  try {
    const p = getPool(); if (!p) return res.status(500).json({ error: "DB indisponivel" });
    const { email, newPassword } = req.body;
    if (!email || !newPassword) return res.status(400).json({ error: "E-mail e nova senha obrigatórios" });
    const [rows] = await p.execute("SELECT id FROM users WHERE email=?", [email]) as any;
    if (!rows.length) return res.status(404).json({ error: "E-mail não encontrado" });
    await p.execute("UPDATE users SET password=? WHERE email=?", [newPassword, email]);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get("/api/auth/me/:id", async (req, res) => {
  try {
    const p = getPool(); if (!p) return res.status(500).json({ error: "DB indisponivel" });
    const [rows] = await p.execute(
      "SELECT id,name,email,salaryBase,xp,levelNum,level,streakDays,lastCheckin,emoji,nickname,createdAt FROM users WHERE id=?",
      [req.params.id]
    ) as any;
    if (!rows.length) return res.status(404).json({ error: "Nao encontrado" });
    res.json(rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── SETTINGS ──────────────────────────────────────────────────────────────────
app.put("/api/users/:id/settings", async (req, res) => {
  try {
    const p = getPool(); if (!p) return res.status(500).json({ error: "DB indisponivel" });
    const { salaryBase, emoji, nickname } = req.body;

    if (salaryBase !== undefined) {
      const salary = parseFloat(salaryBase);
      if (isNaN(salary)) return res.status(400).json({ error: "salaryBase invalido" });
      await p.execute("UPDATE users SET salaryBase=? WHERE id=?", [salary, req.params.id]);
    }
    if (emoji !== undefined) {
      await p.execute("UPDATE users SET emoji=? WHERE id=?", [emoji, req.params.id]);
    }
    if (nickname !== undefined) {
      await p.execute("UPDATE users SET nickname=? WHERE id=?", [nickname || null, req.params.id]);
    }

    const [rows] = await p.execute(
      "SELECT salaryBase, emoji, nickname FROM users WHERE id=?", [req.params.id]
    ) as any;
    res.json({ success: true, ...rows[0] });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── XP ────────────────────────────────────────────────────────────────────────
app.post("/api/users/:id/xp", async (req, res) => {
  try {
    const p = getPool(); if (!p) return res.status(500).json({ error: "DB indisponivel" });
    const xpGain = Math.round(parseFloat(req.body.xpGain));
    if (isNaN(xpGain) || xpGain <= 0) return res.status(400).json({ error: "xpGain invalido" });
    const [rows] = await p.execute("SELECT xp FROM users WHERE id=?", [req.params.id]) as any;
    if (!rows.length) return res.status(404).json({ error: "Nao encontrado" });
    const newXp = (rows[0].xp || 0) + xpGain;
    const { levelNum, tier } = calcLevel(newXp);
    await p.execute("UPDATE users SET xp=?, levelNum=?, level=? WHERE id=?", [newXp, levelNum, tier, req.params.id]);
    res.json({ xp: newXp, levelNum, level: tier, xpGained: xpGain });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── STREAK ────────────────────────────────────────────────────────────────────
// Regras:
//   - 1 resgate por dia (00:00–23:59, dia calendário)
//   - XP = 10 + (dia-1)*5  →  dia 1=10, dia 2=15, dia 3=20...
//   - Se pular um dia: streak volta para 1
//   - Se virar o mês: streak volta para 1
app.get("/api/users/:id/streak", async (req, res) => {
  try {
    const p = getPool(); if (!p) return res.status(500).json({ error: "DB indisponivel" });
    const [rows] = await p.execute(
      "SELECT streakDays, lastCheckin, lastCheckinMonth FROM users WHERE id=?", [req.params.id]
    ) as any;
    if (!rows.length) return res.status(404).json({ error: "Nao encontrado" });
    const { streakDays, lastCheckin, lastCheckinMonth } = rows[0];

    const now        = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const currentMonth = now.toISOString().slice(0, 7);

    let claimedToday = false;
    if (lastCheckin) {
      const lc    = new Date(lastCheckin);
      const lcDay = new Date(lc.getFullYear(), lc.getMonth(), lc.getDate());
      claimedToday = lcDay.getTime() === todayStart.getTime();
    }

    // Se virou mês desde o último checkin, o streak real é 0
    const effectiveStreak = (lastCheckinMonth && lastCheckinMonth !== currentMonth)
      ? 0
      : (streakDays || 0);

    const msLeft = new Date(todayStart.getTime() + 86400000).getTime() - now.getTime();
    const h = Math.floor(msLeft / 3600000);
    const m = Math.floor((msLeft % 3600000) / 60000);

    res.json({
      streakDays: effectiveStreak,
      claimedToday,
      expiresIn: `${h}h ${m}m`,
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post("/api/users/:id/streak/checkin", async (req, res) => {
  try {
    const p = getPool(); if (!p) return res.status(500).json({ error: "DB indisponivel" });
    const [rows] = await p.execute(
      "SELECT xp, level, levelNum, streakDays, lastCheckin, lastCheckinMonth FROM users WHERE id=?",
      [req.params.id]
    ) as any;
    if (!rows.length) return res.status(404).json({ error: "Nao encontrado" });
    const { xp, level, levelNum, streakDays, lastCheckin, lastCheckinMonth } = rows[0];

    const now           = new Date();
    const todayStart    = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart= new Date(todayStart.getTime() - 86400000);
    const currentMonth  = now.toISOString().slice(0, 7);

    // Já fez hoje?
    if (lastCheckin) {
      const lc    = new Date(lastCheckin);
      const lcDay = new Date(lc.getFullYear(), lc.getMonth(), lc.getDate());
      if (lcDay.getTime() === todayStart.getTime()) {
        return res.status(400).json({ error: "Checkin ja realizado hoje" });
      }
    }

    // Calcula novo streak
    let newStreak = (streakDays || 0) + 1;

    // Virou mês → reinicia
    if (lastCheckinMonth && lastCheckinMonth !== currentMonth) {
      newStreak = 1;
    }
    // Pulou um dia → reinicia
    else if (lastCheckin) {
      const lc    = new Date(lastCheckin);
      const lcDay = new Date(lc.getFullYear(), lc.getMonth(), lc.getDate());
      if (lcDay.getTime() < yesterdayStart.getTime()) newStreak = 1;
    }

    // Máximo 31 dias (mês cheio) e então reinicia no próximo mês automaticamente
    if (newStreak > 31) newStreak = 31;

    const xpGain   = streakXP(newStreak);
    const newXp    = (xp || 0) + xpGain;
    const { levelNum: newLevelNum, tier: newTier } = calcLevel(newXp);

    await p.execute(
      "UPDATE users SET streakDays=?, lastCheckin=NOW(), lastCheckinMonth=?, xp=?, levelNum=?, level=? WHERE id=?",
      [newStreak, currentMonth, newXp, newLevelNum, newTier, req.params.id]
    );

    res.json({
      streakDays: newStreak,
      xpGained: xpGain,
      xp: newXp,
      levelNum: newLevelNum,
      level: newTier,
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── RANKING ───────────────────────────────────────────────────────────────────
app.get("/api/ranking", async (req, res) => {
  try {
    const p = getPool(); if (!p) return res.json([]);
    const [rows] = await p.execute(
      `SELECT id, name, nickname, emoji, xp, levelNum, level, streakDays
       FROM users
       ORDER BY xp DESC
       LIMIT 50`
    ) as any;
    res.json(rows || []);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── EXPENSES ──────────────────────────────────────────────────────────────────
app.get("/api/users/:userId/expenses", async (req, res) => {
  try {
    const p = getPool(); if (!p) return res.json([]);
    const [rows] = await p.execute(
      "SELECT * FROM expenses WHERE userId=? ORDER BY categoryId, createdAt", [req.params.userId]
    ) as any;
    res.json(rows);
  } catch { res.json([]); }
});

app.post("/api/users/:userId/expenses", async (req, res) => {
  try {
    const p = getPool(); if (!p) return res.status(500).json({ error: "DB indisponivel" });
    const { categoryId, name, amount, subcategory, dueDate, recurring, recurringMonths, recurringGoal } = req.body;
    const catId = parseInt(categoryId);
    const amt   = parseFloat(amount);
    if (isNaN(catId) || catId <= 0) return res.status(400).json({ error: "categoryId invalido" });
    if (!name || !String(name).trim()) return res.status(400).json({ error: "name obrigatorio" });
    if (isNaN(amt) || amt <= 0) return res.status(400).json({ error: "amount invalido" });
    const recur = (recurring === 1 || recurring === true || recurring === "1") ? 1 : 0;
    let due: Date | null = null;
    if (dueDate) { try { due = new Date(dueDate); } catch {} }
    await p.execute(
      "INSERT INTO expenses (userId,categoryId,name,amount,subcategory,dueDate,paid,recurring,recurringMonths,recurringGoal) VALUES (?,?,?,?,?,?,0,?,?,?)",
      [req.params.userId, catId, name.trim(), amt, subcategory||null, due, recur,
       recurringMonths ? parseInt(recurringMonths) : null,
       recurringGoal   ? parseFloat(recurringGoal) : null]
    );
    const [rows] = await p.execute(
      "SELECT * FROM expenses WHERE userId=? ORDER BY categoryId, createdAt", [req.params.userId]
    ) as any;
    res.json(rows);
  } catch (e: any) { console.error("POST expenses:", e.message); res.status(500).json({ error: e.message }); }
});

app.patch("/api/expenses/:id/paid", async (req, res) => {
  try {
    const p = getPool(); if (!p) return res.status(500).json({ error: "DB indisponivel" });
    await p.execute("UPDATE expenses SET paid=? WHERE id=?", [req.body.paid ? 1 : 0, req.params.id]);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.patch("/api/expenses/:id/edit", async (req, res) => {
  try {
    const p = getPool(); if (!p) return res.status(500).json({ error: "DB indisponivel" });
    const { name, amount } = req.body;
    if (name !== undefined)   await p.execute("UPDATE expenses SET name=? WHERE id=?",   [name, req.params.id]);
    if (amount !== undefined) {
      const amt = parseFloat(amount);
      if (!isNaN(amt) && amt > 0) await p.execute("UPDATE expenses SET amount=? WHERE id=?", [amt, req.params.id]);
    }
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/expenses/:id", async (req, res) => {
  try {
    const p = getPool(); if (!p) return res.status(500).json({ error: "DB indisponivel" });
    await p.execute("DELETE FROM expenses WHERE id=?", [req.params.id]);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── CARTÃO ────────────────────────────────────────────────────────────────────
app.get("/api/users/:userId/credit-card", async (req, res) => {
  try {
    const p = getPool(); if (!p) return res.json([]);
    const [rows] = await p.execute(
      "SELECT * FROM creditCardExpenses WHERE userId=? ORDER BY createdAt", [req.params.userId]
    ) as any;
    res.json(rows);
  } catch { res.json([]); }
});

app.post("/api/users/:userId/credit-card", async (req, res) => {
  try {
    const p = getPool(); if (!p) return res.status(500).json({ error: "DB indisponivel" });
    const { description, subcategory, amount, installments, dueDay } = req.body;
    const inst     = Math.max(1, parseInt(installments) || 1);
    const totalAmt = parseFloat(amount);
    if (isNaN(totalAmt) || totalAmt <= 0) return res.status(400).json({ error: "amount invalido" });
    const parcelAmt = Math.round(totalAmt / inst * 100) / 100;
    await p.execute(
      "INSERT INTO creditCardExpenses (userId,description,amount,totalAmount,installments,installmentCurrent,subcategory,paid,dueDay) VALUES (?,?,?,?,?,1,?,0,?)",
      [req.params.userId, description, parcelAmt, inst > 1 ? totalAmt : null, inst, subcategory||null, dueDay||null]
    );
    const [rows] = await p.execute(
      "SELECT * FROM creditCardExpenses WHERE userId=? ORDER BY createdAt", [req.params.userId]
    ) as any;
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.patch("/api/credit-card/:id", async (req, res) => {
  try {
    const p = getPool(); if (!p) return res.status(500).json({ error: "DB indisponivel" });
    const { paid, amount, description, dueDay, advanceInstallment } = req.body;
    if (paid !== undefined)
      await p.execute("UPDATE creditCardExpenses SET paid=? WHERE id=?", [paid ? 1 : 0, req.params.id]);
    if (amount !== undefined) {
      const amt = parseFloat(amount);
      if (!isNaN(amt) && amt > 0)
        await p.execute("UPDATE creditCardExpenses SET amount=? WHERE id=?", [amt, req.params.id]);
    }
    if (description !== undefined)
      await p.execute("UPDATE creditCardExpenses SET description=? WHERE id=?", [description, req.params.id]);
    if (dueDay !== undefined)
      await p.execute("UPDATE creditCardExpenses SET dueDay=? WHERE id=?", [dueDay||null, req.params.id]);
    if (advanceInstallment) {
      const [rows] = await p.execute(
        "SELECT installments, installmentCurrent FROM creditCardExpenses WHERE id=?", [req.params.id]
      ) as any;
      if (rows.length) {
        const { installments, installmentCurrent } = rows[0];
        if (installmentCurrent < installments) {
          await p.execute(
            "UPDATE creditCardExpenses SET installmentCurrent=installmentCurrent+1, paid=0 WHERE id=?", [req.params.id]
          );
        } else {
          await p.execute("DELETE FROM creditCardExpenses WHERE id=?", [req.params.id]);
        }
      }
    }
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/credit-card/:id", async (req, res) => {
  try {
    const p = getPool(); if (!p) return res.status(500).json({ error: "DB indisponivel" });
    await p.execute("DELETE FROM creditCardExpenses WHERE id=?", [req.params.id]);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post("/api/users/:userId/credit-card/pay-all", async (req, res) => {
  try {
    const p = getPool(); if (!p) return res.status(500).json({ error: "DB indisponivel" });
    await p.execute("UPDATE creditCardExpenses SET paid=1 WHERE userId=?", [req.params.userId]);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── RENDA EXTRA ───────────────────────────────────────────────────────────────
app.get("/api/users/:userId/extra-income", async (req, res) => {
  try {
    const p = getPool(); if (!p) return res.json([]);
    const [rows] = await p.execute("SELECT * FROM extraIncomes WHERE userId=?", [req.params.userId]) as any;
    res.json(rows);
  } catch { res.json([]); }
});

app.post("/api/users/:userId/extra-income", async (req, res) => {
  try {
    const p = getPool(); if (!p) return res.status(500).json({ error: "DB indisponivel" });
    const amt = parseFloat(req.body.amount);
    if (isNaN(amt) || amt <= 0) return res.status(400).json({ error: "amount invalido" });
    await p.execute(
      "INSERT INTO extraIncomes (userId,description,amount,date) VALUES (?,?,?,NOW())",
      [req.params.userId, req.body.description, amt]
    );
    const [rows] = await p.execute("SELECT * FROM extraIncomes WHERE userId=?", [req.params.userId]) as any;
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.patch("/api/extra-income/:id/edit", async (req, res) => {
  try {
    const p = getPool(); if (!p) return res.status(500).json({ error: "DB indisponivel" });
    const { description, amount } = req.body;
    if (description !== undefined)
      await p.execute("UPDATE extraIncomes SET description=? WHERE id=?", [description, req.params.id]);
    if (amount !== undefined) {
      const amt = parseFloat(amount);
      if (!isNaN(amt) && amt > 0)
        await p.execute("UPDATE extraIncomes SET amount=? WHERE id=?", [amt, req.params.id]);
    }
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/extra-income/:id", async (req, res) => {
  try {
    const p = getPool(); if (!p) return res.status(500).json({ error: "DB indisponivel" });
    await p.execute("DELETE FROM extraIncomes WHERE id=?", [req.params.id]);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── VIRAR O MÊS ───────────────────────────────────────────────────────────────
app.post("/api/users/:userId/reset-month", async (req, res) => {
  try {
    const p = getPool(); if (!p) return res.status(500).json({ error: "DB indisponivel" });
    const uid   = req.params.userId;
    const month = new Date().toISOString().slice(0, 7);

    const [expRows] = await p.execute(
      "SELECT name, CAST(amount AS CHAR) as amount, categoryId, paid FROM expenses WHERE userId=?", [uid]
    ) as any;
    const [ccRows]  = await p.execute(
      "SELECT description, CAST(amount AS CHAR) as amount, paid FROM creditCardExpenses WHERE userId=?", [uid]
    ) as any;
    const [incRows] = await p.execute(
      "SELECT description, CAST(amount AS CHAR) as amount FROM extraIncomes WHERE userId=?", [uid]
    ) as any;

    const totalExp = (expRows||[]).reduce((s: number, e: any) => s + parseFloat(e.amount||0), 0);
    const totalCC  = (ccRows||[]).reduce((s: number, c: any)  => s + parseFloat(c.amount||0), 0);
    const totalInc = (incRows||[]).reduce((s: number, i: any) => s + parseFloat(i.amount||0), 0);

    const [uSalary] = await p.execute("SELECT salaryBase FROM users WHERE id=?", [uid]) as any;
    const salaryBase = parseFloat((uSalary[0]||{}).salaryBase||0);

    await p.execute(
      `INSERT INTO monthArchive (userId,month,expensesJson,creditCardJson,incomesJson,totalExpenses,totalIncome)
       VALUES (?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE
         expensesJson=VALUES(expensesJson), creditCardJson=VALUES(creditCardJson),
         incomesJson=VALUES(incomesJson), totalExpenses=VALUES(totalExpenses), totalIncome=VALUES(totalIncome)`,
      [uid, month,
       JSON.stringify(expRows||[]), JSON.stringify(ccRows||[]), JSON.stringify(incRows||[]),
       totalExp + totalCC, totalInc + salaryBase]
    );

    // Limpa — NÃO toca xp, streakDays, salaryBase, emoji, nickname
    await p.execute("DELETE FROM expenses WHERE userId=? AND (recurring=0 OR recurring IS NULL)", [uid]);
    await p.execute("DELETE FROM creditCardExpenses WHERE userId=?", [uid]);
    await p.execute("DELETE FROM extraIncomes WHERE userId=?", [uid]);
    await p.execute("UPDATE expenses SET paid=0 WHERE userId=? AND recurring=1", [uid]);

    // Streak também reinicia junto com o mês
    await p.execute("UPDATE users SET streakDays=0, lastCheckinMonth=? WHERE id=?", [month, uid]);

    const [uRows] = await p.execute("SELECT id, name, salaryBase, xp, levelNum FROM users WHERE id=?", [uid]) as any;
    res.json({ success: true, month, user: uRows[0]||{} });
  } catch (e: any) {
    console.error("reset-month:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── HISTÓRICO ─────────────────────────────────────────────────────────────────
app.get("/api/users/:userId/history", async (req, res) => {
  try {
    const p = getPool(); if (!p) return res.json([]);
    const [rows] = await p.execute(
      "SELECT month, totalExpenses, totalIncome FROM monthArchive WHERE userId=? ORDER BY month DESC LIMIT 12",
      [req.params.userId]
    ) as any;
    const history = (rows||[]).map((r: any) => ({
      month: r.month,
      totalExpenses: parseFloat(r.totalExpenses||0),
      totalIncome:   parseFloat(r.totalIncome||0),
      balance: parseFloat(r.totalIncome||0) - parseFloat(r.totalExpenses||0),
    }));
    res.json(history);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── PROXY IA ──────────────────────────────────────────────────────────────────
// A chave ANTHROPIC_API_KEY fica SOMENTE no Railway (variável de ambiente).
// Nunca exposta no código ou no repositório.
app.post("/api/ai/insights", async (req, res) => {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return res.status(503).json({ error: "ANTHROPIC_API_KEY não configurada no servidor" });

    const { prompt } = req.body;
    if (!prompt || typeof prompt !== "string") return res.status(400).json({ error: "prompt obrigatório" });

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 800,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await response.json() as any;
    if (!response.ok) return res.status(response.status).json({ error: data.error?.message || "Erro na API" });

    const text = (data.content || []).map((b: any) => b.text || "").join("").trim();
    res.json({ text });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── STATIC + FALLBACK ─────────────────────────────────────────────────────────
app.get("*", (_req, res) => {
  const indexPath = path.join(process.cwd(), "dist", "client", "index.html");
  res.sendFile(indexPath, (err) => {
    if (err) res.status(200).send(`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>MoneyGame</title></head><body><div id="root"></div></body></html>`);
  });
});

const PORT = parseInt(String(process.env.PORT || "3000"), 10);
app.listen(PORT, "0.0.0.0", async () => {
  console.log(`💸 MoneyGame porta ${PORT}`);
  try { await runMigrations(); } catch (e: any) { console.error("Migration warning:", e.message); }
});
