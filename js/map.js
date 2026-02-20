class GameMap {
    constructor(data) {
        this.data = data;
        this.width = data.width * TILE_SIZE;
        this.height = data.height * TILE_SIZE;
        this.bg = data.bg || '#111';
        this.platforms = data.platforms || [];
        this.spawns = data.spawns || [];
        this.flags = data.flags || null;

        // Also set _mapWidth/_mapHeight for backward compatibility
        this._mapWidth = this.width;
        this._mapHeight = this.height;

        this.movingPlatforms = (data.movingPlatforms || []).map(mp => ({
            ...mp, origX: mp.x, origY: mp.y, currentX: mp.x, currentY: mp.y, t: Math.random()
        }));
    }

    update(dt) {
        for (const mp of this.movingPlatforms) {
            mp.t += mp.speed;
            const sin = Math.sin(mp.t * Math.PI * 2);
            mp.currentX = mp.origX + mp.moveX * sin;
            mp.currentY = mp.origY + mp.moveY * ((sin + 1) / 2);
        }
    }

    getAllPlatforms() {
        const all = [...this.platforms];
        for (const mp of this.movingPlatforms) {
            all.push({
                x: mp.currentX, y: mp.currentY,
                w: mp.w, h: mp.h, type: 'platform', moving: true
            });
        }
        // Attach map dimensions so player collision can use them
        all._mapWidth = this.width;
        all._mapHeight = this.height;
        return all;
    }

    getSpawnPoint(team) {
        if (team === 'red') {
            return this.spawns.filter((_, i) => i < Math.ceil(this.spawns.length / 2));
        } else if (team === 'blue') {
            return this.spawns.filter((_, i) => i >= Math.floor(this.spawns.length / 2));
        }
        return this.spawns;
    }

    render(ctx, camX, camY) {
        // Background
        ctx.fillStyle = this.data.bg;
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        // Background grid
        ctx.strokeStyle = 'rgba(255,255,255,0.03)';
        ctx.lineWidth = 1;
        const startX = Math.floor(camX / TILE_SIZE) * TILE_SIZE;
        const startY = Math.floor(camY / TILE_SIZE) * TILE_SIZE;
        for (let x = startX; x < camX + ctx.canvas.width + TILE_SIZE; x += TILE_SIZE) {
            ctx.beginPath(); ctx.moveTo(x - camX, 0); ctx.lineTo(x - camX, ctx.canvas.height); ctx.stroke();
        }
        for (let y = startY; y < camY + ctx.canvas.height + TILE_SIZE; y += TILE_SIZE) {
            ctx.beginPath(); ctx.moveTo(0, y - camY); ctx.lineTo(ctx.canvas.width, y - camY); ctx.stroke();
        }

        // Platforms
        const allPlats = this.getAllPlatforms();
        for (const p of allPlats) {
            const px = p.x * TILE_SIZE - camX;
            const py = p.y * TILE_SIZE - camY;
            const pw = p.w * TILE_SIZE;
            const ph = p.h * TILE_SIZE;

            if (px + pw < -10 || px > ctx.canvas.width + 10 || py + ph < -10 || py > ctx.canvas.height + 10) continue;

            if (p.type === 'solid') {
                ctx.fillStyle = '#2a2a3e';
                ctx.fillRect(px, py, pw, ph);
                ctx.strokeStyle = '#3a3a5e';
                ctx.lineWidth = 2;
                ctx.strokeRect(px, py, pw, ph);
                // Brick pattern
                ctx.strokeStyle = 'rgba(255,255,255,0.05)';
                ctx.lineWidth = 1;
                for (let bx = px; bx < px + pw; bx += 20) {
                    ctx.beginPath(); ctx.moveTo(bx, py); ctx.lineTo(bx, py + ph); ctx.stroke();
                }
                for (let by = py; by < py + ph; by += 10) {
                    ctx.beginPath(); ctx.moveTo(px, by); ctx.lineTo(px + pw, by); ctx.stroke();
                }
            } else {
                const gradient = ctx.createLinearGradient(px, py, px, py + ph);
                gradient.addColorStop(0, p.moving ? '#886600' : '#444466');
                gradient.addColorStop(1, p.moving ? '#664400' : '#333355');
                ctx.fillStyle = gradient;
                ctx.fillRect(px, py, pw, ph);
                ctx.strokeStyle = p.moving ? '#aa8800' : '#555588';
                ctx.lineWidth = 2;
                ctx.strokeRect(px, py, pw, ph);
                ctx.fillStyle = p.moving ? 'rgba(255,200,0,0.3)' : 'rgba(255,255,255,0.1)';
                ctx.fillRect(px, py, pw, 2);
            }
        }
    }

    renderFlags(ctx, camX, camY, gameState) {
        if (!this.flags) return;

        // Red flag
        if (!gameState.redFlagCarrier) {
            const pos = gameState.redFlagPos || this.flags.red;
            const fx = pos.x * TILE_SIZE - camX;
            const fy = pos.y * TILE_SIZE - camY;
            this.drawFlag(ctx, fx, fy, '#ff4444');
        }

        // Blue flag
        if (!gameState.blueFlagCarrier) {
            const pos = gameState.blueFlagPos || this.flags.blue;
            const fx = pos.x * TILE_SIZE - camX;
            const fy = pos.y * TILE_SIZE - camY;
            this.drawFlag(ctx, fx, fy, '#4488ff');
        }

        // Flag base indicators (always show)
        this.drawFlagBase(ctx, this.flags.red.x * TILE_SIZE - camX, this.flags.red.y * TILE_SIZE - camY, '#ff4444');
        this.drawFlagBase(ctx, this.flags.blue.x * TILE_SIZE - camX, this.flags.blue.y * TILE_SIZE - camY, '#4488ff');
    }

    drawFlagBase(ctx, x, y, color) {
        ctx.fillStyle = color.replace(')', ',0.2)').replace('rgb', 'rgba');
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x, y, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    }

    drawFlag(ctx, x, y, color) {
        // Pole
        ctx.fillStyle = '#aaa';
        ctx.fillRect(x - 1, y - 28, 3, 28);
        // Flag cloth
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(x + 2, y - 28);
        ctx.lineTo(x + 22, y - 20);
        ctx.lineTo(x + 2, y - 12);
        ctx.closePath();
        ctx.fill();
        // Outline
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();
    }
}
