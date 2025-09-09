; (() => {
    const gridEl = document.getElementById('grid');
    const statusText = document.getElementById('statusText');
    const newBtn = document.getElementById('newGame');
    const resetBtn = document.getElementById('resetScores');
    const modeSel = document.getElementById('mode');
    const firstSel = document.getElementById('first');
    const scoreXEl = document.getElementById('scoreX');
    const scoreOEl = document.getElementById('scoreO');
    const scoreDEl = document.getElementById('scoreD');
    const themeToggle = document.getElementById('themeToggle');
    const help = document.getElementById('helpDialog');
    const closeHelp = document.getElementById('closeHelp');

    const WIN_LINES = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],
        [0, 3, 6], [1, 4, 7], [2, 5, 8],
        [0, 4, 8], [2, 4, 6]
    ];

    const state = {
        board: Array(9).fill(''),
        turn: 'X',
        running: false,
        mode: 'pvp',
        scores: { X: 0, O: 0, D: 0 },
    };

    // Persistence
    const saved = JSON.parse(localStorage.getItem('ttt:v1') || '{}');
    if (saved?.scores) state.scores = saved.scores;
    if (saved?.mode) modeSel.value = saved.mode;
    if (saved?.first) firstSel.value = saved.first;
    const savedTheme = localStorage.getItem('ttt:theme') || 'dark';
    if (savedTheme === 'light') { document.body.classList.add('light'); themeToggle.checked = true; }

    function persist() {
        localStorage.setItem('ttt:v1', JSON.stringify({ scores: state.scores, mode: modeSel.value, first: firstSel.value }));
    }

    // Build grid
    const cells = [];
    for (let i = 0; i < 9; i++) {
        const btn = document.createElement('button');
        btn.className = 'cell';
        btn.type = 'button';
        btn.setAttribute('role', 'gridcell');
        btn.setAttribute('aria-label', `Cell ${i + 1}`);
        btn.dataset.index = i;
        btn.innerHTML = `<span class="mark" aria-hidden="true"></span>`;
        btn.addEventListener('click', () => handleMove(i));
        cells.push(btn); gridEl.appendChild(btn);
    }

    function updateCell(i) {
        const v = state.board[i];
        const el = cells[i];
        const mark = el.querySelector('.mark');
        if (v) {
            el.classList.add('filled');
            mark.textContent = v;
            mark.className = `mark ${v.toLowerCase()}`;
            el.disabled = true;
            el.setAttribute('aria-disabled', 'true');
        } else {
            el.classList.remove('filled', 'win');
            mark.textContent = '';
            mark.className = 'mark';
            el.disabled = false;
            el.removeAttribute('aria-disabled');
        }
    }

    function setStatus(msg) { statusText.textContent = msg; }

    function newGame() {
        state.board.fill('');
        state.turn = firstSel.value || 'X';
        state.mode = modeSel.value;
        state.running = true;
        for (let i = 0; i < 9; i++) updateCell(i);
        highlight();
        setStatus(`Turn: ${state.turn}`);
        persist();
        if (state.mode === 'ai' && state.turn === 'O') aiTurn();
    }

    function endGame(result) {
        state.running = false;
        let msg = '';
        if (result === 'D') { state.scores.D++; msg = `Draw!`; }
        else { state.scores[result]++; msg = `${result} wins!`; }
        updateScoresUI();
        setStatus(`${msg}  Press New Game to play again.`);
        persist();
    }

    function updateScoresUI() {
        scoreXEl.textContent = state.scores.X;
        scoreOEl.textContent = state.scores.O;
        scoreDEl.textContent = state.scores.D;
    }

    function handleMove(i) {
        if (!state.running || state.board[i]) return;
        place(i, state.turn);
        const outcome = winner(state.board);
        if (outcome) { endGame(outcome); return; }
        state.turn = state.turn === 'X' ? 'O' : 'X';
        setStatus(`Turn: ${state.turn}`);
        if (state.mode === 'ai' && state.turn === 'O') {
            // Delay a tick for UX
            setTimeout(aiTurn, 250);
        }
    }

    function place(i, mark) {
        state.board[i] = mark; updateCell(i); highlight();
    }

    function highlight(line) {
        // Clear highlights
        cells.forEach(c => c.classList.remove('win'));
        const res = line ? { line } : getWinLine(state.board);
        if (res) res.line.forEach(idx => cells[idx].classList.add('win'));
    }

    function winner(b) {
        const line = getWinLine(b);
        if (line) return b[line.line[0]]; // X or O
        if (b.every(Boolean)) return 'D';
        return null;
    }

    function getWinLine(b) {
        for (const L of WIN_LINES) {
            const [a, b1, c] = L;
            if (b[a] && b[a] === b[b1] && b[a] === b[c]) return { line: L };
        }
        return null;
    }

    // Minimax AI (optimal) — O is AI when mode === 'ai'
    function aiTurn() {
        if (!state.running) return;
        const i = bestMove(state.board, 'O');
        place(i, 'O');
        const outcome = winner(state.board);
        if (outcome) { endGame(outcome); return; }
        state.turn = 'X';
        setStatus(`Turn: ${state.turn}`);
    }

    function bestMove(board, player) {
        // Try center, corners heuristics quick win when empty
        if (board.every(v => !v)) return 4; // center first
        let best = { score: -Infinity, idx: -1 };
        for (let i = 0; i < 9; i++) {
            if (board[i]) continue;
            board[i] = player;
            const score = minimax(board, 0, false);
            board[i] = '';
            if (score > best.score) best = { score, idx: i };
        }
        return best.idx;
    }

    function minimax(b, depth, isMax) {
        const result = winner(b);
        if (result === 'O') return 10 - depth;
        if (result === 'X') return depth - 10;
        if (result === 'D') return 0;
        if (isMax) {
            let best = -Infinity;
            for (let i = 0; i < 9; i++) if (!b[i]) { b[i] = 'O'; best = Math.max(best, minimax(b, depth + 1, false)); b[i] = ''; }
            return best;
        } else {
            let best = Infinity;
            for (let i = 0; i < 9; i++) if (!b[i]) { b[i] = 'X'; best = Math.min(best, minimax(b, depth + 1, true)); b[i] = ''; }
            return best;
        }
    }

    // Keyboard support
    let focusIdx = 0;
    function focusCell(i) { cells[i]?.focus(); focusIdx = i; }
    document.addEventListener('keydown', (e) => {
        if (e.key >= '1' && e.key <= '9') { const i = Number(e.key) - 1; if (!cells[i].disabled) cells[i].click(); }
        const key = e.key;
        const row = Math.floor(focusIdx / 3), col = focusIdx % 3;
        if (key === 'ArrowLeft') { e.preventDefault(); focusCell((row * 3) + ((col + 2) % 3)); }
        if (key === 'ArrowRight') { e.preventDefault(); focusCell((row * 3) + ((col + 1) % 3)); }
        if (key === 'ArrowUp') { e.preventDefault(); focusCell(((row + 2) % 3) * 3 + col); }
        if (key === 'ArrowDown') { e.preventDefault(); focusCell(((row + 1) % 3) * 3 + col); }
        if (key === 'Enter' || key === ' ') { if (!cells[focusIdx].disabled) cells[focusIdx].click(); }
    }, { passive: false });

    // Theme
    themeToggle.addEventListener('change', () => {
        document.body.classList.toggle('light', themeToggle.checked);
        localStorage.setItem('ttt:theme', themeToggle.checked ? 'light' : 'dark');
    });

    // Buttons
    newBtn.addEventListener('click', newGame);
    resetBtn.addEventListener('click', () => { state.scores = { X: 0, O: 0, D: 0 }; updateScoresUI(); persist(); });

    // Help dialog
    document.getElementById('helpBtn').addEventListener('click', () => { help.showModal(); });
    closeHelp.addEventListener('click', () => help.close());
    help.addEventListener('click', (e) => { if (e.target === help) help.close(); });

    // Initial
    updateScoresUI();
    newGame();
    focusCell(4);
})();