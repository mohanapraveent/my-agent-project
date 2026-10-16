const express = require('express');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const SCORES_FILE = path.join(DATA_DIR, 'scores.json');

const ROUNDS = 8;
const MAX_SCORE_PER_ROUND = 100;
const MAX_SCORE = ROUNDS * MAX_SCORE_PER_ROUND;
const MAX_NAME_LENGTH = 20;
const LEADERBOARD_SIZE = 10;

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(SCORES_FILE)) {
    fs.writeFileSync(SCORES_FILE, JSON.stringify([], null, 2));
  }
}

function readScores() {
  ensureStore();
  try {
    const raw = fs.readFileSync(SCORES_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeScores(scores) {
  ensureStore();
  // Write to a temp file first so a crash mid-write cannot corrupt the store.
  const tmp = SCORES_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(scores, null, 2));
  fs.renameSync(tmp, SCORES_FILE);
}

const app = express();
app.use(express.json());

// Public game API: no cookies/auth, open CORS so the sandboxed /play/app/ copy can call it.
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

app.get('/api/config', (req, res) => {
  res.json({ rounds: ROUNDS, maxScorePerRound: MAX_SCORE_PER_ROUND, maxScore: MAX_SCORE, leaderboardSize: LEADERBOARD_SIZE });
});

app.get('/api/scores', (req, res) => {
  const scores = readScores()
    .slice()
    .sort((a, b) => b.score - a.score || a.at - b.at)
    .slice(0, LEADERBOARD_SIZE);
  res.json({ scores });
});

app.post('/api/scores', (req, res) => {
  const { name, score } = req.body || {};

  if (typeof name !== 'string') {
    return res.status(400).json({ error: 'name must be a string' });
  }
  const trimmedName = name.trim();
  if (trimmedName.length === 0 || trimmedName.length > MAX_NAME_LENGTH) {
    return res.status(400).json({ error: `name must be 1-${MAX_NAME_LENGTH} characters` });
  }

  if (typeof score !== 'number' || !Number.isInteger(score)) {
    return res.status(400).json({ error: 'score must be an integer' });
  }
  if (score < 0 || score > MAX_SCORE) {
    return res.status(400).json({ error: `score must be between 0 and ${MAX_SCORE}` });
  }

  const scores = readScores();
  const entry = { name: trimmedName, score, at: Date.now() };
  scores.push(entry);
  writeScores(scores);

  const leaderboard = scores
    .slice()
    .sort((a, b) => b.score - a.score || a.at - b.at)
    .slice(0, LEADERBOARD_SIZE);
  res.status(201).json({ entry, scores: leaderboard });
});

app.use(express.static(path.join(__dirname, 'public')));

ensureStore();
app.listen(PORT, () => {
  console.log(`Pulse Lock serving on port ${PORT}`);
});
