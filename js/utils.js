const Utils = {
    clamp(val, min, max) { return Math.max(min, Math.min(max, val)); },
    lerp(a, b, t) { return a + (b - a) * t; },
    dist(x1, y1, x2, y2) { return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2); },
    angle(x1, y1, x2, y2) { return Math.atan2(y2 - y1, x2 - x1); },
    rand(min, max) { return Math.random() * (max - min) + min; },
    randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; },
    randChoice(arr) { return arr[Math.floor(Math.random() * arr.length)]; },

    rectIntersect(a, b) {
        return a.x < b.x + b.w && a.x + a.w > b.x &&
               a.y < b.y + b.h && a.y + a.h > b.y;
    },

    pointInRect(px, py, r) {
        return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
    },

    lineRectIntersect(x1, y1, x2, y2, rx, ry, rw, rh) {
        const checks = [
            Utils.lineLineIntersect(x1, y1, x2, y2, rx, ry, rx, ry + rh),
            Utils.lineLineIntersect(x1, y1, x2, y2, rx + rw, ry, rx + rw, ry + rh),
            Utils.lineLineIntersect(x1, y1, x2, y2, rx, ry, rx + rw, ry),
            Utils.lineLineIntersect(x1, y1, x2, y2, rx, ry + rh, rx + rw, ry + rh)
        ];
        let closest = null;
        let minD = Infinity;
        for (const pt of checks) {
            if (pt) {
                const d = Utils.dist(x1, y1, pt.x, pt.y);
                if (d < minD) { minD = d; closest = pt; }
            }
        }
        return closest;
    },

    lineLineIntersect(x1, y1, x2, y2, x3, y3, x4, y4) {
        const den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
        if (Math.abs(den) < 0.0001) return null;
        const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den;
        const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / den;
        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
            return { x: x1 + t * (x2 - x1), y: y1 + t * (y2 - y1) };
        }
        return null;
    },

    // Line of sight check — returns true if no platform blocks the line between two points
    hasLineOfSight(x1, y1, x2, y2, platforms) {
        if (!platforms || platforms.length === 0) return true;
        const steps = Math.ceil(Utils.dist(x1, y1, x2, y2) / 16);
        if (steps === 0) return true;
        for (let i = 1; i < steps; i++) {
            const t = i / steps;
            const px = x1 + (x2 - x1) * t;
            const py = y1 + (y2 - y1) * t;
            for (const p of platforms) {
                const rx = (p.x || 0) * TILE_SIZE;
                const ry = (p.y || 0) * TILE_SIZE;
                const rw = (p.w || 0) * TILE_SIZE;
                const rh = (p.h || 0) * TILE_SIZE;
                if (px >= rx && px <= rx + rw && py >= ry && py <= ry + rh) {
                    return false;
                }
            }
        }
        return true;
    },

    formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    },

    shuffle(arr) {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }
};

class ScreenShake {
    constructor() {
        this.intensity = 0;
        this.decay = 0.88;
        this.offsetX = 0;
        this.offsetY = 0;
    }

    add(amount) {
        this.intensity = Math.min(this.intensity + amount, 25);
    }

    // Directional shake: kick camera opposite to aim direction
    addDirectional(amount, angle) {
        this.offsetX -= Math.cos(angle) * amount * 0.5;
        this.offsetY -= Math.sin(angle) * amount * 0.5;
        this.intensity = Math.min(this.intensity + amount * 0.5, 25);
    }

    update() {
        if (this.intensity > 0.3) {
            this.offsetX = this.offsetX * 0.6 + Utils.rand(-this.intensity, this.intensity) * 0.4;
            this.offsetY = this.offsetY * 0.6 + Utils.rand(-this.intensity, this.intensity) * 0.4;
            this.intensity *= this.decay;
        } else {
            this.intensity = 0;
            this.offsetX *= 0.5;
            this.offsetY *= 0.5;
            if (Math.abs(this.offsetX) < 0.1) this.offsetX = 0;
            if (Math.abs(this.offsetY) < 0.1) this.offsetY = 0;
        }
    }
}
