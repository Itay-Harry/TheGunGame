class Player {
    constructor(id, name, isHuman = false, team = null, skinData = null) {
        this.id = id;
        this.name = name;
        this.isHuman = isHuman;
        this.team = team;
        this.skin = skinData || PLAYER_SKINS[0];

        this.x = 0; this.y = 0;
        this.vx = 0; this.vy = 0;
        this.width = 24; this.height = 40;
        this.onGround = false;
        this.crouching = false;
        this.sprinting = false;
        this.facingRight = true;

        this.health = 100;
        this.maxHealth = 100;
        this.alive = true;
        this.respawnTimer = 0;

        this.moveSpeed = 4;
        this.sprintSpeed = 6;
        this.jumpForce = -11;
        this.crouchHeight = 28;
        this.normalHeight = 40;

        // Double jump
        this.jumpsLeft = 2;
        this.maxJumps = 2;
        this.doubleJumpForce = -9.5;

        this.weapons = [new WeaponInstance('pistol')];
        this.currentWeaponIndex = 0;
        this.aimAngle = 0;

        // Recoil state
        this.recoilOffset = 0;      // accumulated visual recoil (radians)
        this.currentSpread = 0;     // calculated each frame

        this.abilities = {
            dash: { cooldownEnd: 0, activeEnd: 0, active: false },
            shield: { cooldownEnd: 0, activeEnd: 0, active: false },
            invisibility: { cooldownEnd: 0, activeEnd: 0, active: false }
        };

        this.slowMultiplier = 1;
        this.slowTimer = 0;

        this.kills = 0;
        this.deaths = 0;
        this.score = 0;
        this.headshots = 0;
        this.damageDealt = 0;
        this.flagCaptures = 0;
        this.hasFlag = null;

        this.killStreak = 0;
        this.lastKillTime = 0;
        this.weaponKills = {};

        this.hitFlash = 0;
        this.emoteTimer = 0;
        this.emoteIcon = '';
    }

    get currentWeapon() {
        if (this.currentWeaponIndex >= this.weapons.length) this.currentWeaponIndex = 0;
        return this.weapons[this.currentWeaponIndex];
    }

    spawn(x, y) {
        this.x = x * TILE_SIZE;
        this.y = y * TILE_SIZE - this.height;
        this.vx = 0; this.vy = 0;
        this.health = this.maxHealth;
        this.alive = true;
        this.crouching = false;
        this.height = this.normalHeight;
        this.slowMultiplier = 1;
        this.slowTimer = 0;
        this.recoilOffset = 0;
        this.currentSpread = 0;
        this.jumpsLeft = this.maxJumps;
        this.abilities.dash.active = false;
        this.abilities.shield.active = false;
        this.abilities.invisibility.active = false;
    }

    switchWeapon(index) {
        if (index >= 0 && index < this.weapons.length && index !== this.currentWeaponIndex) {
            this.currentWeaponIndex = index;
            this.recoilOffset = 0; // reset recoil on weapon switch
        }
    }

    pickupWeapon(weaponId) {
        if (!WEAPONS[weaponId]) return;
        const existing = this.weapons.findIndex(w => w.id === weaponId);
        if (existing >= 0) {
            this.weapons[existing].reserveAmmo = Math.min(
                this.weapons[existing].reserveAmmo + WEAPONS[weaponId].totalAmmo,
                WEAPONS[weaponId].totalAmmo * 2
            );
            return;
        }
        if (this.weapons.length < 5) {
            this.weapons.push(new WeaponInstance(weaponId));
            this.currentWeaponIndex = this.weapons.length - 1;
        } else {
            this.weapons[this.currentWeaponIndex] = new WeaponInstance(weaponId);
        }
        this.recoilOffset = 0;
    }

    addRecoil(amount) {
        // Reduced impact — recoil is visual feedback, not punishment
        this.recoilOffset += amount * (Math.PI / 180) * 0.5;
    }

    // Get effective spread accounting for movement, crouching, recoil
    getEffectiveSpread() {
        const w = this.currentWeapon;
        if (!w || !w.data) return 0.05;
        let spread = w.data.spread;

        // Moving penalty (gentler)
        const speed = Math.abs(this.vx);
        if (speed > 1.5) {
            spread *= Utils.lerp(1, MOVE_SPREAD_MULT, Math.min(speed / this.sprintSpeed, 1));
        }
        // Airborne penalty (lighter)
        if (!this.onGround) {
            spread *= 1.3;
        }
        // Crouch bonus
        if (this.crouching) {
            spread *= CROUCH_SPREAD_MULT;
        }
        // Recoil adds less spread
        spread += Math.abs(this.recoilOffset) * 0.15;

        return spread;
    }

    takeDamage(amount, attackerId, isHeadshot) {
        if (!this.alive) return 0;
        // ANTI-CHEAT: Clamp health before processing — catch any external manipulation
        this.health = Math.min(this.health, this.maxHealth);
        if (this.abilities.shield.active) amount = Math.floor(amount * 0.2);
        // ANTI-CHEAT: Damage can't be negative (would heal)
        amount = Math.max(0, Math.floor(amount));
        this.health -= amount;
        this.hitFlash = 1;
        if (this.health <= 0) {
            this.health = 0;
            this.alive = false;
            this.deaths++;
            this.killStreak = 0;
        }
        return amount;
    }

    getCenterX() { return this.x + this.width / 2; }
    getCenterY() { return this.y + this.height / 2; }
    getGunPos() {
        const effectiveAngle = this.aimAngle + this.recoilOffset;
        return {
            x: this.getCenterX() + Math.cos(effectiveAngle) * 16,
            y: this.getCenterY() - 4 + Math.sin(effectiveAngle) * 16
        };
    }

    update(input, platforms, now, dt) {
        if (!this.alive) return;

        // ANTI-CHEAT: Clamp critical values every frame
        this.health = Math.min(this.health, this.maxHealth);
        this.maxHealth = 100; // force max health — no external modification
        this.moveSpeed = 4;
        this.sprintSpeed = 6;

        // Abilities
        for (const [key, ab] of Object.entries(this.abilities)) {
            if (ab.active && now > ab.activeEnd) ab.active = false;
        }

        if (this.slowTimer > 0) {
            this.slowTimer -= dt;
            if (this.slowTimer <= 0) { this.slowMultiplier = 1; this.slowTimer = 0; }
        }

        if (this.killStreak > 0 && now - this.lastKillTime > KILL_STREAK_TIMEOUT) {
            this.killStreak = 0;
        }

        // Crouching
        const wantCrouch = input.crouch && this.onGround;
        if (wantCrouch && !this.crouching) {
            this.crouching = true;
            const oldH = this.height;
            this.height = this.crouchHeight;
            this.y += (oldH - this.crouchHeight);
        } else if (!wantCrouch && this.crouching) {
            this.crouching = false;
            this.y -= (this.normalHeight - this.crouchHeight);
            this.height = this.normalHeight;
        }

        this.sprinting = input.sprint && !this.crouching && this.onGround;

        const speed = (this.crouching ? this.moveSpeed * 0.5 :
                      this.sprinting ? this.sprintSpeed : this.moveSpeed) * this.slowMultiplier;

        if (input.left) { this.vx = -speed; this.facingRight = false; }
        else if (input.right) { this.vx = speed; this.facingRight = true; }
        else { this.vx *= 0.7; if (Math.abs(this.vx) < 0.1) this.vx = 0; }

        if (input.jump && this.jumpsLeft > 0 && !this._jumpHeld) {
            if (this.onGround) {
                // First jump
                this.vy = this.jumpForce;
                this.onGround = false;
            } else {
                // Double jump (slightly weaker)
                this.vy = this.doubleJumpForce;
            }
            this.jumpsLeft--;
            this._jumpHeld = true;
        }
        if (!input.jump) {
            this._jumpHeld = false;
        }

        // Gravity
        this.vy += GRAVITY;
        this.vy = Utils.clamp(this.vy, -20, 20);

        this.x += this.vx;
        this.resolveCollisionsX(platforms);
        this.y += this.vy;
        this.onGround = false;
        this.resolveCollisionsY(platforms);

        // FIX: Get actual map pixel dimensions from the map object
        const mapW = (platforms && platforms.width) ? platforms.width :
                     (platforms && platforms._mapWidth) ? platforms._mapWidth : 3000;
        const mapH = (platforms && platforms.height) ? platforms.height :
                     (platforms && platforms._mapHeight) ? platforms._mapHeight : 1500;
        this.x = Utils.clamp(this.x, 0, mapW - this.width);
        if (this.y > mapH + 50) this.takeDamage(999, null, false);

        if (input.aimAngle !== undefined) this.aimAngle = input.aimAngle;

        // Recoil recovery: smooth return to 0
        const w = this.currentWeapon;
        const recoveryRate = (w && w.data.recoilRecovery) ? w.data.recoilRecovery : RECOIL_RECOVERY;
        if (this.recoilOffset > 0) {
            this.recoilOffset = Math.max(0, this.recoilOffset - recoveryRate * dt * (Math.PI / 180));
        } else if (this.recoilOffset < 0) {
            this.recoilOffset = Math.min(0, this.recoilOffset + recoveryRate * dt * (Math.PI / 180));
        }

        // Cache current spread for HUD
        this.currentSpread = this.getEffectiveSpread();

        // Weapon reload
        this.currentWeapon.updateReload(now);
        if (this.currentWeapon.ammo === 0 && !this.currentWeapon.reloading) {
            this.currentWeapon.startReload(now);
        }

        if (this.hitFlash > 0) this.hitFlash = Math.max(0, this.hitFlash - dt * 5);
        if (this.emoteTimer > 0) this.emoteTimer -= dt;
    }

    resolveCollisionsX(platforms) {
        const allPlats = (platforms && typeof platforms.getAllPlatforms === 'function')
            ? platforms.getAllPlatforms() : platforms;
        const me = { x: this.x, y: this.y, w: this.width, h: this.height };
        for (const p of allPlats) {
            if (p.type !== 'solid') continue;
            const pr = { x: p.x * TILE_SIZE, y: p.y * TILE_SIZE, w: p.w * TILE_SIZE, h: p.h * TILE_SIZE };
            if (Utils.rectIntersect(me, pr)) {
                if (this.vx > 0) this.x = pr.x - this.width;
                else if (this.vx < 0) this.x = pr.x + pr.w;
                this.vx = 0;
                me.x = this.x;
            }
        }
    }

    resolveCollisionsY(platforms) {
        const allPlats = (platforms && typeof platforms.getAllPlatforms === 'function')
            ? platforms.getAllPlatforms() : platforms;
        const me = { x: this.x, y: this.y, w: this.width, h: this.height };
        for (const p of allPlats) {
            const pr = { x: p.x * TILE_SIZE, y: p.y * TILE_SIZE, w: p.w * TILE_SIZE, h: p.h * TILE_SIZE };
            if (p.type === 'platform') {
                if (this.vy >= 0 &&
                    me.x + me.w > pr.x + 2 && me.x < pr.x + pr.w - 2 &&
                    me.y + me.h >= pr.y && me.y + me.h <= pr.y + pr.h + this.vy + 4) {
                    this.y = pr.y - this.height;
                    this.vy = 0;
                    this.onGround = true;
                    this.jumpsLeft = this.maxJumps;
                    me.y = this.y;
                }
            } else {
                if (Utils.rectIntersect(me, pr)) {
                    if (this.vy > 0) { this.y = pr.y - this.height; this.onGround = true; }
                    else if (this.vy < 0) { this.y = pr.y + pr.h; }
                    this.vy = 0;
                    me.y = this.y;
                }
            }
        }
    }

    render(ctx, camX, camY, isLocalPlayer = false) {
        // Allow emote to render even briefly after death
        if (!this.alive) {
            if (this.emoteTimer > 0) {
                this.emoteTimer -= 1/60; // approximate since we don't have dt here
                const cx = this.x + this.width / 2 - camX;
                const cy = this.y + this.height / 2 - camY;
                if (cx > -60 && cx < ctx.canvas.width + 60 && cy > -60 && cy < ctx.canvas.height + 60) {
                    const alpha = Math.min(1, this.emoteTimer / 0.5);
                    const bob = Math.sin(this.emoteTimer * 4) * 3;
                    ctx.globalAlpha = alpha;
                    ctx.font = '28px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText(this.emoteIcon, cx, cy - 30 + bob);
                    ctx.globalAlpha = 1;
                }
            }
            return;
        }

        const sx = this.x - camX;
        const sy = this.y - camY;
        const cx = sx + this.width / 2;
        const cy = sy + this.height / 2;

        if (cx < -60 || cx > ctx.canvas.width + 60 || cy < -60 || cy > ctx.canvas.height + 60) return;

        if (this.abilities.invisibility.active && !isLocalPlayer) return;
        const alpha = this.abilities.invisibility.active ? 0.3 : 1;
        ctx.globalAlpha = alpha;

        // Enemy outline/glow for visibility
        if (!isLocalPlayer && !this.abilities.invisibility.active) {
            const glowColor = this.team === 'red' ? 'rgba(255,80,80,0.25)' :
                              this.team === 'blue' ? 'rgba(80,130,255,0.25)' :
                              'rgba(255,255,255,0.15)';
            ctx.shadowColor = this.team === 'red' ? '#ff4444' :
                              this.team === 'blue' ? '#4488ff' :
                              this.skin.color;
            ctx.shadowBlur = 8;

            // Outline rectangle
            ctx.strokeStyle = glowColor;
            ctx.lineWidth = 2;
            ctx.strokeRect(sx - 2, sy - 2, this.width + 4, this.height + 4);
        }

        // Shield
        if (this.abilities.shield.active) {
            ctx.shadowColor = '#00ccff';
            ctx.shadowBlur = 15;
            ctx.strokeStyle = 'rgba(0,200,255,0.6)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(cx, cy, 28, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = 'rgba(0,200,255,0.1)';
            ctx.fill();
        }

        ctx.shadowBlur = 0;

        const color = this.team === 'red' ? '#ff4444' : this.team === 'blue' ? '#4488ff' : this.skin.color;
        const bodyColor = this.hitFlash > 0 ? '#ffffff' : color;

        // Legs
        ctx.fillStyle = '#333';
        if (!this.crouching) {
            ctx.fillRect(sx + 4, sy + this.height - 14, 6, 14);
            ctx.fillRect(sx + this.width - 10, sy + this.height - 14, 6, 14);
        } else {
            ctx.fillRect(sx + 4, sy + this.height - 8, 8, 8);
            ctx.fillRect(sx + this.width - 12, sy + this.height - 8, 8, 8);
        }

        // Torso
        ctx.fillStyle = bodyColor;
        const bodyY = this.crouching ? sy + 4 : sy + 8;
        const bodyH = this.crouching ? 16 : 22;
        ctx.fillRect(sx + 2, bodyY, this.width - 4, bodyH);

        // Head
        ctx.fillStyle = bodyColor;
        ctx.beginPath();
        ctx.arc(cx, sy + 8, 8, 0, Math.PI * 2);
        ctx.fill();

        // Eyes
        const eyeX = cx + (this.facingRight ? 3 : -3);
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(eyeX, sy + 7, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(eyeX + (this.facingRight ? 0.5 : -0.5), sy + 7, 1, 0, Math.PI * 2);
        ctx.fill();

        // Weapon arm + gun with recoil
        const effectiveAngle = this.aimAngle + this.recoilOffset;
        const gunPos = this.getGunPos();
        const gsx = gunPos.x - camX;
        const gsy = gunPos.y - camY;
        ctx.strokeStyle = bodyColor;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(cx, cy - 4);
        ctx.lineTo(gsx, gsy);
        ctx.stroke();

        ctx.fillStyle = '#666';
        ctx.save();
        ctx.translate(gsx, gsy);
        ctx.rotate(effectiveAngle);
        ctx.fillRect(0, -3, 14, 6);
        ctx.restore();

        // Flag
        if (this.hasFlag) {
            ctx.font = '16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('🚩', cx, sy - 22);
        }

        // Kill streak fire
        if (this.killStreak >= 3) {
            ctx.fillStyle = '#ff4400';
            ctx.font = 'bold 10px Rajdhani, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`🔥${this.killStreak}`, cx, sy - (this.hasFlag ? 34 : 22));
        }

        // Name
        ctx.fillStyle = this.team === 'red' ? '#ff6666' : this.team === 'blue' ? '#6688ff' : '#ffffff';
        ctx.font = 'bold 12px Rajdhani, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(this.name, cx, sy - 8);

        // Health bar (enemies only)
        if (!isLocalPlayer) {
            const hbW = 30, hbH = 3;
            const hbX = cx - hbW / 2, hbY = sy - 14;
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(hbX, hbY, hbW, hbH);
            const hpPct = this.health / this.maxHealth;
            ctx.fillStyle = hpPct > 0.5 ? '#00ff00' : hpPct > 0.25 ? '#ffcc00' : '#ff0000';
            ctx.fillRect(hbX, hbY, hbW * hpPct, hbH);
        }

        // Emote with bounce animation
        if (this.emoteTimer > 0) {
            const bob = Math.sin(this.emoteTimer * 5) * 3;
            const scale = this.emoteTimer > 1.3 ? Utils.lerp(1, 1.3, (this.emoteTimer - 1.3) / 0.2) : 1;
            const emoteAlpha = Math.min(1, this.emoteTimer / 0.3);
            ctx.globalAlpha = alpha * emoteAlpha;
            ctx.font = `${Math.round(28 * scale)}px Arial`;
            ctx.textAlign = 'center';
            ctx.fillText(this.emoteIcon, cx, sy - 35 + bob);
        }

        ctx.globalAlpha = 1;
    }
}
