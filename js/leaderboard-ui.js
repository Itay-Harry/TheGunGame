(function() {
    // Remove old screen if exists
    const old = document.getElementById('leaderboard-screen');
    if (old) old.remove();

    // Create leaderboard screen element
    const screen = document.createElement('div');
    screen.id = 'leaderboard-screen';
    screen.innerHTML = `
        <div class="lb-container">
            <div class="lb-header-bar">
                <div class="lb-title">🏆 Leaderboard</div>
                <button class="lb-close" id="lb-close-btn">✕</button>
            </div>
            <div class="lb-body">
                <div id="lb-content"></div>
            </div>
            <div class="lb-bottom">
                <button class="lb-btn lb-btn-back" id="lb-back-btn">← Back</button>
                <button class="lb-btn lb-btn-clear" id="lb-clear-btn">🗑 Reset</button>
            </div>
        </div>
    `;
    document.body.appendChild(screen);

    let currentSort = 'bestScore';

    function getPlayerName() {
        if (window.game && window.game.playerName) return window.game.playerName;
        if (window.playerName) return window.playerName;
        try {
            const save = JSON.parse(localStorage.getItem('gun_game_save'));
            if (save && save.name) return save.name;
        } catch(e) {}
        return 'You';
    }

    function openLeaderboard() {
        currentSort = 'bestScore';
        renderBoard();
        screen.classList.add('active');
    }

    function closeLeaderboard() {
        screen.classList.remove('active');
    }

    async function renderBoard() {
        const content = document.getElementById('lb-content');
        if (!content || !window.leaderboard) return;
        content.innerHTML = '<div style="padding:24px;text-align:center;color:#888">Loading leaderboard...</div>';

        let entriesOverride = null;
        if (window.leaderboard.fetchSupabaseTop) {
            try {
                entriesOverride = await window.leaderboard.fetchSupabaseTop(currentSort, 20);
            } catch (e) {
                entriesOverride = null;
            }
        }

        content.innerHTML = window.leaderboard.renderHTML(getPlayerName(), currentSort, entriesOverride);

        content.querySelectorAll('.lb-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                currentSort = tab.dataset.sort;
                renderBoard();
            });
        });
    }

    // Close handlers — use direct references right after appending
    const closeBtn = document.getElementById('lb-close-btn');
    const backBtn = document.getElementById('lb-back-btn');
    const clearBtn = document.getElementById('lb-clear-btn');

    if (closeBtn) closeBtn.addEventListener('click', (e) => { e.stopPropagation(); closeLeaderboard(); });
    if (backBtn) backBtn.addEventListener('click', (e) => { e.stopPropagation(); closeLeaderboard(); });
    if (clearBtn) clearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm('Reset all leaderboard data?')) {
            window.leaderboard.clear();
            renderBoard();
        }
    });

    // Close on background click
    screen.addEventListener('click', (e) => {
        if (e.target === screen) closeLeaderboard();
    });

    // Prevent container clicks from closing
    screen.querySelector('.lb-container').addEventListener('click', (e) => {
        e.stopPropagation();
    });

    // Close on Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && screen.classList.contains('active')) {
            closeLeaderboard();
        }
    });

    window.openLeaderboard = openLeaderboard;
    window.closeLeaderboard = closeLeaderboard;

    // Auto-hook leaderboard buttons
    function hookButton() {
        const btns = document.querySelectorAll('[id*="leaderboard"], [data-action="leaderboard"], .leaderboard-btn');
        btns.forEach(btn => {
            if (!btn._lbHooked) {
                btn.addEventListener('click', openLeaderboard);
                btn._lbHooked = true;
            }
        });
    }
    hookButton();
    const observer = new MutationObserver(hookButton);
    observer.observe(document.body, { childList: true, subtree: true });
})();
