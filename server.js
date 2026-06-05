/**
 * Barter API Server
 * Express + sql.js (in-memory SQLite) + JWT auth
 */

const express = require('express');
const jwt = require('jsonwebtoken');
const { v4: uuid } = require('uuid');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const CryptoJS = require('crypto-js');
const initSqlJs = require('sql.js');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'barter-secret-2025';
const DB_FILE = path.join(__dirname, 'data', 'barter.db');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─────────────────────────────────────────────
// DATABASE SETUP
// ─────────────────────────────────────────────
let db;

async function initDB() {
  const SQL = await initSqlJs();
  
  // Load from file if exists, otherwise create fresh
  if (fs.existsSync(DB_FILE)) {
    const fileBuffer = fs.readFileSync(DB_FILE);
    db = new SQL.Database(fileBuffer);
    console.log('📦 Loaded existing database');
  } else {
    db = new SQL.Database();
    console.log('🌱 Created new database');
  }

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      bio TEXT DEFAULT '',
      location TEXT DEFAULT '',
      initials TEXT DEFAULT '',
      balance INTEGER DEFAULT 500,
      rating REAL DEFAULT 5.0,
      review_count INTEGER DEFAULT 0,
      trade_count INTEGER DEFAULT 0,
      last_ubi TEXT DEFAULT '',
      join_date TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS listings (
      id TEXT PRIMARY KEY,
      seller_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      category TEXT NOT NULL,
      emoji TEXT DEFAULT '📦',
      price INTEGER NOT NULL,
      type TEXT DEFAULT 'buy',
      condition TEXT DEFAULT 'Good',
      status TEXT DEFAULT 'active',
      image_url TEXT DEFAULT '',
      created_at INTEGER NOT NULL,
      FOREIGN KEY (seller_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS bids (
      id TEXT PRIMARY KEY,
      listing_id TEXT NOT NULL,
      bidder_id TEXT NOT NULL,
      bidder_name TEXT NOT NULL,
      amount INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (listing_id) REFERENCES listings(id),
      FOREIGN KEY (bidder_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      description TEXT NOT NULL,
      amount INTEGER NOT NULL,
      counterparty TEXT DEFAULT '',
      date TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      reviewer_id TEXT NOT NULL,
      reviewee_id TEXT NOT NULL,
      rating INTEGER NOT NULL,
      text TEXT NOT NULL,
      date TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (reviewer_id) REFERENCES users(id),
      FOREIGN KEY (reviewee_id) REFERENCES users(id)
    )
  `);

  seedDemoData();
  saveDB();
  console.log('✅ Database ready');
}

function saveDB() {
  if (!fs.existsSync(path.join(__dirname, 'data'))) {
    fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
  }
  const data = db.export();
  fs.writeFileSync(DB_FILE, Buffer.from(data));
}

// Auto-save every 30 seconds
setInterval(saveDB, 30000);

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
function hashPassword(p) {
  return CryptoJS.SHA256(p + 'barter_salt_2025').toString();
}

function query(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function run(sql, params = []) {
  db.run(sql, params);
}

function getUser(id) {
  const rows = query('SELECT * FROM users WHERE id = ?', [id]);
  return rows[0] || null;
}

function fmtDate(ts) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function checkUBI(user) {
  const now = new Date();
  const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  if (user.last_ubi === key) return false;
  
  run('UPDATE users SET balance = balance + 500, last_ubi = ? WHERE id = ?', [key, user.id]);
  run(`INSERT INTO transactions VALUES (?,?,?,?,?,?,?,?)`, [
    uuid(), user.id, 'ubi', 'Monthly UBI Drop', 500, 'Barter Fund', fmtDate(Date.now()), Date.now()
  ]);
  saveDB();
  return true;
}

// ─────────────────────────────────────────────
// AUTH MIDDLEWARE
// ─────────────────────────────────────────────
function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const decoded = jwt.verify(header.slice(7), JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// ─────────────────────────────────────────────
// SEED DEMO DATA
// ─────────────────────────────────────────────
function seedDemoData() {
  const existing = query('SELECT COUNT(*) as c FROM users');
  if (existing[0].c > 0) return;

  const demoUsers = [
    { id: 'u1', name: 'Clara Beekeeper', email: 'clara@commons.cc', pass: 'demo123', bio: 'Artisan beekeeper and baker. I produce raw honey, beeswax candles, and sourdough every weekend.', location: 'Portland, OR', balance: 1820, rating: 5.0, reviews: 42, trades: 38 },
    { id: 'u2', name: 'Dev Patel', email: 'dev@commons.cc', pass: 'demo123', bio: 'Full-stack developer offering tutoring sessions and laptop repair. Open to trades for produce or crafts.', location: 'Austin, TX', balance: 2340, rating: 4.6, reviews: 15, trades: 22 },
    { id: 'u3', name: 'Omar Khalid', email: 'omar@commons.cc', pass: 'demo123', bio: 'Electronics enthusiast. I have vintage gear, cameras, and surplus parts.', location: 'Chicago, IL', balance: 980, rating: 4.3, reviews: 9, trades: 14 },
    { id: 'u4', name: 'Priya Sharma', email: 'priya@commons.cc', pass: 'demo123', bio: 'Ceramic artist and avid reader. I trade handmade mugs, bowls and curated book collections.', location: 'Brooklyn, NY', balance: 1560, rating: 4.9, reviews: 31, trades: 29 },
  ];

  const now = Date.now();
  for (const u of demoUsers) {
    const initials = u.name.split(' ').map(w => w[0]).join('').toUpperCase();
    run(`INSERT INTO users VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
      u.id, u.name, u.email, hashPassword(u.pass), u.bio, u.location, initials,
      u.balance, u.rating, u.reviews, u.trades, '2024-01', '2024-01-15', now
    ]);
  }

  const listings = [
    ['l1','u1','Organic Raw Honey (500g)','Single-origin wildflower honey from my backyard hives. Unpasteurized, full of enzymes.','Food','🍯',120,'buy','Fresh'],
    ['l2','u1','Hand-Woven Wicker Basket','Traditional weave, perfect for farmers market. Each one unique, made from willow.','Crafts','🧺',220,'bid','Handmade'],
    ['l3','u1','Beeswax Pillar Candles (Set of 4)','Pure beeswax, no additives. Burns clean 40+ hours. Natural honey scent.','Crafts','🕯️',95,'buy','Handmade'],
    ['l4','u1','Freshly Baked Sourdough Loaf','48-hour ferment, stone-ground whole wheat. Available Saturdays.','Food','🍞',60,'buy','Fresh'],
    ['l5','u2','Node.js & React Tutoring (1hr)','Personalized session covering whatever you need — basics to advanced patterns.','Services','💻',350,'buy','Service'],
    ['l6','u2','Laptop Repair & Tune-Up','Diagnose and fix common issues: slow performance, overheating, software problems.','Services','🛠',280,'bid','Service'],
    ['l7','u3','Raspberry Pi 4 (4GB)','Used 6 months on a home server. Wiped clean. Comes with case and power supply.','Electronics','🔌',410,'bid','Used - Good'],
    ['l8','u3','Vintage Olympus OM-1 Film Camera','Working condition, light seals replaced. Comes with 50mm f/1.8 lens.','Electronics','📷',550,'bid','Vintage'],
    ['l9','u4','Handmade Ceramic Mug Set (x4)','Stoneware, dishwasher safe. Each mug unique with signature glaze.','Crafts','🫖',185,'bid','Handmade'],
    ['l10','u4','Sci-Fi Book Bundle (8 titles)','Le Guin, Kim Stanley Robinson, Octavia Butler — all excellent condition.','Books','📚',150,'buy','Like New'],
    ['l11','u2','Guitar Lessons Beginner (1hr)','Teaching acoustic guitar for 5 years. Patient and structured.','Services','🎸',200,'buy','Service'],
    ['l12','u3','Arduino Starter Kit','Unused kit — 12 components, breadboard, sensors.','Electronics','⚡',180,'buy','New'],
  ];

  for (const [id, sid, title, desc, cat, emoji, price, type, cond] of listings) {
    run(`INSERT INTO listings VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [id, sid, title, desc, cat, emoji, price, type, cond, 'active', now - Math.random() * 8 * 86400000]);
  }

  // Sample bids
  const sampleBids = [
    ['l2', 'u2', 'Dev Patel', 240], ['l2', 'u4', 'Priya Sharma', 260],
    ['l6', 'u3', 'Omar Khalid', 290],
    ['l7', 'u2', 'Dev Patel', 420], ['l7', 'u4', 'Priya Sharma', 440],
    ['l8', 'u4', 'Priya Sharma', 570], ['l8', 'u1', 'Clara Beekeeper', 600],
    ['l9', 'u1', 'Clara Beekeeper', 200],
  ];
  for (const [lid, bid, bname, amt] of sampleBids) {
    run(`INSERT INTO bids VALUES (?,?,?,?,?,?)`, [uuid(), lid, bid, bname, amt, now]);
  }

  // Sample transactions for u1
  const txData = [
    ['ubi', 'Monthly UBI Drop', 500, 'Barter Fund', 'Jun 1, 2025'],
    ['in', 'Honey sold to Dev Patel', 120, 'Dev Patel', 'May 28, 2025'],
    ['out', 'Ceramic mugs from Priya Sharma', 185, 'Priya Sharma', 'May 24, 2025'],
    ['ubi', 'Monthly UBI Drop', 500, 'Barter Fund', 'May 1, 2025'],
    ['in', 'Basket sold to Priya Sharma', 260, 'Priya Sharma', 'Apr 18, 2025'],
    ['out', 'Guitar lessons from Dev Patel', 200, 'Dev Patel', 'Apr 10, 2025'],
    ['ubi', 'Monthly UBI Drop', 500, 'Barter Fund', 'Apr 1, 2025'],
  ];
  for (const [type, desc, amt, cp, date] of txData) {
    run(`INSERT INTO transactions VALUES (?,?,?,?,?,?,?,?)`, [uuid(), 'u1', type, desc, amt, cp, date, now]);
  }

  // Sample reviews
  const reviewData = [
    ['u2','u1',5,'Clara\'s honey is incredible — you can taste the difference. Quick and friendly trade.','May 2025'],
    ['u3','u1',5,'The wicker basket is beautiful. Way better than photos suggest. Great communicator.','Apr 2025'],
    ['u4','u1',5,'Sourdough was still warm! Incredibly fresh and generous portions.','May 2025'],
    ['u1','u2',5,'Dev\'s tutoring was worth every coin. Clear, patient, and knowledgeable.','Apr 2025'],
    ['u1','u4',5,'The ceramic mugs are works of art. Priya is talented and a pleasure to trade with.','May 2025'],
    ['u2','u4',5,'Book bundle was in perfect condition. Great selection, highly recommend.','Apr 2025'],
  ];
  for (const [rid, reid, rating, text, date] of reviewData) {
    run(`INSERT INTO reviews VALUES (?,?,?,?,?,?,?)`, [uuid(), rid, reid, rating, text, date, now]);
  }

  console.log('🌱 Demo data seeded');
}

// ─────────────────────────────────────────────
// AUTH ROUTES
// ─────────────────────────────────────────────
app.post('/api/auth/register', (req, res) => {
  const { name, email, password, bio, location } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password required' });

  const exists = query('SELECT id FROM users WHERE email = ?', [email]);
  if (exists.length) return res.status(400).json({ error: 'Email already registered' });

  const id = 'u' + uuid().slice(0, 8);
  const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const joinDate = new Date().toISOString().slice(0, 10);
  const now = Date.now();

  run(`INSERT INTO users VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
    id, name, email, hashPassword(password), bio || '', location || '',
    initials, 500, 5.0, 0, 0, '', joinDate, now
  ]);

  // Welcome UBI
  const key = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  run('UPDATE users SET last_ubi = ? WHERE id = ?', [key, id]);
  run(`INSERT INTO transactions VALUES (?,?,?,?,?,?,?,?)`, [
    uuid(), id, 'ubi', 'Welcome Gift — First UBI Drop', 500, 'Barter Fund', fmtDate(now), now
  ]);

  saveDB();
  const user = getUser(id);
  const token = jwt.sign({ id }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, user: sanitizeUser(user) });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const rows = query('SELECT * FROM users WHERE email = ?', [email]);
  if (!rows.length) return res.status(401).json({ error: 'No account with that email' });
  const user = rows[0];
  if (user.password_hash !== hashPassword(password)) return res.status(401).json({ error: 'Incorrect password' });

  const ubiDropped = checkUBI(user);
  const fresh = getUser(user.id);
  const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, user: sanitizeUser(fresh), ubiDropped });
});

