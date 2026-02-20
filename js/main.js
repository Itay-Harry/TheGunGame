    // Wire Practice Mode callback
    // ...existing code...
    (function() {
    'use strict';

    // ========= ANTI-CHEAT: Freeze core prototypes =========
    // Prevent overriding takeDamage, health setters, etc. from console
    if (typeof Player !== 'undefined') {
        Object.freeze(Player.prototype.takeDamage);
        Object.freeze(Player.prototype.spawn);
        Object.freeze(Player.prototype.update);
    }
    if (typeof WeaponInstance !== 'undefined') {
        Object.freeze(WeaponInstance.prototype.fire);
        Object.freeze(WeaponInstance.prototype.canFire);
    }
    if (typeof Progression !== 'undefined') {
        Object.freeze(Progression.prototype.addCoins);
        Object.freeze(Progression.prototype.addXP);
        Object.freeze(Progression.prototype.purchase);
    }

    const progression = new Progression();
    const canvas = document.getElementById('game-canvas');
    const ui = new UI(progression);
    window.ui = ui;
    const game = new Game(canvas, ui, progression);
    // Wire Practice Mode callback
    ui.onStartPractice = (settings) => game.startPracticeMode(settings);

    // ========= ANTI-CHEAT: Seal game objects =========
    // Prevent adding cheat properties or replacing methods at runtime
    Object.seal(progression);
    Object.seal(ui);

    // Wire UI callbacks
    ui.onStartGame = (settings) => game.startMatch(settings);
    ui.onPause = () => game.pause();
    ui.onResume = () => game.resume();
    ui.onQuit = () => game.quit();

    ui.onPlayAgain = () => {
        const matchEnd = document.getElementById('match-end');
        if (matchEnd) matchEnd.classList.add('hidden');
        game.startMatch({
            mode: ui.selectedMode,
            mapIndex: ui.selectedMap,
            botCount: ui.botCount,
            botDifficulty: ui.botDifficulty
        });
    };

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (game.running && !game.paused) game.pause();
            else if (game.running && game.paused) game.resume();
        }
    });

    document.addEventListener('click', () => Sound.ensureReady(), { once: true });
    document.addEventListener('keydown', () => Sound.ensureReady(), { once: true });

    ui.showScreen('main-menu');
    ui.updateMenuInfo();

    // ========= ANTI-CHEAT: Remove global references =========
    // Don't expose game/player/progression to window/console
    // (they only live inside this IIFE closure)

    // ========= FULLSCREEN TOGGLE =========
    function toggleFullscreen() {
        if (!document.fullscreenElement && !document.webkitFullscreenElement) {
            const el = document.documentElement;
            if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
            else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
        } else {
            if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
            else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        }
    }

    function updateFullscreenButtons() {
        const isFS = !!(document.fullscreenElement || document.webkitFullscreenElement);
        const btnGame = document.getElementById('btn-fullscreen');
        const btnMenu = document.getElementById('btn-fullscreen-menu');
        if (btnGame) btnGame.textContent = isFS ? '⛶' : '⛶';
        if (btnMenu) btnMenu.textContent = isFS ? '⛶ Exit Fullscreen' : '⛶ Fullscreen';
    }

    const btnFullscreen = document.getElementById('btn-fullscreen');
    if (btnFullscreen) btnFullscreen.addEventListener('click', toggleFullscreen);

    const btnFullscreenMenu = document.getElementById('btn-fullscreen-menu');
    if (btnFullscreenMenu) btnFullscreenMenu.addEventListener('click', toggleFullscreen);

    document.addEventListener('fullscreenchange', updateFullscreenButtons);
    document.addEventListener('webkitfullscreenchange', updateFullscreenButtons);

    // Also resize canvas on fullscreen change
    document.addEventListener('fullscreenchange', () => {
        setTimeout(() => game.resizeCanvas(), 100);
    });
    document.addEventListener('webkitfullscreenchange', () => {
        setTimeout(() => game.resizeCanvas(), 100);
    });

    console.log('%c🔫 THE GUN GAME loaded!', 'color: #ff0066; font-size: 16px; font-weight: bold;');
})();
