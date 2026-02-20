class Leaderboard {
    constructor() {
        this.storageKey = 'gun_game_leaderboard';
        this.maxEntries = 50;
        this.entries = this.load();
    }

    _getPlayerRankIn(entries, name) {
        const idx = entries.findIndex(e => e.name === name);
        return idx >= 0 ? idx + 1 : null;
    }

    _mapSupabaseRow(row) {
        const totalKills = Number(row.total_kills || 0);
        const totalDeaths = Number(row.total_deaths || 0);
        const kdValue = totalDeaths > 0 ? (totalKills / totalDeaths) : totalKills;
        return {
            name: row.name,
            totalKills: totalKills,
            totalDeaths: totalDeaths,
            totalWins: Number(row.total_wins || 0),
            bestScore: Number(row.best_score || 0),
            matches: Number(row.matches || 0),
            kd: Number(kdValue.toFixed(2)),
            lastPlayed: row.last_played ? Date.parse(row.last_played) : 0,
            isBot: false
        };
    }

    async fetchSupabaseTop(sortBy = 'bestScore', count = 20) {
        const sb = window.supabaseClient;
        if (!sb) return null;
        const sortMap = {
            bestScore: 'best_score',
            totalKills: 'total_kills',
            kd: 'kd',
            totalWins: 'total_wins',
            matches: 'matches'
        };
        const column = sortMap[sortBy] || 'best_score';
        const { data, error } = await sb
            .from('leaderboard')
            .select('*')
            .order(column, { ascending: false })
            .limit(count);
        if (error) {
            console.warn('Supabase leaderboard fetch failed', error);
            return null;
        }
        return (data || []).map(row => this._mapSupabaseRow(row));
    }

    async syncSupabaseEntry({ name, kills, deaths, wins, score }) {
        const sb = window.supabaseClient;
        if (!sb || !name) return;

        const { data: existing, error } = await sb
            .from('leaderboard')
            .select('total_kills,total_deaths,total_wins,best_score,matches')
            .eq('name', name)
            .maybeSingle();

        if (error) {
            console.warn('Supabase leaderboard fetch failed', error);
        }

        const totalKills = Number(existing?.total_kills || 0) + Number(kills || 0);
        const totalDeaths = Number(existing?.total_deaths || 0) + Number(deaths || 0);
        const totalWins = Number(existing?.total_wins || 0) + Number(wins || 0);
        const matches = Number(existing?.matches || 0) + 1;
        const bestScore = Math.max(Number(existing?.best_score || 0), Number(score || 0));
        const kdValue = totalDeaths > 0 ? (totalKills / totalDeaths) : totalKills;
        const kd = Number(kdValue.toFixed(2));

        const { error: upsertError } = await sb
            .from('leaderboard')
            .upsert({
                name,
                total_kills: totalKills,
                total_deaths: totalDeaths,
                total_wins: totalWins,
                best_score: bestScore,
                matches,
                kd,
                last_played: new Date().toISOString()
            }, { onConflict: 'name' });

        if (upsertError) {
            console.warn('Supabase leaderboard upsert failed', upsertError);
        }
    }

    load() {
        try {
            const data = localStorage.getItem(this.storageKey);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            return [];
        }
    }

    save() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.entries));
        } catch (e) {}
    }

    addEntry(name, kills, deaths, wins, score, isBot = false) {
        const kd = deaths > 0 ? (kills / deaths).toFixed(2) : kills.toFixed(2);
        const existing = this.entries.find(e => e.name === name);

        if (existing) {
            existing.totalKills += kills;
            existing.totalDeaths += deaths;
            existing.totalWins += wins;
            existing.bestScore = Math.max(existing.bestScore, score);
            existing.matches += 1;
            existing.kd = existing.totalDeaths > 0
                ? (existing.totalKills / existing.totalDeaths).toFixed(2)
                : existing.totalKills.toFixed(2);
            existing.lastPlayed = Date.now();
            existing.isBot = isBot;
        } else {
            this.entries.push({
                name,
                totalKills: kills,
                totalDeaths: deaths,
                totalWins: wins,
                bestScore: score,
                matches: 1,
                kd: parseFloat(kd),
                lastPlayed: Date.now(),
                isBot
            });
        }

        this.entries.sort((a, b) => b.bestScore - a.bestScore);
        if (this.entries.length > this.maxEntries) {
            this.entries = this.entries.slice(0, this.maxEntries);
        }
        this.save();
    }

    getTop(count = 20, sortBy = 'bestScore') {
        const sorted = [...this.entries].sort((a, b) => {
            if (sortBy === 'kd') return parseFloat(b.kd) - parseFloat(a.kd);
            if (sortBy === 'totalKills') return b.totalKills - a.totalKills;
            if (sortBy === 'totalWins') return b.totalWins - a.totalWins;
            if (sortBy === 'matches') return b.matches - a.matches;
            return b.bestScore - a.bestScore;
        });
        return sorted.slice(0, count);
    }

    getPlayerRank(name) {
        const idx = this.entries.findIndex(e => e.name === name);
        return idx >= 0 ? idx + 1 : null;
    }

    clear() {
        this.entries = [];
        this.save();
    }

    renderHTML(playerName, sortBy = 'bestScore', entriesOverride = null) {
        const useOverride = Array.isArray(entriesOverride);
        const top = useOverride ? entriesOverride.slice(0, 20) : this.getTop(20, sortBy);
        const playerRank = useOverride ? this._getPlayerRankIn(entriesOverride, playerName) : this.getPlayerRank(playerName);

        const tabs = ['bestScore', 'totalKills', 'kd', 'totalWins', 'matches'];
        const tabLabels = { bestScore: '🏆 Score', totalKills: '💀 Kills', kd: '📊 K/D', totalWins: '🥇 Wins', matches: '🎮 Matches' };

        let html = `<div class="lb-tabs">`;
        for (const tab of tabs) {
            const active = tab === sortBy ? 'lb-tab-active' : '';
            html += `<button class="lb-tab ${active}" data-sort="${tab}">${tabLabels[tab]}</button>`;
        }
        html += `</div>`;

        html += `<div class="lb-table-wrap"><table class="lb-table">`;
        html += `<tr class="lb-header"><th>#</th><th>Player</th><th>Score</th><th>Kills</th><th>Deaths</th><th>K/D</th><th>Wins</th><th>Matches</th></tr>`;

        if (top.length === 0) {
            html += `<tr><td colspan="8" style="text-align:center;padding:30px;color:#888;">No data yet — play a match!</td></tr>`;
        }

        top.forEach((entry, i) => {
            const rank = i + 1;
            const isPlayer = entry.name === playerName;
            const rowClass = isPlayer ? 'lb-row-you' : (entry.isBot ? 'lb-row-bot' : '');
            const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}`;
            const botTag = entry.isBot ? ' <span class="lb-bot-tag">BOT</span>' : '';

            html += `<tr class="lb-row ${rowClass}">`;
            html += `<td class="lb-rank">${medal}</td>`;
            html += `<td class="lb-name">${entry.name}${botTag}${isPlayer ? ' <span class="lb-you-tag">YOU</span>' : ''}</td>`;
            html += `<td>${entry.bestScore}</td>`;
            html += `<td>${entry.totalKills}</td>`;
            html += `<td>${entry.totalDeaths}</td>`;
            html += `<td>${entry.kd}</td>`;
            html += `<td>${entry.totalWins}</td>`;
            html += `<td>${entry.matches}</td>`;
            html += `</tr>`;
        });

        html += `</table></div>`;

        if (!useOverride && playerRank && playerRank > 20) {
            const p = this.entries[playerRank - 1];
            html += `<div class="lb-your-rank">Your rank: #${playerRank} — Score: ${p.bestScore} | K/D: ${p.kd}</div>`;
        }

        return html;
    }
}

const leaderboard = new Leaderboard();
window.leaderboard = leaderboard;
