# Barter ◈
### Universal Income · Community Barter Network

A full-stack web app where members receive **500 ◈CC monthly** and trade goods, services, and crafts with each other.

---

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start the server
npm start

# 3. Open in browser
open http://localhost:3000
```

**Demo accounts** (password: `demo123`):
| Name | Email |
|------|-------|
| Clara Beekeeper | clara@commons.cc |
| Dev Patel | dev@commons.cc |
| Omar Khalid | omar@commons.cc |
| Priya Sharma | priya@commons.cc |

---

## 🏗️ Architecture

```
barter/
├── server.js           ← Express API + sql.js database
├── public/
│   └── index.html      ← Full frontend SPA
├── data/
│   └── barter.db  ← Auto-created SQLite database
├── Dockerfile
└── package.json
```

**Stack:**
- **Backend**: Node.js + Express
- **Database**: sql.js (SQLite in pure JS, auto-saved to disk)
- **Auth**: JWT (30-day tokens)
- **AI**: Claude Sonnet via Anthropic API (listing descriptions, assistant)
- **Frontend**: Vanilla JS SPA with Fraunces + DM Sans typography

---

## 🔑 API Reference

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register + receive 500 ◈CC |
| POST | `/api/auth/login` | Login, triggers UBI if due |
| GET | `/api/auth/me` | Get current user (auth required) |

### Listings
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/listings` | All active listings. Query: `?cat=Crafts&q=honey&sort=low` |
| GET | `/api/listings/:id` | Single listing with bids |
| POST | `/api/listings` | Create listing (auth) |
| PUT | `/api/listings/:id` | Edit listing (auth, owner only) |
| DELETE | `/api/listings/:id` | Remove listing (auth, owner only) |
| POST | `/api/listings/:id/buy` | Buy now (auth) |
| POST | `/api/listings/:id/bid` | Place bid (auth) |

### Wallet / Transactions
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/transactions` | User's transactions. Query: `?type=ubi|in|out` |

### Reviews
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/reviews/:userId` | Reviews for a user |
| POST | `/api/reviews` | Post a review (auth) |

### Public Stats
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stats` | `{users, listings, trades, coins}` |

---

## 💡 Features

### Universal Basic Income
- Every member receives **500 ◈CC** on the 1st of each month
- Automatically deposited on first login of the month
- Full transaction history with UBI receipts

### Marketplace
- **Buy Now** and **Auction/Bid** listing types
- Category filters: Produce, Crafts, Services, Electronics, Books, Food, Clothing
- Sort by: Newest, Price ↑↓, Top Rated
- Full-text search across title, description, category

### Wallet
- Live balance display
- Transaction history (all / received / sent / UBI)
- Total received, spent, trades counter

### Profile & Reviews
- 5-star rating system (recalculated on each review)
- Community reviews with reviewer info
- Editable name, bio, location

### AI Assistant (Claude-powered)
- Chat assistant with full user context
- **AI listing description generator** — one click
- Quick-action prompts for common tasks
- Maintains conversation history within session

---

## 🐳 Docker Deployment

```bash
docker build -t barter .
docker run -p 3000:3000 -v $(pwd)/data:/app/data barter
```

## ☁️ Railway / Render Deployment

1. Push to GitHub
2. Connect repo to Railway or Render
3. Set env var: `JWT_SECRET=your-secret-here`
4. Deploy — database auto-creates on first run

---

## 🔧 Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `JWT_SECRET` | `barter-secret-2025` | JWT signing secret — **change in production!** |

---

## 📊 Data Model

```
users        — id, name, email, password_hash, bio, location, balance, rating, ...
listings     — id, seller_id, title, description, category, emoji, price, type, condition, status
bids         — id, listing_id, bidder_id, bidder_name, amount
transactions — id, user_id, type (ubi|in|out), description, amount, counterparty, date
reviews      — id, reviewer_id, reviewee_id, rating, text, date
```

---

*Built with ◈ for communities that believe in abundance.*
