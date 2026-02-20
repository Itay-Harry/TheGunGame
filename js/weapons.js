class Bullet {
    constructor(x, y, angle, spread, weaponData, ownerId, ownerTeam) {
        this.x = x;
        this.y = y;
        const spreadAngle = Utils.rand(-spread, spread);
        this.angle = angle + spreadAngle;
        this.speed = weaponData.bulletSpeed;
        this.vx = Math.cos(this.angle) * this.speed;
        this.vy = Math.sin(this.angle) * this.speed;
        this.damage = weaponData.damage;
        this.range = weaponData.range;
        this.headshotMult = weaponData.headshotMult;
        this.ownerId = ownerId;
        this.ownerTeam = ownerTeam;
        this.travelled = 0;
        this.alive = true;
        this.isLaser = weaponData.isLaser || false;
        this.isSlime = weaponData.isSlime || false;
        this.explosive = weaponData.explosive || false;
        this.explosionRadius = weaponData.explosionRadius || 0;
        this.slowEffect = weaponData.slowEffect || 0;
        this.weaponType = weaponData.type;
        this.trail = [];
        this.radius = this.explosive ? 4 : (this.isSlime ? 5 : 2);
    }

    update() {
        if (!this.alive) return;
        this.trail.push({ x: this.x, y: this.y });
        if (this.trail.length > 6) this.trail.shift();
        this.x += this.vx;
        this.y += this.vy;
        if (!this.isLaser && !this.explosive) this.vy += 0.05;
        this.travelled += this.speed;
        if (this.travelled > this.range) this.alive = false;
    }

    render(ctx, camX, camY) {
        if (!this.alive) return;
        const sx = this.x - camX;
        const sy = this.y - camY;
        if (sx < -50 || sx > ctx.canvas.width + 50 || sy < -50 || sy > ctx.canvas.height + 50) return;

        if (this.trail.length > 1) {
            ctx.strokeStyle = this.isLaser ? '#00ffcc' : this.isSlime ? '#44ff00' :
                              this.explosive ? '#ff8800' : 'rgba(255,200,0,0.5)';
            ctx.lineWidth = this.isLaser ? 2 : 1;
            ctx.beginPath();
            ctx.moveTo(this.trail[0].x - camX, this.trail[0].y - camY);
            for (const t of this.trail) ctx.lineTo(t.x - camX, t.y - camY);
            ctx.lineTo(sx, sy);
            ctx.stroke();
        }

        ctx.fillStyle = this.isLaser ? '#00ffff' : this.isSlime ? '#00ff00' :
                        this.explosive ? '#ff4400' : '#ffcc00';
        ctx.beginPath();
        ctx.arc(sx, sy, this.radius, 0, Math.PI * 2);
        ctx.fill();

        if (this.isLaser) {
            ctx.fillStyle = 'rgba(0,255,200,0.3)';
            ctx.beginPath();
            ctx.arc(sx, sy, 5, 0, Math.PI * 2);
            ctx.fill();
        }
        if (this.explosive) {
            ctx.fillStyle = 'rgba(255,100,0,0.3)';
            ctx.beginPath();
            ctx.arc(sx, sy, 7, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

class WeaponInstance {
    constructor(weaponId) {
        this.id = weaponId;
        this.data = WEAPONS[weaponId];
        if (!this.data) {
            this.data = WEAPONS.pistol;
            this.id = 'pistol';
        }
        this.ammo = this.data.magSize;
        this.reserveAmmo = this.data.totalAmmo;
        this.reloading = false;
        this.reloadTimer = 0;
        this.lastFireTime = 0;
    }

    canFire(now) {
        // ANTI-CHEAT: Clamp ammo before checking
        this.ammo = Math.max(0, Math.min(this.ammo, this.data.magSize));
        return !this.reloading && this.ammo > 0 && (now - this.lastFireTime) >= this.data.fireRate;
    }

    /**
     * Fire bullets. `effectiveSpread` comes from player state (movement, crouch, recoil).
     * Returns { bullets, recoilAmount }
     */
    fire(x, y, angle, effectiveSpread, ownerId, ownerTeam, now) {
        if (!this.canFire(now)) return { bullets: [], recoilAmount: 0 };
        // ANTI-CHEAT: Enforce minimum time between shots
        if (now - this.lastFireTime < this.data.fireRate * 0.9) return { bullets: [], recoilAmount: 0 };
        this.lastFireTime = now;
        this.ammo--;
        // ANTI-CHEAT: Clamp damage to weapon spec
        const bullets = [];
        for (let i = 0; i < this.data.bulletCount; i++) {
            const b = new Bullet(x, y, angle, effectiveSpread, this.data, ownerId, ownerTeam);
            b.damage = Math.min(b.damage, this.data.damage); // can't exceed base damage
            bullets.push(b);
        }
        Sound.playGunSound(this.data.sound);
        return { bullets, recoilAmount: this.data.recoil };
    }

    startReload(now) {
        if (this.reloading || this.ammo === this.data.magSize || this.reserveAmmo <= 0) return;
        this.reloading = true;
        this.reloadTimer = now;
        Sound.playReload();
    }

    updateReload(now) {
        if (!this.reloading) return;
        if (now - this.reloadTimer >= this.data.reloadTime) {
            const needed = this.data.magSize - this.ammo;
            const toLoad = Math.min(needed, this.reserveAmmo);
            this.ammo += toLoad;
            this.reserveAmmo -= toLoad;
            this.reloading = false;
        }
    }

    getReloadProgress(now) {
        if (!this.reloading) return 1;
        return Math.min(1, (now - this.reloadTimer) / this.data.reloadTime);
    }
}
