import express from "express";
import cors from "cors";
import mysql from "mysql2/promise";
import "dotenv/config";

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("dist/client"));

let pool: mysql.Pool | null = null;
function getPool() {
  if (!pool && process.env.DATABASE_URL) {
    pool = mysql.createPool(process.env.DATABASE_URL);
  }
  return pool;
}

// AUTH
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const p = getPool();
    if (!p) return res.status(500).json({ error: "DB indisponivel" });
    const [existing] = await p.execute("SELECT id FROM users WHERE email = ?", [email]) as any;
    if (existing.length > 0) return res.status(400).json({ error: "Email ja cadastrado" });
    await p.execute("INSERT INTO users (name, email, password) VALUES (?, ?, ?)", [name, email, password]);
    const [user] = await p.execute("SELECT * FROM users WHERE email = ?", [email]) as any;
    const u = user[0];
    res.json({ user: { id: u.id, name: u.name, email: u.email, xp: 0, level: 'iniciante', levelNum: 1, streakDays: 0, isNewUser: true } });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const p = getPool();
    if (!p) return res.status(500).json({ error: "DB indisponivel" });
    const [rows] = await p.execute("SELECT * FROM users WHERE email = ? AND password = ?", [email, password]) as any;
    if (rows.length === 0) return res.status(401).json({ error: "Credenciais invalidas" });
    const u = rows[0];
    res.json({ user: { id: u.id, name: u.name, email: u.email, salaryBase: u.salaryBase, xp: u.xp || 0, level: u.level || 'iniciante', levelNum: u.levelNum || 1, streakDays: u.streakDays || 0, lastCheckin: u.lastCheckin } });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.put("/api/users/:id/settings", async (req, res) => {
  try {
    const p = getPool();
    if (!p) return res.status(500).json({ error: "DB indisponivel" });
    const { salaryBase } = req.body;
    await p.execute("UPDATE users SET salaryBase = ? WHERE id = ?", [salaryBase, req.params.id]);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// XP
app.post("/api/users/:id/xp", async (req, res) => {
  try {
    const p = getPool();
    if (!p) return res.status(500).json({ error: "DB indisponivel" });
    const { xpGain } = req.body;
    const [rows] = await p.execute("SELECT xp, levelNum, level FROM users WHERE id = ?", [req.params.id]) as any;
    if (!rows.length) return res.status(404).json({ error: "Usuario nao encontrado" });
    const currentXp = (rows[0].xp || 0) + xpGain;
    const newLevelNum = Math.min(Math.floor(currentXp / 100) + 1, 50);
    await p.execute("UPDATE users SET xp = ?, levelNum = ? WHERE id = ?", [currentXp, newLevelNum, req.params.id]);
    res.json({ xp: currentXp, levelNum: newLevelNum, level: rows[0].level || 'iniciante', xpGained: xpGain });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// DAILY STREAK
app.get("/api/users/:id/streak", async (req, res) => {
  try {
    const p = getPool();
    if (!p) return res.status(500).json({ error: "DB indisponivel" });
    const [rows] = await p.execute("SELECT streakDays, lastCheckin FROM users WHERE id = ?", [req.params.id]) as any;
    if (!rows.length) return res.status(404).json({ error: "Usuario nao encontrado" });
    const { streakDays, lastCheckin } = rows[0];
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const lastDate = lastCheckin ? new Date(lastCheckin) : null;
    const lastDay = lastDate ? new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate()) : null;
    const claimedToday = lastDay ? lastDay.getTime() === today.getTime() : false;
    const midnight = new Date(today.getTime() + 86400000);
    const expiresIn = midnight.getTime() - now.getTime();
    const expiresHours = Math.floor(expiresIn / 3600000);
    const expiresMinutes = Math.floor((expiresIn % 3600000) / 60000);
    res.json({ streakDays: streakDays || 0, claimedToday, expiresIn: `${expiresHours}h ${expiresMinutes}m` });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post("/api/users/:id/streak/checkin", async (req, res) => {
  try {
    const p = getPool();
    if (!p) return res.status(500).json({ error: "DB indisponivel" });
    const [rows] = await p.execute("SELECT xp, levelNum, level, streakDays, lastCheckin FROM users WHERE id = ?", [req.params.id]) as any;
    if (!rows.length) return res.status(404).json({ error: "Usuario nao encontrado" });
    const { xp, levelNum, level, streakDays, lastCheckin } = rows[0];
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const lastDate = lastCheckin ? new Date(lastCheckin) : null;
    const lastDay = lastDate ? new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate()) : null;
    if (lastDay && lastDay.getTime() === today.getTime()) return res.status(400).json({ error: "Checkin ja realizado hoje" });
    const yesterday = new Date(today.getTime() - 86400000);
    const streakBroken = lastDay && lastDay.getTime() < yesterday.getTime();
    const newStreak = streakBroken ? 1 : (streakDays || 0) + 1;
    const streakXpMap: Record<number, number> = { 1: 5, 2: 15, 3: 25, 4: 35, 5: 50, 6: 65, 7: 100, 14: 150, 30: 300 };
    const xpGain = streakXpMap[newStreak] ?? 65;
    const newXp = (xp || 0) + xpGain;
    const newLevelNum = Math.min(Math.floor(newXp / 100) + 1, 50);
    await p.execute("UPDATE users SET streakDays = ?, lastCheckin = NOW(), xp = ?, levelNum = ? WHERE id = ?", [newStreak, newXp, newLevelNum, req.params.id]);
    res.json({ streakDays: newStreak, xpGained: xpGain, xp: newXp, levelNum: newLevelNum, level, streakBroken });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// EXPENSES
app.get("/api/users/:userId/expenses", async (req, res) => {
  try {
    const p = getPool();
    if (!p) return res.json([]);
    const [rows] = await p.execute("SELECT * FROM expenses WHERE userId = ?", [req.params.userId]) as any;
    res.json(rows);
  } catch { res.json([]); }
});

app.post("/api/users/:userId/expenses", async (req, res) => {
  try {
    const p = getPool();
    if (!p) return res.status(500).json({ error: "DB indisponivel" });
    const { categoryId, name, amount, subcategory, dueDate, recurring, recurringMonths, recurringGoal } = req.body;
    if (!categoryId || !name || !amount) return res.status(400).json({ error: "Campos obrigatorios: categoria, nome e valor" });
    await p.execute(
      "INSERT INTO expenses (userId, categoryId, name, amount, subcategory, dueDate, paid, recurring, recurringMonths, recurringGoal) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)",
      [req.params.userId, categoryId, name, amount, subcategory || null, dueDate ? new Date(dueDate) : null, recurring ? 1 : 0, recurringMonths || null, recurringGoal || null]
    );
    const [rows] = await p.execute("SELECT * FROM expenses WHERE userId = ?", [req.params.userId]) as any;
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.patch("/api/expenses/:id/paid", async (req, res) => {
  try {
    const p = getPool();
    if (!p) return res.status(500).json({ error: "DB indisponivel" });
    await p.execute("UPDATE expenses SET paid = ? WHERE id = ?", [req.body.paid ? 1 : 0, req.params.id]);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/expenses/:id", async (req, res) => {
  try {
    const p = getPool();
    if (!p) return res.status(500).json({ error: "DB indisponivel" });
    await p.execute("DELETE FROM expenses WHERE id = ?", [req.params.id]);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// CREDIT CARD
app.get("/api/users/:userId/credit-card", async (req, res) => {
  try {
    const p = getPool();
    if (!p) return res.json([]);
    const [rows] = await p.execute("SELECT * FROM creditCardExpenses WHERE userId = ?", [req.params.userId]) as any;
    res.json(rows);
  } catch { res.json([]); }
});

app.post("/api/users/:userId/credit-card", async (req, res) => {
  try {
    const p = getPool();
    if (!p) return res.status(500).json({ error: "DB indisponivel" });
    await p.execute("INSERT INTO creditCardExpenses (userId, description, amount, subcategory) VALUES (?, ?, ?, ?)",
      [req.params.userId, req.body.description, req.body.amount, req.body.subcategory || null]);
    const [rows] = await p.execute("SELECT * FROM creditCardExpenses WHERE userId = ?", [req.params.userId]) as any;
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/credit-card/:id", async (req, res) => {
  try {
    const p = getPool();
    if (!p) return res.status(500).json({ error: "DB indisponivel" });
    await p.execute("DELETE FROM creditCardExpenses WHERE id = ?", [req.params.id]);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// EXTRA INCOME
app.get("/api/users/:userId/extra-income", async (req, res) => {
  try {
    const p = getPool();
    if (!p) return res.json([]);
    const [rows] = await p.execute("SELECT * FROM extraIncomes WHERE userId = ?", [req.params.userId]) as any;
    res.json(rows);
  } catch { res.json([]); }
});

app.post("/api/users/:userId/extra-income", async (req, res) => {
  try {
    const p = getPool();
    if (!p) return res.status(500).json({ error: "DB indisponivel" });
    await p.execute("INSERT INTO extraIncomes (userId, description, amount, date) VALUES (?, ?, ?, NOW())",
      [req.params.userId, req.body.description, req.body.amount]);
    const [rows] = await p.execute("SELECT * FROM extraIncomes WHERE userId = ?", [req.params.userId]) as any;
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/extra-income/:id", async (req, res) => {
  try {
    const p = getPool();
    if (!p) return res.status(500).json({ error: "DB indisponivel" });
    await p.execute("DELETE FROM extraIncomes WHERE id = ?", [req.params.id]);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// RESET MENSAL — agora ARQUIVA antes de apagar
app.post("/api/users/:userId/reset-month", async (req, res) => {
  try {
    const p = getPool();
    if (!p) return res.status(500).json({ error: "DB indisponivel" });
    const month = new Date().toISOString().slice(0, 7);
    await p.execute(
      `INSERT INTO monthArchive (userId, month, expensesJson, creditCardJson, incomesJson)
       SELECT ?, ?,
         (SELECT IFNULL(JSON_ARRAYAGG(JSON_OBJECT('name',name,'amount',amount,'categoryId',categoryId,'paid',paid)),'[]') FROM expenses WHERE userId = ?),
         (SELECT IFNULL(JSON_ARRAYAGG(JSON_OBJECT('description',description,'amount',amount)),'[]') FROM creditCardExpenses WHERE userId = ?),
         (SELECT IFNULL(JSON_ARRAYAGG(JSON_OBJECT('description',description,'amount',amount)),'[]') FROM extraIncomes WHERE userId = ?)
       ON DUPLICATE KEY UPDATE expensesJson=VALUES(expensesJson), creditCardJson=VALUES(creditCardJson), incomesJson=VALUES(incomesJson)`,
      [req.params.userId, month, req.params.userId, req.params.userId, req.params.userId]
    );
    await p.execute("DELETE FROM expenses WHERE userId = ?", [req.params.userId]);
    await p.execute("DELETE FROM creditCardExpenses WHERE userId = ?", [req.params.userId]);
    await p.execute("DELETE FROM extraIncomes WHERE userId = ?", [req.params.userId]);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// INIT DB
app.get("/api/admin/init-db", async (_req, res) => {
  try {
    const p = getPool();
    if (!p) return res.status(500).json({ error: "DB indisponivel" });
    await p.execute(`CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255), email VARCHAR(320) UNIQUE,
      password VARCHAR(255), salaryBase DECIMAL(10,2) DEFAULT 2300.00,
      level VARCHAR(20) DEFAULT 'iniciante', levelNum INT DEFAULT 1,
      xp INT DEFAULT 0, positiveMonths INT DEFAULT 0,
      streakDays INT DEFAULT 0, lastCheckin TIMESTAMP NULL,
      createdAt TIMESTAMP DEFAULT NOW(), updatedAt TIMESTAMP DEFAULT NOW() ON UPDATE NOW())`);
    await p.execute(`CREATE TABLE IF NOT EXISTS expenses (
      id INT AUTO_INCREMENT PRIMARY KEY, userId INT NOT NULL, categoryId INT NOT NULL,
      name VARCHAR(255) NOT NULL, amount DECIMAL(10,2) NOT NULL, subcategory VARCHAR(100),
      paid INT DEFAULT 0, dueDate TIMESTAMP NULL, recurring INT DEFAULT 0,
      recurringMonths INT NULL, recurringGoal DECIMAL(10,2) NULL,
      createdAt TIMESTAMP DEFAULT NOW(), updatedAt TIMESTAMP DEFAULT NOW() ON UPDATE NOW())`);
    await p.execute(`CREATE TABLE IF NOT EXISTS creditCardExpenses (
      id INT AUTO_INCREMENT PRIMARY KEY, userId INT NOT NULL, description VARCHAR(255) NOT NULL,
      amount DECIMAL(10,2) NOT NULL, subcategory VARCHAR(100),
      createdAt TIMESTAMP DEFAULT NOW(), updatedAt TIMESTAMP DEFAULT NOW() ON UPDATE NOW())`);
    await p.execute(`CREATE TABLE IF NOT EXISTS extraIncomes (
      id INT AUTO_INCREMENT PRIMARY KEY, userId INT NOT NULL, description VARCHAR(255) NOT NULL,
      amount DECIMAL(10,2) NOT NULL, date TIMESTAMP DEFAULT NOW(), createdAt TIMESTAMP DEFAULT NOW())`);
    await p.execute(`CREATE TABLE IF NOT EXISTS monthArchive (
      id INT AUTO_INCREMENT PRIMARY KEY, userId INT NOT NULL, month VARCHAR(7) NOT NULL,
      expensesJson JSON, creditCardJson JSON, incomesJson JSON,
      createdAt TIMESTAMP DEFAULT NOW(),
      UNIQUE KEY user_month (userId, month))`);
    try { await p.execute("ALTER TABLE users ADD COLUMN streakDays INT DEFAULT 0"); } catch {}
    try { await p.execute("ALTER TABLE users ADD COLUMN lastCheckin TIMESTAMP NULL"); } catch {}
    try { await p.execute("ALTER TABLE expenses ADD COLUMN recurringMonths INT NULL"); } catch {}
    try { await p.execute("ALTER TABLE expenses ADD COLUMN recurringGoal DECIMAL(10,2) NULL"); } catch {}
    res.json({ success: true, message: "Banco inicializado!" });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get("*", (_req, res) => { res.sendFile("index.html", { root: "dist/client" }); });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🪙 MoneyGame rodando na porta ${PORT}`));
