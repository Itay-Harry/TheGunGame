class GameMode {
    constructor(type) {
        this.type = type;
        this.timer = MATCH_DURATION;
        this.ended = false;
        this.winner = null;
        this.teamScores = { red: 0, blue: 0 };

        // CTF state
        this.redFlagCarrier = null;
        this.blueFlagCarrier = null;
        this.redFlagPos = null;
        this.blueFlagPos = null;
        this.flagReturnTimers = { red: 0, blue: 0 };
    }

    update(players, map, dt) {
        if (this.ended) return;

        this.timer -= dt;
        if (this.timer <= 0) {
            this.timer = 0;
            this.endMatch(players);
            return;
        }

        switch (this.type) {
            case 'ffa': this.updateFFA(players); break;
            case 'tdm': this.updateTDM(players); break;
            case 'ctf': this.updateCTF(players, map, dt); break;
        }
    }

    updateFFA(players) {
        for (const p of players) {
            if (p.kills >= MAX_KILLS_FFA) {
                this.winner = p;
                this.endMatch(players);
                return;
            }
        }
    }

    updateTDM(players) {
        this.teamScores.red = players.filter(p => p.team === 'red').reduce((s, p) => s + p.kills, 0);
        this.teamScores.blue = players.filter(p => p.team === 'blue').reduce((s, p) => s + p.kills, 0);

        if (this.teamScores.red >= MAX_KILLS_TDM) {
            this.winner = 'red';
            this.endMatch(players);
        } else if (this.teamScores.blue >= MAX_KILLS_TDM) {
            this.winner = 'blue';
            this.endMatch(players);
        }
    }

    updateCTF(players, map, dt) {
        if (!map.flags) return;

        const PICKUP_DIST = 35; // pixel distance for flag interaction

        for (const p of players) {
            if (!p.alive || p.hasFlag) continue;
            const px = p.getCenterX();
            const py = p.getCenterY();

            // Pick up enemy flag
            if (p.team === 'red' && !this.blueFlagCarrier) {
                const flagPos = this.blueFlagPos || map.flags.blue;
                const fx = flagPos.x * TILE_SIZE;
                const fy = flagPos.y * TILE_SIZE;
                if (Utils.dist(px, py, fx, fy) < PICKUP_DIST) {
                    this.blueFlagCarrier = p;
                    p.hasFlag = 'blue';
                    this.blueFlagPos = null;
                    this.flagReturnTimers.blue = 0;
                }
            }
            if (p.team === 'blue' && !this.redFlagCarrier) {
                const flagPos = this.redFlagPos || map.flags.red;
                const fx = flagPos.x * TILE_SIZE;
                const fy = flagPos.y * TILE_SIZE;
                if (Utils.dist(px, py, fx, fy) < PICKUP_DIST) {
                    this.redFlagCarrier = p;
                    p.hasFlag = 'red';
                    this.redFlagPos = null;
                    this.flagReturnTimers.red = 0;
                }
            }
        }

        // Check captures (player carrying flag touches own base)
        for (const p of players) {
            if (!p.alive || !p.hasFlag) continue;
            const px = p.getCenterX();
            const py = p.getCenterY();

            if (p.hasFlag === 'blue' && p.team === 'red') {
                const base = map.flags.red;
                if (Utils.dist(px, py, base.x * TILE_SIZE, base.y * TILE_SIZE) < PICKUP_DIST) {
                    this.teamScores.red++;
                    p.flagCaptures++;
                    p.score += 200;
                    p.hasFlag = null;
                    this.blueFlagCarrier = null;
                    this.blueFlagPos = null;
                    Sound.playPickup();
                    if (this.teamScores.red >= CTF_CAPTURES_TO_WIN) {
                        this.winner = 'red';
                        this.endMatch([]);
                    }
                }
            }
            if (p.hasFlag === 'red' && p.team === 'blue') {
                const base = map.flags.blue;
                if (Utils.dist(px, py, base.x * TILE_SIZE, base.y * TILE_SIZE) < PICKUP_DIST) {
                    this.teamScores.blue++;
                    p.flagCaptures++;
                    p.score += 200;
                    p.hasFlag = null;
                    this.redFlagCarrier = null;
                    this.redFlagPos = null;
                    Sound.playPickup();
                    if (this.teamScores.blue >= CTF_CAPTURES_TO_WIN) {
                        this.winner = 'blue';
                        this.endMatch([]);
                    }
                }
            }
        }

        // Return dropped flags after timer
        for (const flagColor of ['red', 'blue']) {
            const pos = flagColor === 'red' ? this.redFlagPos : this.blueFlagPos;
            if (pos) {
                this.flagReturnTimers[flagColor] += dt;
                if (this.flagReturnTimers[flagColor] > 10) {
                    if (flagColor === 'red') this.redFlagPos = null;
                    else this.blueFlagPos = null;
                    this.flagReturnTimers[flagColor] = 0;
                }
            }
        }
    }

    onPlayerDeath(deadPlayer, killer, map) {
        if (deadPlayer.hasFlag) {
            const flagColor = deadPlayer.hasFlag;
            const dropPos = {
                x: deadPlayer.getCenterX() / TILE_SIZE,
                y: deadPlayer.getCenterY() / TILE_SIZE
            };
            if (flagColor === 'red') {
                this.redFlagCarrier = null;
                this.redFlagPos = dropPos;
                this.flagReturnTimers.red = 0;
            } else {
                this.blueFlagCarrier = null;
                this.blueFlagPos = dropPos;
                this.flagReturnTimers.blue = 0;
            }
            deadPlayer.hasFlag = null;
        }
    }

    endMatch(players) {
        if (this.ended) return; // prevent double-end
        this.ended = true;
        if (!this.winner && players.length > 0) {
            switch (this.type) {
                case 'ffa': {
                    let best = players[0];
                    for (const p of players) {
                        if (p.kills > best.kills) best = p;
                    }
                    this.winner = best;
                    break;
                }
                case 'tdm':
                case 'ctf':
                    this.winner = this.teamScores.red >= this.teamScores.blue ? 'red' : 'blue';
                    break;
            }
        }
    }

    getScoreDisplay() {
        switch (this.type) {
            case 'ffa': return '';
            case 'tdm': return `🔴 ${this.teamScores.red} - ${this.teamScores.blue} 🔵`;
            case 'ctf': return `🔴 ${this.teamScores.red} - ${this.teamScores.blue} 🔵  (First to ${CTF_CAPTURES_TO_WIN})`;
            default: return '';
        }
    }

    assignTeams(players) {
        if (this.type === 'ffa') {
            players.forEach(p => p.team = null);
            return;
        }
        // Ensure human is always on red for consistency
        const human = players.find(p => p.isHuman);
        const bots = players.filter(p => !p.isHuman);
        const shuffledBots = Utils.shuffle(bots);

        if (human) human.team = 'red';

        const halfBots = Math.ceil(shuffledBots.length / 2);
        shuffledBots.forEach((p, i) => {
            // Put first half on red (with human), second half on blue
            // But balance: human counts as 1 on red
            p.team = i < halfBots - (human ? 1 : 0) ? 'red' : 'blue';
        });

        // Make sure blue team has at least one
        if (!players.some(p => p.team === 'blue') && shuffledBots.length > 0) {
            shuffledBots[shuffledBots.length - 1].team = 'blue';
        }
    }
}
