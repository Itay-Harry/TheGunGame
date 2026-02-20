class Progression {
    constructor() {
        this._saveKey = 'gunGameProgress';
        this.load();
    }

    // Simple hash to detect manual localStorage tampering
    static _computeHash(data) {
        const str = JSON.stringify(data);
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const ch = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + ch;
            hash |= 0;
        }
        // Mix with a salt so it's not trivially reproducible
        return ((hash ^ 0x5F3759DF) >>> 0).toString(36);
    }

    getDefaults() {
        return {
            level: 1, xp: 0, coins: 100,
            totalKills: 0, totalDeaths: 0, totalWins: 0, totalGames: 0,
            totalHeadshots: 0, perfectWins: 0, bestSniperKills: 0,
            ownedSkins: ['default'], equippedSkin: 'default',
            ownedWeaponSkins: ['default'], equippedWeaponSkin: 'default',
            ownedEmotes: ['wave'], equippedEmote: 'wave',
            ownedTitles: ['newbie'], equippedTitle: 'newbie',
            unlockedWeapons: ['pistol', 'shotgun', 'smg'],
            completedAchievements: [],
            dailyChallenges: [], lastChallengeDate: null,
            lastLoginDate: null, loginStreak: 0
        };
    }

    load() {
        const defaults = this.getDefaults();
        try {
            const raw = localStorage.getItem(this._saveKey);
            if (!raw) { this.data = defaults; this.save(); return; }
            const parsed = JSON.parse(raw);
            const savedHash = parsed._h;
            delete parsed._h;

            // Verify integrity hash
            if (savedHash !== Progression._computeHash(parsed)) {
                console.warn('Save data integrity check failed — resetting.');
                this.data = defaults;
                this.save();
                return;
            }

            this.data = { ...defaults, ...parsed };
        } catch {
            this.data = defaults;
        }

        this._validateData();
        this.checkDailyLogin();
        this.refreshDailyChallenges();
    }

    save() {
        try {
            const toSave = { ...this.data };
            toSave._h = Progression._computeHash(toSave);
            localStorage.setItem(this._saveKey, JSON.stringify(toSave));
        } catch {}
    }

    // ========= ANTI-CHEAT: Validate all values =========
    _validateData() {
        const d = this.data;
        const defs = this.getDefaults();

        // Clamp numeric values to sane ranges
        d.level = this._clampInt(d.level, 1, 200);
        d.xp = this._clampInt(d.xp, 0, 50000);
        d.coins = this._clampInt(d.coins, 0, 999999);
        d.totalKills = this._clampInt(d.totalKills, 0, 999999);
        d.totalDeaths = this._clampInt(d.totalDeaths, 0, 999999);
        d.totalWins = this._clampInt(d.totalWins, 0, 999999);
        d.totalGames = this._clampInt(d.totalGames, 0, 999999);
        d.totalHeadshots = this._clampInt(d.totalHeadshots, 0, 999999);
        d.perfectWins = this._clampInt(d.perfectWins, 0, 999999);
        d.bestSniperKills = this._clampInt(d.bestSniperKills, 0, 100);
        d.loginStreak = this._clampInt(d.loginStreak, 0, 365);

        // Wins can't exceed total games
        if (d.totalWins > d.totalGames) d.totalWins = d.totalGames;
        // Headshots can't exceed kills
        if (d.totalHeadshots > d.totalKills) d.totalHeadshots = d.totalKills;

        // Validate arrays — must only contain known IDs
        const validSkinIds = PLAYER_SKINS.map(s => s.id);
        const validWepSkinIds = WEAPON_SKINS.map(s => s.id);
        const validEmoteIds = EMOTES.map(s => s.id);
        const validTitleIds = TITLES.map(s => s.id);
        const validWeaponIds = Object.keys(WEAPONS);
        const validAchIds = ACHIEVEMENTS.map(a => a.id);

        d.ownedSkins = this._filterValid(d.ownedSkins, validSkinIds, ['default']);
        d.ownedWeaponSkins = this._filterValid(d.ownedWeaponSkins, validWepSkinIds, ['default']);
        d.ownedEmotes = this._filterValid(d.ownedEmotes, validEmoteIds, ['wave']);
        d.ownedTitles = this._filterValid(d.ownedTitles, validTitleIds, ['newbie']);
        d.unlockedWeapons = this._filterValid(d.unlockedWeapons, validWeaponIds, ['pistol', 'shotgun', 'smg']);
        d.completedAchievements = this._filterValid(d.completedAchievements, validAchIds, []);

        // Equipped items must be owned
        if (!d.ownedSkins.includes(d.equippedSkin)) d.equippedSkin = 'default';
        if (!d.ownedWeaponSkins.includes(d.equippedWeaponSkin)) d.equippedWeaponSkin = 'default';
        if (!d.ownedEmotes.includes(d.equippedEmote)) d.equippedEmote = 'wave';
        if (!d.ownedTitles.includes(d.equippedTitle)) d.equippedTitle = 'newbie';

        // Validate owned items weren't "given" without enough coin history
        // (level * COINS_PER_LEVEL + starting 100 = max coins ever earned, roughly)
        // This is a soft check — doesn't account for challenge/achievement rewards perfectly
        // but catches blatant edits like coins=999999 at level 1
        const maxPossibleCoinsEarned = 100 + d.level * COINS_PER_LEVEL + d.totalWins * 50 +
            d.completedAchievements.length * 800 + d.totalGames * 30 + d.loginStreak * DAILY_REWARD_COINS;
        const totalSpent = this._estimateSpent(d);
        if (d.coins > maxPossibleCoinsEarned) {
            d.coins = Math.min(d.coins, maxPossibleCoinsEarned - totalSpent);
            if (d.coins < 0) d.coins = 0;
        }
    }

    _clampInt(val, min, max) {
        if (typeof val !== 'number' || isNaN(val)) return min;
        return Math.max(min, Math.min(max, Math.floor(val)));
    }

    _filterValid(arr, validIds, fallback) {
        if (!Array.isArray(arr)) return [...fallback];
        const filtered = arr.filter(id => typeof id === 'string' && validIds.includes(id));
        // Ensure fallback items are always present
        for (const f of fallback) {
            if (!filtered.includes(f)) filtered.unshift(f);
        }
        // Remove duplicates
        return [...new Set(filtered)];
    }

    _estimateSpent(d) {
        let spent = 0;
        const countSpent = (owned, catalog, defaultId) => {
            for (const id of owned) {
                if (id === defaultId) continue;
                const item = catalog.find(i => i.id === id);
                if (item) spent += item.price;
            }
        };
        countSpent(d.ownedSkins, PLAYER_SKINS, 'default');
        countSpent(d.ownedWeaponSkins, WEAPON_SKINS, 'default');
        countSpent(d.ownedEmotes, EMOTES, 'wave');
        countSpent(d.ownedTitles, TITLES, 'newbie');
        return spent;
    }

    checkDailyLogin() {
        const today = new Date().toDateString();
        if (this.data.lastLoginDate !== today) {
            this.data.lastLoginDate = today;
            this.data.loginStreak = (this.data.loginStreak || 0) + 1;
            const reward = DAILY_REWARD_COINS * Math.min(this.data.loginStreak, 7);
            this.data.coins += reward;
            this._dailyLoginReward = reward;
            this.save();
        } else {
            this._dailyLoginReward = 0;
        }
    }

    getDailyLoginReward() {
        const r = this._dailyLoginReward || 0;
        this._dailyLoginReward = 0;
        return r;
    }

    addXP(amount) {
        this.data.xp += amount;
        let leveled = false;
        let levelUps = 0;
        while (this.data.xp >= XP_PER_LEVEL(this.data.level)) {
            this.data.xp -= XP_PER_LEVEL(this.data.level);
            this.data.level++;
            this.data.coins += COINS_PER_LEVEL;
            leveled = true;
            levelUps++;
            this.onLevelUp();
        }
        this.save();
        return { leveled, levelUps };
    }

    onLevelUp() {
        const lvl = this.data.level;
        const unlocks = [
            [3, 'assault'], [5, 'sniper'], [7, 'laser'], [9, 'slime'], [12, 'rocket']
        ];
        for (const [reqLvl, wep] of unlocks) {
            if (lvl >= reqLvl && !this.data.unlockedWeapons.includes(wep)) {
                this.data.unlockedWeapons.push(wep);
            }
        }
    }

    addCoins(amount) {
        this.data.coins += amount;
        this.save();
    }

    purchase(type, id) {
        let items, ownedKey;
        switch (type) {
            case 'skins': items = PLAYER_SKINS; ownedKey = 'ownedSkins'; break;
            case 'weapon-skins': items = WEAPON_SKINS; ownedKey = 'ownedWeaponSkins'; break;
            case 'emotes': items = EMOTES; ownedKey = 'ownedEmotes'; break;
            case 'titles': items = TITLES; ownedKey = 'ownedTitles'; break;
            default: return false;
        }
        const item = items.find(i => i.id === id);
        if (!item) return false;
        if (this.data[ownedKey].includes(id)) return false;
        if (this.data.coins < item.price) return false;
        this.data.coins -= item.price;
        this.data[ownedKey].push(id);
        this.save();
        return true;
    }

    equip(type, id) {
        const map = {
            'skins': ['ownedSkins', 'equippedSkin'],
            'weapon-skins': ['ownedWeaponSkins', 'equippedWeaponSkin'],
            'emotes': ['ownedEmotes', 'equippedEmote'],
            'titles': ['ownedTitles', 'equippedTitle']
        };
        const entry = map[type];
        if (entry && this.data[entry[0]].includes(id)) {
            this.data[entry[1]] = id;
            this.save();
        }
    }

    recordMatchEnd(playerStats, won) {
        this.data.totalKills += playerStats.kills;
        this.data.totalDeaths += playerStats.deaths;
        this.data.totalHeadshots += playerStats.headshots;
        this.data.totalGames++;
        if (won) this.data.totalWins++;
        if (won && playerStats.deaths === 0) this.data.perfectWins++;
        if (playerStats.sniperKills !== undefined) {
            this.data.bestSniperKills = Math.max(this.data.bestSniperKills || 0, playerStats.sniperKills);
        }

        let totalXP = playerStats.kills * XP_FOR_KILL +
                       playerStats.headshots * XP_FOR_HEADSHOT +
                       (playerStats.flagCaptures || 0) * XP_FOR_FLAG_CAPTURE;
        if (won) totalXP += XP_FOR_WIN;

        const levelResult = this.addXP(totalXP);
        const newAchievements = this.checkAchievements();
        this.updateChallenges(playerStats, won);

        this.save();
        return { xpEarned: totalXP, leveled: levelResult.leveled, newAchievements };
    }

    checkAchievements() {
        const newOnes = [];
        for (const ach of ACHIEVEMENTS) {
            if (this.data.completedAchievements.includes(ach.id)) continue;
            if (ach.check(this.data)) {
                this.data.completedAchievements.push(ach.id);
                this.data.coins += ach.reward;
                newOnes.push(ach);
            }
        }
        return newOnes;
    }

    refreshDailyChallenges() {
        const today = new Date().toDateString();
        if (this.data.lastChallengeDate === today && this.data.dailyChallenges && this.data.dailyChallenges.length > 0) return;

        this.data.lastChallengeDate = today;
        const allChallenges = [
            { id: 'kills_5', desc: 'Get 5 kills in a match', target: 5, progress: 0, reward: 50, type: 'kills', completed: false },
            { id: 'kills_10', desc: 'Get 10 kills in a match', target: 10, progress: 0, reward: 100, type: 'kills', completed: false },
            { id: 'headshots_3', desc: 'Get 3 headshots in a match', target: 3, progress: 0, reward: 75, type: 'headshots', completed: false },
            { id: 'play_3', desc: 'Play 3 matches', target: 3, progress: 0, reward: 60, type: 'games', completed: false },
            { id: 'win_1', desc: 'Win a match', target: 1, progress: 0, reward: 80, type: 'wins', completed: false },
            { id: 'damage_500', desc: 'Deal 500 damage in a match', target: 500, progress: 0, reward: 70, type: 'damage', completed: false },
        ];
        this.data.dailyChallenges = Utils.shuffle(allChallenges).slice(0, 3);
        this.save();
    }

    updateChallenges(stats, won) {
        if (!this.data.dailyChallenges) return;
        for (const ch of this.data.dailyChallenges) {
            if (ch.completed) continue;
            switch (ch.type) {
                case 'kills': ch.progress = Math.max(ch.progress, stats.kills); break;
                case 'headshots': ch.progress = Math.max(ch.progress, stats.headshots); break;
                case 'games': ch.progress = (ch.progress || 0) + 1; break;
                case 'wins': if (won) ch.progress = (ch.progress || 0) + 1; break;
                case 'damage': ch.progress = Math.max(ch.progress, Math.floor(stats.damageDealt)); break;
            }
            if (ch.progress >= ch.target && !ch.completed) {
                ch.completed = true;
                this.data.coins += ch.reward;
            }
        }
        this.save();
    }

    getPlayerSkin() {
        return PLAYER_SKINS.find(s => s.id === this.data.equippedSkin) || PLAYER_SKINS[0];
    }

    getStartingWeapons() {
        const weapons = ['pistol'];
        const available = this.data.unlockedWeapons.filter(w => w !== 'pistol' && WEAPONS[w]);
        for (let i = 0; i < Math.min(2, available.length); i++) {
            weapons.push(available[i]);
        }
        return weapons;
    }
}