app.get('/api/auth/me', auth, (req, res) => {
  checkUBI(getUser(req.userId));
  const user = getUser(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(sanitizeUser(user));
});

function sanitizeUser(u) {
  const { password_hash, ...safe } = u;
  return safe;
}

// ─────────────────────────────────────────────
// USER ROUTES
// ─────────────────────────────────────────────
app.put('/api/users/me', auth, (req, res) => {
  const { name, bio, location } = req.body;
  const initials = (name || '').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  run('UPDATE users SET name=?, bio=?, location=?, initials=? WHERE id=?', [name, bio, location, initials, req.userId]);
  saveDB();
  res.json(sanitizeUser(getUser(req.userId)));
});

app.get('/api/users/:id', (req, res) => {
  const user = getUser(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(sanitizeUser(user));
});

// ─────────────────────────────────────────────
// LISTING ROUTES
// ─────────────────────────────────────────────
app.get('/api/listings', (req, res) => {
  const { cat, q, sort } = req.query;
  let sql = `SELECT l.*, u.name as seller_name, u.rating as seller_rating, u.review_count as seller_reviews, u.initials as seller_initials
    FROM listings l JOIN users u ON l.seller_id = u.id WHERE l.status = 'active'`;
  const params = [];
  if (cat && cat !== 'All') { sql += ' AND l.category = ?'; params.push(cat); }
  if (q) { sql += ' AND (l.title LIKE ? OR l.description LIKE ? OR l.category LIKE ?)'; params.push(`%${q}%`,`%${q}%`,`%${q}%`); }
  if (sort === 'low') sql += ' ORDER BY l.price ASC';
  else if (sort === 'high') sql += ' ORDER BY l.price DESC';
  else if (sort === 'rating') sql += ' ORDER BY u.rating DESC';
  else sql += ' ORDER BY l.created_at DESC';

  const listings = query(sql, params);
  for (const l of listings) {
    l.bids = query('SELECT * FROM bids WHERE listing_id = ? ORDER BY amount DESC', [l.id]);
  }
  res.json(listings);
});

app.get('/api/listings/:id', (req, res) => {
  const rows = query(`SELECT l.*, u.name as seller_name, u.rating as seller_rating, u.review_count as seller_reviews, u.initials as seller_initials, u.bio as seller_bio
    FROM listings l JOIN users u ON l.seller_id = u.id WHERE l.id = ?`, [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Listing not found' });
  const l = rows[0];
  l.bids = query('SELECT * FROM bids WHERE listing_id = ? ORDER BY amount DESC', [l.id]);
  res.json(l);
});

// ─────────────────────────────────────────────
// IMAGE UPLOAD (Cloudinary signed upload)
// ─────────────────────────────────────────────
app.get('/api/upload/sign', auth, (req, res) => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey    = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    return res.status(503).json({ error: 'Image uploads not configured' });
  }
  const timestamp = Math.floor(Date.now() / 1000);
  const folder    = 'barter';
  const toSign    = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
  const signature = CryptoJS.SHA256(toSign).toString();
  res.json({ timestamp, signature, apiKey, cloudName, folder });
});

app.post('/api/listings', auth, (req, res) => {
  const { title, description, category, emoji, price, type, condition, image_url } = req.body;
  if (!title || !price) return res.status(400).json({ error: 'Title and price required' });
  const id = 'l' + uuid().slice(0, 8);
  run(`INSERT INTO listings VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, req.userId, title, description || '', category || 'Other', emoji || '📦', price, type || 'buy', condition || 'Good', 'active', image_url || '', Date.now()]);
  saveDB();
  res.json({ id, message: 'Listing created' });
});

app.put('/api/listings/:id', auth, (req, res) => {
  const l = query('SELECT * FROM listings WHERE id = ? AND seller_id = ?', [req.params.id, req.userId]);
  if (!l.length) return res.status(403).json({ error: 'Not authorized' });
  const { title, description, category, emoji, price, type, condition, image_url } = req.body;
  run('UPDATE listings SET title=?, description=?, category=?, emoji=?, price=?, type=?, condition=?, image_url=? WHERE id=?',
    [title, description, category, emoji, price, type, condition, image_url || '', req.params.id]);
  saveDB();
  res.json({ message: 'Updated' });
});

app.delete('/api/listings/:id', auth, (req, res) => {
  const l = query('SELECT * FROM listings WHERE id = ? AND seller_id = ?', [req.params.id, req.userId]);
  if (!l.length) return res.status(403).json({ error: 'Not authorized' });
  run("UPDATE listings SET status = 'removed' WHERE id = ?", [req.params.id]);
  saveDB();
  res.json({ message: 'Removed' });
});

// ─────────────────────────────────────────────
// BUY / BID
// ─────────────────────────────────────────────
app.post('/api/listings/:id/buy', auth, (req, res) => {
  const rows = query('SELECT l.*, u.name as seller_name FROM listings l JOIN users u ON l.seller_id = u.id WHERE l.id = ?', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Listing not found' });
  const l = rows[0];
  if (l.status !== 'active') return res.status(400).json({ error: 'Listing no longer available' });
  if (l.type !== 'buy') return res.status(400).json({ error: 'This listing is auction only' });
  if (l.seller_id === req.userId) return res.status(400).json({ error: 'Cannot buy your own listing' });

  const buyer = getUser(req.userId);
  if (buyer.balance < l.price) return res.status(400).json({ error: 'Insufficient balance' });

  const now = Date.now();
  const dateStr = fmtDate(now);

  run('UPDATE users SET balance = balance - ?, trade_count = trade_count + 1 WHERE id = ?', [l.price, req.userId]);
  run('UPDATE users SET balance = balance + ? WHERE id = ?', [l.price, l.seller_id]);
  run("UPDATE listings SET status = 'sold' WHERE id = ?", [l.id]);

  run(`INSERT INTO transactions VALUES (?,?,?,?,?,?,?,?)`, [uuid(), req.userId, 'out', `${l.title} from ${l.seller_name}`, l.price, l.seller_name, dateStr, now]);
  run(`INSERT INTO transactions VALUES (?,?,?,?,?,?,?,?)`, [uuid(), l.seller_id, 'in', `${l.title} sold to ${buyer.name}`, l.price, buyer.name, dateStr, now]);

  saveDB();
  res.json({ message: 'Purchase complete', newBalance: buyer.balance - l.price });
});

app.post('/api/listings/:id/bid', auth, (req, res) => {
  const { amount } = req.body;
  const rows = query('SELECT * FROM listings WHERE id = ?', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Not found' });
  const l = rows[0];
  if (l.type !== 'bid') return res.status(400).json({ error: 'Not an auction' });
  if (l.seller_id === req.userId) return res.status(400).json({ error: 'Cannot bid on your own listing' });

  const topBid = query('SELECT MAX(amount) as top FROM bids WHERE listing_id = ?', [req.params.id]);
  const minBid = Math.max(l.price, (topBid[0].top || l.price) + 1);
  if (!amount || amount < minBid) return res.status(400).json({ error: `Bid must be at least ◈ ${minBid}` });

  const user = getUser(req.userId);
  run(`INSERT INTO bids VALUES (?,?,?,?,?,?)`, [uuid(), req.params.id, req.userId, user.name, amount, Date.now()]);
  saveDB();
  res.json({ message: 'Bid placed', amount });
});

// ─────────────────────────────────────────────
// TRANSACTIONS
// ─────────────────────────────────────────────
app.get('/api/transactions', auth, (req, res) => {
  const { type } = req.query;
  let sql = 'SELECT * FROM transactions WHERE user_id = ?';
  const params = [req.userId];
  if (type && type !== 'all') { sql += ' AND type = ?'; params.push(type); }
  sql += ' ORDER BY created_at DESC';
  res.json(query(sql, params));
});

// ─────────────────────────────────────────────
// REVIEWS
// ─────────────────────────────────────────────
app.get('/api/reviews/:userId', (req, res) => {
  const reviews = query(`
    SELECT r.*, u.name as reviewer_name, u.initials as reviewer_initials
    FROM reviews r JOIN users u ON r.reviewer_id = u.id
    WHERE r.reviewee_id = ? ORDER BY r.created_at DESC
  `, [req.params.userId]);
  res.json(reviews);
});

app.post('/api/reviews', auth, (req, res) => {
  const { revieweeId, rating, text } = req.body;
  if (!revieweeId || !rating || !text) return res.status(400).json({ error: 'All fields required' });
  if (revieweeId === req.userId) return res.status(400).json({ error: 'Cannot review yourself' });

  const id = uuid();
  const date = new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  run(`INSERT INTO reviews VALUES (?,?,?,?,?,?,?)`, [id, req.userId, revieweeId, rating, text, date, Date.now()]);

  // Recalculate rating
  const allRatings = query('SELECT rating FROM reviews WHERE reviewee_id = ?', [revieweeId]);
  const avg = allRatings.reduce((s, r) => s + r.rating, 0) / allRatings.length;
  run('UPDATE users SET rating = ?, review_count = ? WHERE id = ?', [Math.round(avg * 10) / 10, allRatings.length, revieweeId]);
  saveDB();
  res.json({ message: 'Review posted' });
});

// ─────────────────────────────────────────────
// STATS (public)
// ─────────────────────────────────────────────
app.get('/api/stats', (req, res) => {
  const users = query('SELECT COUNT(*) as c FROM users')[0].c;
  const listings = query("SELECT COUNT(*) as c FROM listings WHERE status='active'")[0].c;
  const trades = query('SELECT SUM(trade_count) as c FROM users')[0].c || 0;
  const coins = query('SELECT SUM(balance) as c FROM users')[0].c || 0;
  res.json({ users, listings, trades, coins });
});

// ─────────────────────────────────────────────
// START
// ─────────────────────────────────────────────
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🪙  Barter API running at http://localhost:${PORT}`);
    console.log(`📊 Health: http://localhost:${PORT}/api/stats`);
    console.log(`\nDemo accounts (password: demo123):`);
    console.log(`  clara@commons.cc  dev@commons.cc  omar@commons.cc  priya@commons.cc\n`);
  });
});