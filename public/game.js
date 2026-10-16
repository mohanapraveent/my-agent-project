(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const CX = W / 2;
  const CY = H / 2;
  const MAX_RADIUS = Math.min(W, H) / 2 - 10;

  const roundLabel = document.getElementById('roundLabel');
  const scoreLabel = document.getElementById('scoreLabel');
  const lastLabel = document.getElementById('lastLabel');
  const startOverlay = document.getElementById('startOverlay');
  const endOverlay = document.getElementById('endOverlay');
  const startBtn = document.getElementById('startBtn');
  const restartBtn = document.getElementById('restartBtn');
  const finalScoreEl = document.getElementById('finalScore');
  const saveForm = document.getElementById('saveForm');
  const nameInput = document.getElementById('nameInput');
  const saveStatus = document.getElementById('saveStatus');
  const leaderboardList = document.getElementById('leaderboardList');

  let config = { rounds: 8, maxScorePerRound: 100, maxScore: 800, leaderboardSize: 10 };

  const TOTAL_ROUNDS = () => config.rounds;

  let state = 'idle'; // idle | playing | locked | roundEnd | gameEnd
  let round = 0;
  let totalScore = 0;
  let ringRadius = 0;
  let ringSpeed = 0;
  let band = { inner: 0, outer: 0, center: 0 };
  let lockedThisRound = false;
  let flashUntil = 0;
  let flashColor = '';
  let rafId = null;
  let saving = false;

  function fetchConfig() {
    return fetch('api/config')
      .then((r) => r.json())
      .then((cfg) => { config = cfg; roundLabel.textContent = `0 / ${config.rounds}`; })
      .catch(() => { /* fall back to defaults already set */ });
  }

  function loadLeaderboard() {
    return fetch('api/scores')
      .then((r) => r.json())
      .then((data) => renderLeaderboard(data.scores || []))
      .catch(() => {
        leaderboardList.innerHTML = '<li class="empty">Could not load scores.</li>';
      });
  }

  function renderLeaderboard(scores) {
    if (!scores.length) {
      leaderboardList.innerHTML = '<li class="empty">No scores yet. Be the first.</li>';
      return;
    }
    leaderboardList.innerHTML = scores
      .map((s) => `<li>${escapeHtml(s.name)}<span class="lb-score">${s.score}</span></li>`)
      .join('');
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function newBandForRound(r) {
    const outer = 60 + Math.random() * (MAX_RADIUS - 90);
    const width = 26 - r * 1.2; // bands narrow slightly as rounds progress
    const inner = Math.max(10, outer - Math.max(14, width));
    return { inner, outer, center: (inner + outer) / 2 };
  }

  function startGame() {
    round = 0;
    totalScore = 0;
    scoreLabel.textContent = '0';
    lastLabel.textContent = '—';
    startOverlay.classList.add('hidden');
    endOverlay.classList.add('hidden');
    saveStatus.textContent = '';
    saveStatus.className = 'save-status';
    nameInput.value = '';
    nextRound();
  }

  function nextRound() {
    round += 1;
    if (round > TOTAL_ROUNDS()) {
      endGame();
      return;
    }
    roundLabel.textContent = `${round} / ${TOTAL_ROUNDS()}`;
    band = newBandForRound(round);
    ringRadius = 0;
    ringSpeed = 1.6 + round * 0.18;
    lockedThisRound = false;
    state = 'playing';
    if (!rafId) rafId = requestAnimationFrame(tick);
  }

  function lockIn() {
    if (state !== 'playing' || lockedThisRound) return;
    lockedThisRound = true;
    const gained = scoreForRadius(ringRadius);
    totalScore += gained;
    scoreLabel.textContent = String(totalScore);
    lastLabel.textContent = `+${gained}`;
    flashColor = gained >= 70 ? '#38f0c6' : gained > 0 ? '#ffd166' : '#ff5d7a';
    flashUntil = performance.now() + 260;
    state = 'locked';
    setTimeout(nextRound, 480);
  }

  function scoreForRadius(r) {
    if (r < band.inner || r > band.outer) return 0;
    const dist = Math.abs(r - band.center);
    const halfWidth = (band.outer - band.inner) / 2;
    const closeness = 1 - dist / halfWidth;
    return Math.max(0, Math.round(closeness * config.maxScorePerRound));
  }

  function endGame() {
    state = 'gameEnd';
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    finalScoreEl.textContent = String(totalScore);
    endOverlay.classList.remove('hidden');
  }

  function tick() {
    draw();
    if (state === 'playing') {
      ringRadius += ringSpeed;
      if (ringRadius > MAX_RADIUS) {
        // missed the pulse entirely
        lockedThisRound = true;
        lastLabel.textContent = '+0 (missed)';
        state = 'locked';
        setTimeout(nextRound, 480);
      }
    }
    rafId = requestAnimationFrame(tick);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    // target band
    ctx.beginPath();
    ctx.arc(CX, CY, band.outer, 0, Math.PI * 2);
    ctx.arc(CX, CY, band.inner, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(56, 240, 198, 0.18)';
    ctx.fill('evenodd');

    ctx.beginPath();
    ctx.arc(CX, CY, band.center, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(56, 240, 198, 0.55)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // expanding ring
    ctx.beginPath();
    ctx.arc(CX, CY, Math.max(ringRadius, 0), 0, Math.PI * 2);
    ctx.strokeStyle = '#e9edf7';
    ctx.lineWidth = 3;
    ctx.stroke();

    // center dot
    ctx.beginPath();
    ctx.arc(CX, CY, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#8d97b5';
    ctx.fill();

    if (state === 'locked' && performance.now() < flashUntil) {
      ctx.beginPath();
      ctx.arc(CX, CY, Math.max(ringRadius, 0), 0, Math.PI * 2);
      ctx.strokeStyle = flashColor;
      ctx.lineWidth = 8;
      ctx.globalAlpha = 0.6;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  function handleAction(e) {
    if (e) e.preventDefault();
    if (state === 'playing') lockIn();
  }

  canvas.addEventListener('pointerdown', handleAction);
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'Space') return;
    const active = document.activeElement;
    const typing = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA');
    if (typing) return;
    handleAction(e);
  });

  startBtn.addEventListener('click', startGame);
  restartBtn.addEventListener('click', () => {
    endOverlay.classList.add('hidden');
    startGame();
  });

  saveForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (saving) return;
    const name = nameInput.value.trim();
    if (!name) {
      saveStatus.textContent = 'Enter a name first.';
      saveStatus.className = 'save-status err';
      return;
    }
    saving = true;
    const submitBtn = saveForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    saveStatus.textContent = 'Saving…';
    saveStatus.className = 'save-status';

    fetch('api/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, score: totalScore }),
    })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || `Save failed (${r.status})`);
        saveStatus.textContent = 'Saved!';
        saveStatus.className = 'save-status ok';
        submitBtn.disabled = true; // prevent duplicate saves of the same round
        renderLeaderboard(data.scores || []);
      })
      .catch((err) => {
        saveStatus.textContent = err.message || 'Could not save score.';
        saveStatus.className = 'save-status err';
        submitBtn.disabled = false; // allow a deliberate retry
      })
      .finally(() => {
        saving = false;
      });
  });

  fetchConfig().then(loadLeaderboard);
  draw();
})();
