class ParticleSystem {
    constructor() {
        this.particles = [];
        this.texts = [];
    }

    clear() { this.particles = []; this.texts = []; }

    addParticle(x, y, vx, vy, life, size, color, gravity = 0.1) {
        if (this.particles.length > 500) return; // cap for performance
        this.particles.push({ x, y, vx, vy, life, maxLife: life, size, color, gravity, alpha: 1 });
    }

    addText(x, y, text, color = '#fff', size = 16, life = 1.5) {
        this.texts.push({ x, y, text, color, size, life, maxLife: life, vy: -1.5 });
    }

    muzzleFlash(x, y, angle) {
        for (let i = 0; i < 6; i++) {
            const spread = Utils.rand(-0.4, 0.4);
            const speed = Utils.rand(3, 8);
            this.addParticle(x, y,
                Math.cos(angle + spread) * speed,
                Math.sin(angle + spread) * speed,
                Utils.rand(0.1, 0.25), Utils.rand(2, 5),
                Utils.randChoice(['#ffcc00', '#ff8800', '#ffff88']), 0);
        }
    }

    bulletImpact(x, y, color = '#ffcc00') {
        for (let i = 0; i < 8; i++) {
            const a = Utils.rand(0, Math.PI * 2);
            const s = Utils.rand(1, 5);
            this.addParticle(x, y, Math.cos(a) * s, Math.sin(a) * s,
                Utils.rand(0.2, 0.5), Utils.rand(1, 3), color, 0.2);
        }
    }

    bloodSplatter(x, y) {
        for (let i = 0; i < 10; i++) {
            const a = Utils.rand(0, Math.PI * 2);
            const s = Utils.rand(1, 4);
            this.addParticle(x, y, Math.cos(a) * s, Math.sin(a) * s - 1,
                Utils.rand(0.3, 0.8), Utils.rand(2, 5),
                Utils.randChoice(['#ff0000', '#cc0000', '#880000']), 0.3);
        }
    }

    explosion(x, y, radius = 60) {
        for (let i = 0; i < 30; i++) {
            const a = Utils.rand(0, Math.PI * 2);
            const s = Utils.rand(2, 8);
            this.addParticle(x, y, Math.cos(a) * s, Math.sin(a) * s,
                Utils.rand(0.3, 1.0), Utils.rand(3, 8),
                Utils.randChoice(['#ff4400', '#ff8800', '#ffcc00', '#ff0000']), 0.15);
        }
        for (let i = 0; i < 20; i++) {
            const a = (Math.PI * 2 / 20) * i;
            const s = radius / 15;
            this.addParticle(x, y, Math.cos(a) * s, Math.sin(a) * s,
                0.4, 4, '#ffffff', 0);
        }
    }

    laserTrail(x, y) {
        this.addParticle(x, y, Utils.rand(-0.5, 0.5), Utils.rand(-0.5, 0.5),
            0.3, Utils.rand(1, 3), Utils.randChoice(['#00ffcc', '#00ff88', '#88ffff']), 0);
    }

    slimeTrail(x, y) {
        this.addParticle(x, y, Utils.rand(-1, 1), Utils.rand(-1, 0),
            0.5, Utils.rand(3, 6), Utils.randChoice(['#00ff00', '#44ff00', '#88ff44']), 0.3);
    }

    deathEffect(x, y, color) {
        for (let i = 0; i < 20; i++) {
            const a = Utils.rand(0, Math.PI * 2);
            const s = Utils.rand(2, 6);
            this.addParticle(x, y, Math.cos(a) * s, Math.sin(a) * s - 2,
                Utils.rand(0.5, 1.5), Utils.rand(3, 7), color, 0.2);
        }
    }

    damageNumber(x, y, damage, isHeadshot) {
        const color = isHeadshot ? '#ff0000' : '#ffcc00';
        const text = isHeadshot ? `💀 ${damage}` : `${damage}`;
        this.addText(x + Utils.rand(-10, 10), y - 20, text, color, isHeadshot ? 20 : 14);
    }

    update(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += p.gravity;
            p.life -= dt;
            p.alpha = Math.max(0, p.life / p.maxLife);
            if (p.life <= 0) this.particles.splice(i, 1);
        }
        for (let i = this.texts.length - 1; i >= 0; i--) {
            const t = this.texts[i];
            t.y += t.vy;
            t.life -= dt;
            if (t.life <= 0) this.texts.splice(i, 1);
        }
    }

    render(ctx, camX, camY) {
        for (const p of this.particles) {
            ctx.globalAlpha = p.alpha;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x - camX, p.y - camY, Math.max(0.5, p.size * p.alpha), 0, Math.PI * 2);
            ctx.fill();
        }

        for (const t of this.texts) {
            const alpha = Math.max(0, t.life / t.maxLife);
            ctx.globalAlpha = alpha;
            ctx.fillStyle = t.color;
            ctx.font = `bold ${t.size}px Rajdhani, sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText(t.text, t.x - camX, t.y - camY);
        }
        ctx.globalAlpha = 1;
    }
}
