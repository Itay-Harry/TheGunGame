class UI {
    constructor(progression) {
        this.progression = progression;
        this.currentScreen = 'main-menu';
        this.selectedMode = 'ffa';
        this.selectedMap = 0;
        this.botCount = 3;
        this.botDifficulty = 'hard';
        this.customizeTab = 'skins';
        this.selectedPlayers = '1p';
        this.practiceMap = 'aim';

        // Callback slots — must be defined here so Object.seal() doesn't block them
        this.onStartGame = null;
        this.onPause = null;
        this.onResume = null;
        this.onQuit = null;
        this.onPlayAgain = null;

        // Internal timeout refs
        this._hitTimeout = null;
        this._dmgTimeout = null;

        this.setupMenuListeners();
        this.updateMenuInfo();
        this.showDailyLogin();
    }

    showScreen(id) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        const el = document.getElementById(id);
        if (el) el.classList.add('active');
        this.currentScreen = id;
    }

    showDailyLogin() {
        const reward = this.progression.getDailyLoginReward();
        if (reward > 0) {
            setTimeout(() => {
                this.showNotification(`🎁 Daily Login: +${reward} coins! (Day ${this.progression.data.loginStreak})`, '#ffcc00');
            }, 500);
        }
    }

    setupMenuListeners() {
        // Helper for button event binding
        const on = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };

        // Practice Mode start button
        on('btn-start-practice', () => {
            if (this.onStartPractice) this.onStartPractice({
                botDifficulty: this.practiceBotDifficulty || 'easy',
                weaponMode: this.practiceWeaponMode || 'any',
                map: this.practiceMap || 'aim',
                infiniteAmmo: !!this.practiceInfiniteAmmo,
                noRecoil: !!this.practiceNoRecoil,
                headshotOnly: !!this.practiceHeadshotOnly
            });
        });

        // Practice menu option selection (basic, to be expanded)
        const practiceDiffBtns = document.querySelectorAll('#practice-menu .mode-select [data-diff]');
        practiceDiffBtns.forEach(btn => {
            btn.onclick = () => {
                practiceDiffBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.practiceBotDifficulty = btn.dataset.diff;
            };
        });

        const practiceWeaponBtns = document.querySelectorAll('#practice-menu .mode-select [data-weapon]');
        practiceWeaponBtns.forEach(btn => {
            btn.onclick = () => {
                practiceWeaponBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.practiceWeaponMode = btn.dataset.weapon;
            };
        });

        const practiceMapBtns = document.querySelectorAll('#practice-menu .map-card');
        practiceMapBtns.forEach(btn => {
            btn.onclick = () => {
                practiceMapBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.practiceMap = btn.dataset.map;
            };
        });

        // Practice toggles
        this.practiceInfiniteAmmo = false;
        this.practiceNoRecoil = false;
        this.practiceHeadshotOnly = false;
        const infAmmo = document.getElementById('infinite-ammo');
        if (infAmmo) infAmmo.onchange = (e) => { this.practiceInfiniteAmmo = e.target.checked; };
        const noRecoil = document.getElementById('no-recoil');
        if (noRecoil) noRecoil.onchange = (e) => { this.practiceNoRecoil = e.target.checked; };
        const hsOnly = document.getElementById('headshot-only');
        if (hsOnly) hsOnly.onchange = (e) => { this.practiceHeadshotOnly = e.target.checked; };


        // Main menu buttons
        on('btn-play', () => { this.showScreen('play-menu'); this.buildMapSelect(); Sound.ensureReady(); });
        on('btn-practice', () => { this.showScreen('practice-menu'); this.buildPracticeMenu && this.buildPracticeMenu(); Sound.ensureReady(); });
        on('btn-customize', () => { this.showScreen('customize-screen'); this.buildCustomize(); Sound.ensureReady(); });
        on('btn-challenges', () => { this.showScreen('challenges-screen'); this.buildChallenges(); });
        on('btn-achievements', () => { this.showScreen('achievements-screen'); this.buildAchievements(); });
        on('btn-how-to-play', () => { this.showScreen('howtoplay-screen'); });

        on('btn-back-play', () => this.showScreen('main-menu'));
        on('btn-back-customize', () => { this.showScreen('main-menu'); this.updateMenuInfo(); });
        on('btn-back-challenges', () => this.showScreen('main-menu'));
        on('btn-back-achievements', () => this.showScreen('main-menu'));
        on('btn-back-howtoplay', () => this.showScreen('main-menu'));

        // Game mode select
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.selectedMode = btn.dataset.mode;
            };
        });

        // Bot options
        const botCountEl = document.getElementById('bot-count');
        if (botCountEl) {
            botCountEl.oninput = (e) => {
                this.botCount = parseInt(e.target.value);
                document.getElementById('bot-count-val').textContent = this.botCount;
            };
        }
        const botDiffEl = document.getElementById('bot-difficulty');
        if (botDiffEl) {
            botDiffEl.onchange = (e) => { this.botDifficulty = e.target.value; };
        }

        // Customize tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.customizeTab = btn.dataset.tab;
                this.buildCustomize();
            };
        });

        // Player count buttons
        document.querySelectorAll('[data-players]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('[data-players]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.selectedPlayers = btn.dataset.players;
            });
        });

        // Start game
        on('btn-start-game', () => { if (this.onStartGame) this.onStartGame({
            mode: this.selectedMode, mapIndex: this.selectedMap,
            botCount: this.botCount, botDifficulty: this.botDifficulty,
            players: this.selectedPlayers
        }); });

        // Pause
        on('btn-pause', () => { if (this.onPause) this.onPause(); });
        on('btn-resume', () => { if (this.onResume) this.onResume(); });
        on('btn-quit', () => { if (this.onQuit) this.onQuit(); });

        // Match end
        on('btn-play-again', () => { if (this.onPlayAgain) this.onPlayAgain(); });
        on('btn-to-menu', () => {
            document.getElementById('match-end').classList.add('hidden');
            this.showScreen('main-menu');
            this.updateMenuInfo();
        });
    }

    updateMenuInfo() {
        const d = this.progression.data;
        const lvlEl = document.getElementById('menu-level');
        if (lvlEl) lvlEl.textContent = d.level;
        const xpNeeded = XP_PER_LEVEL(d.level);
        const xpBar = document.getElementById('menu-xp-bar');
        if (xpBar) xpBar.style.width = `${(d.xp / xpNeeded) * 100}%`;
        const xpText = document.getElementById('menu-xp-text');
        if (xpText) xpText.textContent = `${d.xp} / ${xpNeeded} XP`;
    }

    buildMapSelect() {
        const container = document.getElementById('map-select');
        if (!container) return;
        container.innerHTML = '';
        MAPS.forEach((m, i) => {
            const card = document.createElement('div');
            card.className = `map-card${i === this.selectedMap ? ' active' : ''}`;
            card.innerHTML = `<div class="map-icon">${m.icon}</div><div class="map-name">${m.name}</div><div class="map-size">${m.size}</div>`;
            card.onclick = () => {
                container.querySelectorAll('.map-card').forEach(c => c.classList.remove('active'));
                card.classList.add('active');
                this.selectedMap = i;
            };
            container.appendChild(card);
        });
    }

    buildCustomize() {
        const container = document.getElementById('customize-content');
        if (!container) return;
        container.innerHTML = '';
        const currEl = document.getElementById('currency-display');
        if (currEl) currEl.textContent = this.progression.data.coins;

        let items, ownedKey, equippedKey;
        switch (this.customizeTab) {
            case 'skins': items = PLAYER_SKINS; ownedKey = 'ownedSkins'; equippedKey = 'equippedSkin'; break;
            case 'weapon-skins': items = WEAPON_SKINS; ownedKey = 'ownedWeaponSkins'; equippedKey = 'equippedWeaponSkin'; break;
            case 'emotes': items = EMOTES; ownedKey = 'ownedEmotes'; equippedKey = 'equippedEmote'; break;
            case 'titles': items = TITLES; ownedKey = 'ownedTitles'; equippedKey = 'equippedTitle'; break;
            default: return;
        }

        for (const item of items) {
            const owned = this.progression.data[ownedKey].includes(item.id);
            const equipped = this.progression.data[equippedKey] === item.id;
            const div = document.createElement('div');
            div.className = `customize-item${owned ? ' owned' : ' locked'}${equipped ? ' equipped' : ''}`;

            let iconHTML;
            if (item.icon) {
                iconHTML = item.icon;
            } else if (item.color) {
                iconHTML = `<div style="width:40px;height:40px;border-radius:50%;background:${item.color};margin:0 auto"></div>`;
            } else {
                iconHTML = '🏷️';
            }

            div.innerHTML = `
                <div class="item-icon">${iconHTML}</div>
                <div class="item-name">${item.name}</div>
                ${equipped ? '<div style="color:#ffcc00;font-size:11px">✓ EQUIPPED</div>' : ''}
                ${!owned ? `<div class="item-price">💰 ${item.price}</div>` : (owned && !equipped ? '<div style="color:#888;font-size:11px">Click to equip</div>' : '')}
            `;
            div.onclick = () => {
                if (owned) {
                    this.progression.equip(this.customizeTab, item.id);
                    Sound.ensureReady();
                    Sound.playPickup();
                } else {
                    if (this.progression.purchase(this.customizeTab, item.id)) {
                        Sound.ensureReady();
                        Sound.playPickup();
                    }
                }
                this.buildCustomize();
            };
            container.appendChild(div);
        }
    }

    buildChallenges() {
        const list = document.getElementById('challenges-list');
        if (!list) return;
        list.innerHTML = '';
        const challenges = this.progression.data.dailyChallenges || [];
        if (challenges.length === 0) {
            list.innerHTML = '<div style="padding:30px;text-align:center;color:#888">No challenges yet. Play a match!</div>';
            return;
        }
        for (const ch of challenges) {
            const pct = Math.min(100, ((ch.progress || 0) / ch.target) * 100);
            const div = document.createElement('div');
            div.className = `challenge-item${ch.completed ? ' completed' : ''}`;
            div.innerHTML = `
                <div class="challenge-icon">${ch.completed ? '✅' : '📋'}</div>
                <div class="challenge-info"><h4>${ch.desc}</h4><p>${ch.progress || 0} / ${ch.target}</p></div>
                <div class="challenge-progress"><div class="prog-bar"><div class="prog-fill" style="width:${pct}%"></div></div></div>
                <div class="challenge-reward">${ch.completed ? '✅ Done' : `💰 ${ch.reward}`}</div>
            `;
            list.appendChild(div);
        }
    }

    buildAchievements() {
        const list = document.getElementById('achievements-list');
        if (!list) return;
        list.innerHTML = '';
        for (const ach of ACHIEVEMENTS) {
            const completed = this.progression.data.completedAchievements.includes(ach.id);
            const div = document.createElement('div');
            div.className = `achievement-item${completed ? ' completed' : ''}`;
            div.innerHTML = `
                <div class="achievement-icon">${ach.icon}</div>
                <div class="achievement-info"><h4>${ach.name}</h4><p>${ach.desc}</p></div>
                <div class="achievement-reward">${completed ? '✅' : `💰 ${ach.reward}`}</div>
            `;
            list.appendChild(div);
        }
    }

    // === IN-GAME HUD ===

    updateHUD(player, gameMode, now) {
        if (!player) return;
        const setT = (id, t) => { const e = document.getElementById(id); if (e) e.textContent = t; };
        const setH = (id, h) => { const e = document.getElementById(id); if (e) e.innerHTML = h; };

        setT('hud-timer', Utils.formatTime(gameMode.timer));
        setT('hud-score', gameMode.getScoreDisplay());

        const modeNames = { ffa: 'Free-for-All', tdm: 'Team Deathmatch', ctf: 'Capture the Flag' };
        setT('hud-mode-info', `${modeNames[gameMode.type] || gameMode.type} | K: ${player.kills} D: ${player.deaths}`);

        const hpPct = (player.health / player.maxHealth) * 100;
        const hpBar = document.getElementById('hud-health-bar');
        if (hpBar) hpBar.style.width = `${hpPct}%`;
        setT('hud-health-text', Math.ceil(player.health));

        const w = player.currentWeapon;
        if (w && w.data) {
            const reloadText = w.reloading ? ' ⟳' : '';
            setT('hud-weapon-name', `${w.data.icon} ${w.data.name}${reloadText}`);
            setT('hud-ammo', `${w.ammo} / ${w.reserveAmmo}`);
        }

        // Abilities
        for (const [key, abData] of Object.entries(ABILITIES)) {
            const ab = player.abilities[key];
            const elId = key === 'invisibility' ? 'ability-invis' : `ability-${key}`;
            const el = document.getElementById(elId);
            if (!el) continue;
            const onCD = now < ab.cooldownEnd && !ab.active;
            const isActive = ab.active;
            el.classList.toggle('on-cooldown', onCD);
            el.classList.toggle('active-ability', isActive);
            if (onCD) {
                const remaining = Math.ceil((ab.cooldownEnd - now) / 1000);
                el.innerHTML = `<span>${abData.key.toUpperCase()}</span> ${remaining}s`;
            } else {
                el.innerHTML = `<span>${abData.key.toUpperCase()}</span> ${abData.name}`;
            }
        }

        this.updateWeaponsBar(player);
    }

    updateWeaponsBar(player) {
        const bar = document.getElementById('hud-weapons-bar');
        if (!bar) return;
        // Only rebuild if weapon count changed
        if (bar._lastCount !== player.weapons.length || bar._lastIdx !== player.currentWeaponIndex) {
            bar._lastCount = player.weapons.length;
            bar._lastIdx = player.currentWeaponIndex;
            bar.innerHTML = '';
            for (let i = 0; i < 5; i++) {
                const slot = document.createElement('div');
                slot.className = 'weapon-slot';
                if (i < player.weapons.length) {
                    const w = player.weapons[i];
                    if (i === player.currentWeaponIndex) slot.classList.add('active-slot');
                    slot.innerHTML = `<div class="slot-num">${i + 1}</div><div class="slot-icon">${w.data.icon}</div>`;
                    slot.onclick = () => player.switchWeapon(i);
                } else {
                    slot.classList.add('empty-slot');
                    slot.innerHTML = `<div class="slot-num">${i + 1}</div><div class="slot-icon">-</div>`;
                }
                bar.appendChild(slot);
            }
        }
    }

    addKillFeed(killerName, victimName, weaponIcon, isHeadshot) {
        const feed = document.getElementById('hud-killfeed');
        if (!feed) return;
        const entry = document.createElement('div');
        entry.className = 'killfeed-entry';
        entry.innerHTML = `<span class="killer">${killerName}</span>
            <span class="weapon-icon">${isHeadshot ? '💀' : weaponIcon}</span>
            <span class="victim">${victimName}</span>`;
        feed.appendChild(entry);
        setTimeout(() => { if (entry.parentNode) entry.remove(); }, 5000);
        while (feed.children.length > 5) feed.removeChild(feed.firstChild);
    }

    showHitmarker(isHeadshot = false) {
        const hm = document.getElementById('hud-hitmarker');
        if (!hm) return;
        hm.textContent = isHeadshot ? '✕' : '✕';
        hm.style.color = isHeadshot ? '#ff0000' : '#ffffff';
        hm.style.fontSize = isHeadshot ? '36px' : '28px';
        hm.classList.remove('show');
        void hm.offsetWidth;
        hm.classList.add('show');
        clearTimeout(this._hitTimeout);
        this._hitTimeout = setTimeout(() => hm.classList.remove('show'), isHeadshot ? 350 : 200);
    }

    showDamageOverlay() {
        const overlay = document.getElementById('hud-damage-overlay');
        if (!overlay) return;
        overlay.classList.add('flash');
        clearTimeout(this._dmgTimeout);
        this._dmgTimeout = setTimeout(() => overlay.classList.remove('flash'), 300);
    }

    showNotification(text, color = '#fff') {
        const container = document.getElementById('hud-notifications');
        if (!container) return;
        const notif = document.createElement('div');
        notif.className = 'notification';
        notif.style.color = color;
        notif.textContent = text;
        container.appendChild(notif);
        setTimeout(() => { if (notif.parentNode) notif.remove(); }, 2500);
    }

    showKillStreak(streakName, color) {
        this.showNotification(streakName, color);
        Sound.playKillStreak();
    }

    showPause() { const el = document.getElementById('pause-menu'); if (el) el.classList.remove('hidden'); }
    hidePause() { const el = document.getElementById('pause-menu'); if (el) el.classList.add('hidden'); }

    showScoreboard(players, localId) {
        const overlay = document.getElementById('scoreboard-overlay');
        if (!overlay) return;
        overlay.classList.remove('hidden');
        const body = document.getElementById('scoreboard-body');
        if (!body) return;
        body.innerHTML = '';

        const sorted = [...players].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
        sorted.forEach((p, i) => {
            const row = document.createElement('tr');
            const isLocal = p.id === localId;
            const teamClass = p.team === 'red' ? 'team-red' : p.team === 'blue' ? 'team-blue' : '';
            row.className = `${isLocal ? 'scoreboard-you' : ''} ${teamClass}`;
            row.innerHTML = `<td>${i + 1}</td><td>${p.name}${isLocal ? ' (You)' : ''}${p.killStreak >= 3 ? ' 🔥' : ''}</td>
                <td>${p.kills}</td><td>${p.deaths}</td><td>${p.score}</td>`;
            body.appendChild(row);
        });
    }

    hideScoreboard() { const el = document.getElementById('scoreboard-overlay'); if (el) el.classList.add('hidden'); }

    showMatchEnd(players, localPlayer, gameMode, xpResult) {
        const overlay = document.getElementById('match-end');
        if (!overlay) return;
        overlay.classList.remove('hidden');

        let won = false;
        if (gameMode.type === 'ffa') {
            won = gameMode.winner === localPlayer;
        } else {
            won = gameMode.winner === localPlayer.team;
        }

        const resultEl = document.getElementById('match-result');
        if (resultEl) {
            resultEl.textContent = won ? '🏆 VICTORY!' : '💀 DEFEAT';
            resultEl.style.color = won ? '#ffcc00' : '#ff4444';
        }

        if (won) Sound.playVictory(); else Sound.playDefeat();

        const mvp = [...players].sort((a, b) => b.kills - a.kills)[0];
        const mvpEl = document.getElementById('mvp-section');
        if (mvpEl) {
            mvpEl.innerHTML = `
                <div style="font-size:14px;color:#888">⭐ MVP</div>
                <div style="font-size:20px;font-weight:700">${mvp.name}</div>
                <div style="font-size:14px">K: ${mvp.kills} | D: ${mvp.deaths} | HS: ${mvp.headshots}</div>
            `;
        }

        const statsEl = document.getElementById('match-stats');
        if (statsEl) {
            statsEl.innerHTML = `
                <div class="stat"><div class="stat-val">${localPlayer.kills}</div><div class="stat-label">KILLS</div></div>
                <div class="stat"><div class="stat-val">${localPlayer.deaths}</div><div class="stat-label">DEATHS</div></div>
                <div class="stat"><div class="stat-val">${localPlayer.headshots}</div><div class="stat-label">HEADSHOTS</div></div>
                <div class="stat"><div class="stat-val">${Math.floor(localPlayer.damageDealt)}</div><div class="stat-label">DAMAGE</div></div>
            `;
        }

        const xpEl = document.getElementById('xp-reward');
        if (xpEl) {
            let achievText = '';
            if (xpResult.newAchievements && xpResult.newAchievements.length > 0) {
                achievText = '<br>' + xpResult.newAchievements.map(a => `🏆 ${a.name} (+${a.reward}💰)`).join('<br>');
            }
            xpEl.innerHTML = `+${xpResult.xpEarned} XP${xpResult.leveled ? ' 🎉 LEVEL UP!' : ''}${achievText}`;
        }
    }

    clearGameHUD() {
        const feed = document.getElementById('hud-killfeed');
        if (feed) feed.innerHTML = '';
        const notifs = document.getElementById('hud-notifications');
        if (notifs) notifs.innerHTML = '';
        const bar = document.getElementById('hud-weapons-bar');
        if (bar) { bar.innerHTML = ''; bar._lastCount = -1; }
    }

    updateP2HUD(player2) {
        if (!player2) return;
        const top = document.querySelector('.p2-hud-top');
        const bot = document.querySelector('.p2-hud-bottom');
        if (top) {
            const hpColor = player2.health > 50 ? '#00ff00' : player2.health > 25 ? '#ffcc00' : '#ff0000';
            top.innerHTML = `
                <div class="p2-health-text" style="color:${hpColor}">HP: ${Math.ceil(player2.health)}</div>
                <div class="p2-weapon-text">${player2.currentWeapon.data.icon} ${player2.currentWeapon.data.name}</div>
                <div class="p2-ammo-text">${player2.currentWeapon.ammo} / ${player2.currentWeapon.reserveAmmo}</div>
            `;
        }
    }
}
