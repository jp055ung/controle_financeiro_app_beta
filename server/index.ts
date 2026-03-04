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
    res.json({ user: { id: u.id, name: u.name, email: u.email, xp: u.xp || 0, level: u.level || 'iniciante', levelNum: u.levelNum || 1 } });
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
    res.json({ user: { id: u.id, name: u.name, email: u.email, salaryBase: u.salaryBase, reserveMeta: u.reserveMeta, xp: u.xp || 0, level: u.level || 'iniciante', levelNum: u.levelNum || 1 } });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.put("/api/users/:id/settings", async (req, res) => {
  try {
    const p = getPool();
    if (!p) return res.status(500).json({ error: "DB indisponivel" });
    const { salaryBase, reserveMeta } = req.body;
    await p.execute("UPDATE users SET salaryBase = ?, reserveMeta = ? WHERE id = ?", [salaryBase, reserveMeta, req.params.id]);
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
    const { categoryId, name, amount, subcategory, dueDate, recurring } = req.body;
    await p.execute(
      "INSERT INTO expenses (userId, categoryId, name, amount, subcategory, dueDate, paid, recurring) VALUES (?, ?, ?, ?, ?, ?, 0, ?)",
      [req.params.userId, categoryId, name, amount, subcategory || null, dueDate ? new Date(dueDate) : null, recurring ? 1 : 0]
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
    await p.execute(
      "INSERT INTO creditCardExpenses (userId, description, amount, subcategory) VALUES (?, ?, ?, ?)",
      [req.params.userId, req.body.description, req.body.amount, req.body.subcategory || null]
    );
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
    await p.execute(
      "INSERT INTO extraIncomes (userId, description, amount, date) VALUES (?, ?, ?, NOW())",
      [req.params.userId, req.body.description, req.body.amount]
    );
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

// RESET MENSAL
app.post("/api/users/:userId/reset-month", async (req, res) => {
  try {
    const p = getPool();
    if (!p) return res.status(500).json({ error: "DB indisponivel" });
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
      reserveMeta DECIMAL(10,2) DEFAULT 500.00, level VARCHAR(20) DEFAULT 'iniciante',
      levelNum INT DEFAULT 1, xp INT DEFAULT 0, positiveMonths INT DEFAULT 0,
      createdAt TIMESTAMP DEFAULT NOW(), updatedAt TIMESTAMP DEFAULT NOW() ON UPDATE NOW())`);
    await p.execute(`CREATE TABLE IF NOT EXISTS expenses (
      id INT AUTO_INCREMENT PRIMARY KEY, userId INT NOT NULL, categoryId INT NOT NULL,
      name VARCHAR(255) NOT NULL, amount DECIMAL(10,2) NOT NULL, subcategory VARCHAR(100),
      paid INT DEFAULT 0, dueDate TIMESTAMP NULL, recurring INT DEFAULT 0,
      createdAt TIMESTAMP DEFAULT NOW(), updatedAt TIMESTAMP DEFAULT NOW() ON UPDATE NOW())`);
    await p.execute(`CREATE TABLE IF NOT EXISTS creditCardExpenses (
      id INT AUTO_INCREMENT PRIMARY KEY, userId INT NOT NULL, description VARCHAR(255) NOT NULL,
      amount DECIMAL(10,2) NOT NULL, subcategory VARCHAR(100),
      createdAt TIMESTAMP DEFAULT NOW(), updatedAt TIMESTAMP DEFAULT NOW() ON UPDATE NOW())`);
    await p.execute(`CREATE TABLE IF NOT EXISTS extraIncomes (
      id INT AUTO_INCREMENT PRIMARY KEY, userId INT NOT NULL, description VARCHAR(255) NOT NULL,
      amount DECIMAL(10,2) NOT NULL, date TIMESTAMP DEFAULT NOW(), createdAt TIMESTAMP DEFAULT NOW())`);
    res.json({ success: true, message: "Banco inicializado!" });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get("*", (_req, res) => { res.sendFile("index.html", { root: "dist/client" }); });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🪙 MoneyGame rodando na porta ${PORT}`));
