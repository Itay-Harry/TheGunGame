class Bot {
    constructor(player, difficulty = 'hard') {
        this.player = player;
        this.difficulty = difficulty;
        this.input = {
            left: false, right: false, jump: false, crouch: false, sprint: false,
            shoot: false, reload: false, dash: false, shield: false, invis: false,
            aimAngle: 0
        };

        // Difficulty params
        const diffParams = {
            easy:  { reactionMin: 0.7, reactionMax: 1.4, aimSpeed: 1.8, aimError: 0.30, accuracy: 0.25, trackingJitter: 0.12, panicChance: 0.20, retreatHp: 40, abilityDelay: 3.5, missChance: 0.45, decisionSpeed: 1.2, sprintChance: 0.4, pauseChance: 0.02 },
            hard:  { reactionMin: 0.3, reactionMax: 0.8, aimSpeed: 3.5, aimError: 0.14, accuracy: 0.50, trackingJitter: 0.06, panicChance: 0.08, retreatHp: 30, abilityDelay: 1.5, missChance: 0.25, decisionSpeed: 0.7, sprintChance: 0.6, pauseChance: 0.012 },
            pro:   { reactionMin: 0.2, reactionMax: 0.5, aimSpeed: 6.0, aimError: 0.06, accuracy: 0.75, trackingJitter: 0.03, panicChance: 0.03, retreatHp: 20, abilityDelay: 0.7, missChance: 0.12, decisionSpeed: 0.4, sprintChance: 0.8, pauseChance: 0.008 }
        };
        this.params = diffParams[difficulty] || diffParams.hard;

        // === Human-like state ===
        // Aim
        this.currentAimAngle = 0;       // where bot is currently aiming (smooth)
        this.desiredAimAngle = 0;       // where bot wants to aim
        this.aimSettled = false;
        this.aimOvershoot = 0;          // simulates human overshooting target

        // Target
        this.target = null;
        this.targetLostTimer = 0;       // how long since we last saw target
        this.targetAcquiredTime = 0;    // when we first spotted current target
        this.engageDelay = 0;           // reaction delay before shooting new target

        // Decision-making — stagger think timers so bots don't all decide at the same frame
        this.thinkTimer = Utils.rand(0.1, 1.5);
        this.behaviorState = 'roam';    // 'roam', 'engage', 'retreat', 'panic', 'camp', 'hunt'
        this.stateTimer = 0;
        this.personality = this.generatePersonality();

        // Preferred weapon type — bots favor different weapons
        this.preferredRange = Utils.randChoice(['close', 'mid', 'far']);

        // Movement — stagger initial direction and timers
        this.moveDir = Math.random() > 0.5 ? 1 : -1;
        this.strafeTimer = Utils.rand(0.5, 3);
        this.strafeDir = Math.random() > 0.5 ? 1 : -1;
        this.jumpCooldown = Utils.rand(0, 1);
        this.pauseTimer = 0;
        this.lastX = 0;
        this.stuckTimer = 0;

        // Ability
        this.abilityCooldownDelay = 0;  // extra human delay on ability use

        // Emote
        this.emoteCooldown = 0;
        this.emoteReactionDelay = 0;    // delay before showing emote (feels human)
        this.pendingEmote = null;        // queued emote waiting for delay
        this.pendingEmoteLife = 0;

        // Damage tracking for hit reactions
        this.lastHealth = player.health;
        this.recentDamageTaken = 0;
        this.idleTime = 0;              // how long bot has had no target

        // Weapon
        this.weaponSwitchCooldown = 0;

        // Rival / preference targeting
        this.rivalId = null;
        this.revengeId = null;
        this.revengeTimer = 0;
        this.preferenceWeight = 0.4;

        // Camp state
        this._campCrouchDecided = false;
    }

    // Each bot gets a slight personality that affects their playstyle
    generatePersonality() {
        // Pick a random archetype to make bots feel distinct
        const archetypes = [
            { name: 'rusher',   aggression: Utils.rand(0.8, 1.0), caution: Utils.rand(0.05, 0.2), campiness: 0, jumpiness: Utils.rand(0.4, 0.7), emoteChance: Utils.rand(0.08, 0.2) },
            { name: 'camper',   aggression: Utils.rand(0.1, 0.3), caution: Utils.rand(0.5, 0.9), campiness: Utils.rand(0.3, 0.6), jumpiness: Utils.rand(0.05, 0.2), emoteChance: Utils.rand(0.02, 0.08) },
            { name: 'flanker',  aggression: Utils.rand(0.5, 0.8), caution: Utils.rand(0.3, 0.5), campiness: Utils.rand(0.0, 0.1), jumpiness: Utils.rand(0.3, 0.6), emoteChance: Utils.rand(0.05, 0.15) },
            { name: 'balanced', aggression: Utils.rand(0.4, 0.7), caution: Utils.rand(0.3, 0.6), campiness: Utils.rand(0.05, 0.2), jumpiness: Utils.rand(0.15, 0.4), emoteChance: Utils.rand(0.03, 0.12) },
            { name: 'chaotic',  aggression: Utils.rand(0.6, 1.0), caution: Utils.rand(0.05, 0.3), campiness: Utils.rand(0.0, 0.1), jumpiness: Utils.rand(0.5, 0.8), emoteChance: Utils.rand(0.1, 0.2) },
        ];
        return Utils.randChoice(archetypes);
    }

    update(allPlayers, map, gameMode, now, dt) {
        const p = this.player;
        if (!p.alive) {
            this.resetInput();
            this.target = null;
            this.behaviorState = 'roam';
            this.lastHealth = p.maxHealth;
            this.idleTime = 0;
            return;
        }

        // Timers
        this.jumpCooldown = Math.max(0, this.jumpCooldown - dt);
        this.pauseTimer = Math.max(0, this.pauseTimer - dt);
        this.emoteCooldown = Math.max(0, this.emoteCooldown - dt);
        this.weaponSwitchCooldown = Math.max(0, this.weaponSwitchCooldown - dt);
        this.abilityCooldownDelay = Math.max(0, this.abilityCooldownDelay - dt);
        this.stateTimer = Math.max(0, this.stateTimer - dt);

        // Decay revenge focus over time (BUG FIX #4: was never decremented)
        this.revengeTimer = Math.max(0, this.revengeTimer - dt);

        // Assign rival once per match (BUG FIX #5: was never assigned)
        if (!this.rivalId) {
            const candidates = allPlayers.filter(o => o !== p && o.alive);
            if (candidates.length > 0) {
                this.rivalId = Utils.randChoice(candidates).id;
            }
        }

        // Pending emote delay
        if (this.pendingEmote && this.emoteReactionDelay > 0) {
            this.emoteReactionDelay -= dt;
            if (this.emoteReactionDelay <= 0) {
                this.showEmote(this.pendingEmote, this.pendingEmoteLife);
                this.pendingEmote = null;
            }
        }

        // Detect damage taken for hit reaction
        if (p.health < this.lastHealth) {
            const dmg = this.lastHealth - p.health;
            this.recentDamageTaken += dmg;
            this.onHit(dmg);
        }
        this.lastHealth = p.health;
        this.recentDamageTaken = Math.max(0, this.recentDamageTaken - dt * 30);

        // Idle emote tracking
        if (!this.target) {
            this.idleTime += dt;
            this.tryIdleEmote(dt);
        } else {
            this.idleTime = 0;
        }

        this.resetInput();

        // Stuck detection
        if (Math.abs(p.x - this.lastX) < 0.5 && (this.behaviorState === 'roam' || this.behaviorState === 'hunt')) {
            this.stuckTimer += dt;
        } else {
            this.stuckTimer = 0;
        }
        this.lastX = p.x;

        // Find/update target
        this.updateTarget(allPlayers, map, dt, now);

        // Decide behavior
        this.thinkTimer -= dt;
        if (this.thinkTimer <= 0) {
            this.decideBehavior(map, gameMode);
            this.thinkTimer = this.params.decisionSpeed * Utils.rand(0.7, 1.3);
        }

        // Execute behavior
        switch (this.behaviorState) {
            case 'roam': this.executeRoam(map, dt); break;
            case 'engage': this.executeEngage(map, dt, now); break;
            case 'retreat': this.executeRetreat(map, dt); break;
            case 'panic': this.executePanic(map, dt, now); break;
            case 'camp': this.executeCamp(map, dt, now); break;
            case 'hunt': this.executeHunt(map, gameMode, dt); break;
        }

        // Smooth aim (always runs — this is what makes aiming feel human)
        this.updateAim(dt);

        // Set aim input
        this.input.aimAngle = this.currentAimAngle;

        if (this.target && this.weaponSwitchCooldown <= 0) {
            const dist = Utils.dist(p.getCenterX(), p.getCenterY(), this.target.getCenterX(), this.target.getCenterY());
            this.pickBestWeapon(dist);
            this.weaponSwitchCooldown = Utils.rand(1, 3);
        }

        this.updateAbilities(now, dt);

        // BUG FIX #9: safely check map.flags
        if (gameMode && gameMode.type === 'ctf' && map && map.flags) {
            this.ctfOverride(map, gameMode);
        }

        if (p.currentWeapon && p.currentWeapon.ammo < p.currentWeapon.data.magSize * 0.2 && !p.currentWeapon.reloading && this.behaviorState !== 'engage') {
            this.input.reload = true;
        }

        // BUG FIX #24: Don't shoot while reloading
        if (p.currentWeapon && p.currentWeapon.reloading) {
            this.input.shoot = false;
        }

        if (this.stuckTimer > 0.8) {
            this.input.jump = true;
            this.stuckTimer = 0;
            if (Math.random() < 0.5) this.moveDir *= -1;
        }
    }

    // ========= EMOTE SYSTEM =========

    showEmote(icon, life = 1.5) {
        if (this.emoteCooldown > 0 || !this.player.alive) return;
        this.player.emoteIcon = icon;
        this.player.emoteTimer = life;
        this.emoteCooldown = Utils.rand(3, 8); // humans don't spam emotes
    }

    queueEmote(icon, delay = 0, life = 1.5) {
        // Don't queue if already showing or pending
        if (this.emoteCooldown > 0 || this.pendingEmote) return;
        if (delay <= 0) {
            this.showEmote(icon, life);
        } else {
            this.pendingEmote = icon;
            this.pendingEmoteLife = life;
            this.emoteReactionDelay = delay;
        }
    }

    // --- After getting a kill ---
    onKill() {
        // BUG FIX: clear revenge on the killed target, not all revenge
        this.revengeId = null;
        this.revengeTimer = 0;
        const chance = this.personality.emoteChance * 4;
        if (Math.random() > chance) return;

        const emotes = ['😎', '💪', '😂', '🎉', '💀', '🔥', '✌️', '👑'];
        const delay = Utils.rand(0.3, 1.0);
        this.queueEmote(Utils.randChoice(emotes), delay, 1.8);
    }

    // --- When taking damage ---
    onHit(damage) {
        // Only react to significant hits, not chip damage
        if (damage < 15) return;

        const hpPercent = this.player.health / this.player.maxHealth;
        let chance = 0.12;
        if (damage > 40) chance = 0.35;        // big hit = more likely to react
        if (hpPercent < 0.3) chance = 0.45;     // low HP = panicked reaction

        if (Math.random() > chance) return;

        let emotes;
        if (hpPercent < 0.2) {
            emotes = ['😱', '💀', '🫣', '😰'];   // critical HP panic
        } else if (damage > 40) {
            emotes = ['😮', '😤', '🤕', '😵'];    // big damage surprise
        } else {
            emotes = ['😮', '😠', '🤨', '😬'];    // moderate hit
        }

        this.queueEmote(Utils.randChoice(emotes), Utils.rand(0.1, 0.4), 1.0);
    }

    // --- When dying --- (BUG FIX #6, #22, #23: handle missing killer arg, set revenge)
    onDeath(killer) {
        // Set revenge target if we know who killed us
        if (killer && killer.id) {
            this.revengeId = killer.id;
            this.revengeTimer = 8;
        }

        if (this.emoteCooldown > 0) return;
        const chance = this.personality.emoteChance * 5;
        if (Math.random() > Math.max(chance, 0.3)) return;

        const emotes = ['😭', '🤦', '😅', '💀', '😵', '🫠', '👻', '😤'];
        this.player.emoteIcon = Utils.randChoice(emotes);
        this.player.emoteTimer = 2.0;
    }

    // --- Random idle emotes ---
    tryIdleEmote(dt) {
        // Only after being idle for a while
        if (this.idleTime < 3) return;
        // Very low chance per frame
        if (Math.random() > 0.003) return;

        const emotes = ['🤔', '💃', '💤', '👀', '🎵', '🥱', '😐', '🫧'];
        this.queueEmote(Utils.randChoice(emotes), Utils.rand(0, 0.3), Utils.rand(1.5, 2.5));
        this.idleTime = 0; // reset so we don't spam
    }

    // --- When picking up a weapon ---
    onPickup(weaponName) {
        if (Math.random() > 0.4) return;
        const emotes = ['🔫', '😏', '🤩', '💪', '🏆'];
        this.queueEmote(Utils.randChoice(emotes), Utils.rand(0.1, 0.5), 1.2);
    }

    // --- When a teammate gets a kill (TDM/CTF) ---
    onTeammateKill(teammate) {
        if (!this.player.team || this.player.team !== teammate.team) return;
        if (Math.random() > 0.2) return;

        const emotes = ['🙌', '👏', '🔥', '💪', '👀'];
        this.queueEmote(Utils.randChoice(emotes), Utils.rand(0.5, 1.5), 1.2);
    }

    // --- When a nearby enemy is spotted (suspense) ---
    onSpotEnemy(dist) {
        if (dist > 300 || Math.random() > 0.08) return;
        const emotes = ['👀', '😈', '🎯'];
        this.queueEmote(Utils.randChoice(emotes), Utils.rand(0.2, 0.6), 1.0);
    }

    // ========= TARGET MANAGEMENT =========

    updateTarget(allPlayers, map, dt, now) {
        const p = this.player;

        // Check if current target is still valid
        if (this.target) {
            if (!this.target.alive || (this.target.abilities && this.target.abilities.invisibility && this.target.abilities.invisibility.active)) {
                this.target = null;
                this.targetLostTimer = 0;
            }
        }

        // Scan for new target
        let closest = null;
        let closestScore = -Infinity;

        // BUG FIX #21: Find top scorer excluding teammates
        let topPlayer = null;
        let topScore = -Infinity;
        for (const other of allPlayers) {
            if (!other.alive || other === p) continue;
            if (p.team && other.team === p.team) continue;
            if (other.score > topScore) {
                topScore = other.score;
                topPlayer = other;
            }
        }

        // BUG FIX #2: Get platforms safely
        const platforms = (map && typeof map.getAllPlatforms === 'function') ? map.getAllPlatforms() : (map.platforms || []);

        for (const other of allPlayers) {
            if (other === p || !other.alive) continue;
            if (p.team && other.team === p.team) continue;
            if (other.abilities && other.abilities.invisibility && other.abilities.invisibility.active) continue;

            const d = Utils.dist(p.getCenterX(), p.getCenterY(), other.getCenterX(), other.getCenterY());

            // Base score (normal targeting)
            let score = 1000 - d;
            if (other.health < 30) score += 300;
            if (d > 800) score -= 200;

            // BUG FIX #1: Safe LOS check with fallback
            let hasLOS = true;
            if (typeof Utils.hasLineOfSight === 'function') {
                hasLOS = Utils.hasLineOfSight(p.getCenterX(), p.getCenterY(), other.getCenterX(), other.getCenterY(), platforms);
            }
            if (!hasLOS) score -= 500;

            // Preference boost (40% weight)
            let pref = 0;
            if (this.revengeTimer > 0 && other.id === this.revengeId) pref += 400;
            if (this.rivalId && other.id === this.rivalId) pref += 250;
            if (topPlayer && other.id === topPlayer.id) pref += 200;
            if (other.health < 30) pref += 150;

            const finalScore = score * (1 - this.preferenceWeight) + (score + pref) * this.preferenceWeight;

            if (finalScore > closestScore) {
                closestScore = finalScore;
                closest = other;
            }
        }

        if (closest && closest !== this.target) {
            if (!this.target || closestScore > 200) {
                const isNewTarget = !this.target;
                this.target = closest;
                this.engageDelay = Utils.rand(this.params.reactionMin, this.params.reactionMax);
                // BUG FIX #17: use passed now instead of performance.now()
                this.targetAcquiredTime = now || performance.now();
                this.aimOvershoot = Utils.rand(-this.params.aimError * 2, this.params.aimError * 2);
                if (isNewTarget) this.onSpotEnemy(Utils.dist(p.getCenterX(), p.getCenterY(), closest.getCenterX(), closest.getCenterY()));
            }
        }

        if (!this.target) {
            this.targetLostTimer += dt;
        } else {
            this.targetLostTimer = 0;
        }

        // BUG FIX #25: clamp engageDelay to 0 minimum
        if (this.engageDelay > 0) {
            this.engageDelay = Math.max(0, this.engageDelay - dt);
        }
    }

    // ========= BEHAVIOR DECISIONS =========

    decideBehavior(map, gameMode) {
        const p = this.player;
        const hpPercent = p.health / p.maxHealth;

        // Force states
        if (hpPercent < 0.15 && Math.random() < 0.7) {
            this.setBehavior('panic');
            return;
        }
        if (hpPercent < (this.params.retreatHp / 100) && this.personality.caution > 0.4 && Math.random() < this.personality.caution) {
            this.setBehavior('retreat');
            return;
        }

        if (this.target) {
            const dist = Utils.dist(p.getCenterX(), p.getCenterY(), this.target.getCenterX(), this.target.getCenterY());

            // Sometimes camp if personality allows and at mid range
            if (this.personality.campiness > 0.2 && dist > 200 && dist < 500 && p.onGround && Math.random() < this.personality.campiness * 0.3) {
                this.setBehavior('camp');
                return;
            }

            this.setBehavior('engage');
            return;
        }

        // No target
        if (this.targetLostTimer > 2 && Math.random() < this.personality.aggression * 0.4) {
            this.setBehavior('hunt');
        } else {
            this.setBehavior('roam');
        }
    }

    setBehavior(state) {
        if (this.behaviorState !== state) {
            this.behaviorState = state;
            this.stateTimer = Utils.rand(1, 4);
        }
    }

    // ========= BEHAVIOR EXECUTION =========

    executeRoam(map, dt) {
        const p = this.player;

        // Occasional pause to "look around"
        if (this.pauseTimer > 0) return;
        if (Math.random() < (this.params.pauseChance || 0.005)) {
            this.pauseTimer = Utils.rand(0.3, 1.0);
            return;
        }

        this.strafeTimer -= dt;
        if (this.strafeTimer <= 0) {
            this.moveDir = Math.random() > 0.5 ? 1 : -1;
            this.strafeTimer = Utils.rand(1.5, 4);
        }

        this.input.right = this.moveDir > 0;
        this.input.left = this.moveDir < 0;

        // Occasional jump
        if (this.jumpCooldown <= 0 && Math.random() < this.personality.jumpiness * 0.03) {
            this.input.jump = true;
            this.jumpCooldown = Utils.rand(0.5, 2);
        }

        // Turn at walls
        if (p.x < TILE_SIZE * 2) { this.moveDir = 1; }
        if (p.x > map.width - TILE_SIZE * 2) { this.moveDir = -1; }

        // Aim forward
        this.desiredAimAngle = this.moveDir > 0 ? 0 : Math.PI;
    }

    executeEngage(map, dt, now) {
        const p = this.player;
        if (!this.target || !this.target.alive) { this.behaviorState = 'roam'; return; }

        const tx = this.target.getCenterX();
        const ty = this.target.getCenterY();
        const px = p.getCenterX();
        const py = p.getCenterY();
        const dx = tx - px;
        const dy = ty - py;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const angleToTarget = Math.atan2(dy, dx);

        // Lead target (pro bots lead more)
        let leadAngle = angleToTarget;
        // BUG FIX #11: safely access target velocity
        const targetVx = this.target.vx || 0;
        const targetVy = this.target.vy || 0;
        if (this.difficulty !== 'easy' && dist > 150 && p.currentWeapon && p.currentWeapon.data) {
            const bulletSpeed = p.currentWeapon.data.bulletSpeed || 20;
            const travelTime = dist / bulletSpeed;
            const leadX = tx + targetVx * travelTime * (this.difficulty === 'pro' ? 0.8 : 0.4);
            const leadY = ty + targetVy * travelTime * (this.difficulty === 'pro' ? 0.6 : 0.3);
            leadAngle = Math.atan2(leadY - py, leadX - px);
        }

        // Desired aim with overshoot and jitter
        const jitter = Utils.rand(-this.params.trackingJitter, this.params.trackingJitter);
        this.desiredAimAngle = leadAngle + this.aimOvershoot + jitter;

        // Overshoot decays over time (human corrects aim)
        this.aimOvershoot *= 0.92;

        // Movement while engaging
        const weaponRange = (p.currentWeapon && p.currentWeapon.data) ? p.currentWeapon.data.range * 0.65 : 300;

        if (dist > weaponRange) {
            // Push toward target
            this.input.right = dx > 0;
            this.input.left = dx < 0;
            if (dist > weaponRange * 1.5 && Math.random() < (this.params.sprintChance || 0.6)) {
                this.input.sprint = true;
            }
        } else if (dist < 80 && p.currentWeapon.data.type !== 'shotgun') {
            // Too close for non-shotgun — back up
            this.input.right = dx < 0;
            this.input.left = dx > 0;
        } else {
            // Strafe (humans strafe in combat)
            this.strafeTimer -= dt;
            if (this.strafeTimer <= 0) {
                this.strafeDir = Math.random() > 0.5 ? 1 : -1;
                this.strafeTimer = Utils.rand(0.3, 1.2);
            }
            this.input.right = this.strafeDir > 0;
            this.input.left = this.strafeDir < 0;
        }

        // Combat jumping — humans jump unpredictably
        if (this.jumpCooldown <= 0 && p.onGround) {
            const jumpChance = this.personality.jumpiness * (dist < 200 ? 0.08 : 0.03);
            if (Math.random() < jumpChance) {
                this.input.jump = true;
                this.jumpCooldown = Utils.rand(0.4, 1.5);
            }
        }

        // Shooting — only after reaction delay, and with accuracy/miss chance
        // BUG FIX #1/#2: safe LOS check
        const platforms = (map && typeof map.getAllPlatforms === 'function') ? map.getAllPlatforms() : (map.platforms || []);
        let hasLOS = true;
        if (typeof Utils.hasLineOfSight === 'function') {
            hasLOS = Utils.hasLineOfSight(px, py, tx, ty, platforms);
        }
        // BUG FIX #24: also check not reloading before shooting
        if (hasLOS && this.engageDelay <= 0 && this.aimSettled && !(p.currentWeapon && p.currentWeapon.reloading)) {
            if (Math.random() > this.params.missChance) {
                this.input.shoot = true;
            }
        }

        // Reload during combat if magazine low and target is far
        if (p.currentWeapon.ammo <= 2 && !p.currentWeapon.reloading && dist > 200) {
            this.input.reload = true;
            this.input.shoot = false;
        }

        // Crouch for accuracy at long range (humans sometimes crouch-shoot)
        if (dist > 350 && p.onGround && !this.input.left && !this.input.right && Math.random() < 0.1) {
            this.input.crouch = true;
        }
    }

    executeRetreat(map, dt) {
        const p = this.player;
        this.input.sprint = true;

        if (this.target && this.target.alive) {
            const dx = this.target.getCenterX() - p.getCenterX();
            // Run away from target
            this.input.right = dx < 0;
            this.input.left = dx > 0;
            // Aim backwards occasionally (humans look back while running)
            if (Math.random() < 0.15) {
                this.desiredAimAngle = Math.atan2(
                    this.target.getCenterY() - p.getCenterY(),
                    this.target.getCenterX() - p.getCenterX()
                );
            } else {
                this.desiredAimAngle = this.input.right ? 0 : Math.PI;
            }
        } else {
            this.moveDir = p.x < (map.width / 2) ? -1 : 1;
            this.input.right = this.moveDir > 0;
            this.input.left = this.moveDir < 0;
            this.desiredAimAngle = this.moveDir > 0 ? 0 : Math.PI;
        }

        // Jump while retreating for evasion
        if (this.jumpCooldown <= 0 && Math.random() < 0.06) {
            this.input.jump = true;
            this.jumpCooldown = Utils.rand(0.4, 1.0);
        }

        // Exit retreat if health recovered or timer expired
        if (p.health > 50 || this.stateTimer <= 0) {
            this.behaviorState = 'roam';
        }
    }

    executePanic(map, dt, now) {
        const p = this.player;

        // Erratic movement — humans panic when very low HP
        this.strafeTimer -= dt;
        if (this.strafeTimer <= 0) {
            this.strafeDir = Math.random() > 0.5 ? 1 : -1;
            this.strafeTimer = Utils.rand(0.15, 0.5); // fast direction changes
        }
        this.input.right = this.strafeDir > 0;
        this.input.left = this.strafeDir < 0;
        this.input.sprint = true;

        // Panic jump spam
        if (this.jumpCooldown <= 0 && Math.random() < 0.15) {
            this.input.jump = true;
            this.jumpCooldown = 0.2;
        }

        // Wild shooting if target exists
        if (this.target && this.target.alive) {
            const angle = Math.atan2(
                this.target.getCenterY() - p.getCenterY(),
                this.target.getCenterX() - p.getCenterX()
            );
            // Aim wildly — panic aim is very inaccurate
            this.desiredAimAngle = angle + Utils.rand(-0.4, 0.4);
            if (Math.random() < 0.5) this.input.shoot = true;
        }

        // Use shield in panic if available
        if (!p.abilities.shield.active && now > p.abilities.shield.cooldownEnd) {
            this.input.shield = true;
        }

        if (this.stateTimer <= 0 || p.health > 40) {
            this.behaviorState = this.target ? 'engage' : 'roam';
        }
    }

    executeCamp(map, dt, now) {
        const p = this.player;

        // BUG FIX #10/#19: properly initialize _campCrouchDecided
        if (this._campCrouchDecided === false || this._campCrouchDecided === undefined) {
            this._campCrouchDecided = p.onGround && Math.random() < 0.7 ? true : null;
        }
        this.input.crouch = (this._campCrouchDecided === true) && p.onGround;

        if (this.target && this.target.alive) {
            const tx = this.target.getCenterX();
            const ty = this.target.getCenterY();
            const dist = Utils.dist(p.getCenterX(), p.getCenterY(), tx, ty);
            this.desiredAimAngle = Math.atan2(ty - p.getCenterY(), tx - p.getCenterX());

            // BUG FIX #1/#2: safe LOS
            const platforms = (map && typeof map.getAllPlatforms === 'function') ? map.getAllPlatforms() : (map.platforms || []);
            let hasLOS = true;
            if (typeof Utils.hasLineOfSight === 'function') {
                hasLOS = Utils.hasLineOfSight(p.getCenterX(), p.getCenterY(), tx, ty, platforms);
            }
            // BUG FIX #24: check not reloading
            if (hasLOS && this.engageDelay <= 0 && this.aimSettled && !(p.currentWeapon && p.currentWeapon.reloading)) {
                this.input.shoot = true;
            }

            if (dist < 150) {
                this._campCrouchDecided = false;
                this.behaviorState = 'engage';
            }
        }

        if (this.stateTimer <= 0) {
            this._campCrouchDecided = false;
            this.behaviorState = 'roam';
        }
    }

    executeHunt(map, gameMode, dt) {
        const p = this.player;
        this.input.sprint = Math.random() < (this.params.sprintChance || 0.6);

        this.strafeTimer -= dt;
        if (this.strafeTimer <= 0) {
            // BUG FIX #16/#20: safely access spawns
            const spawns = (map && map.spawns) ? map.spawns : ((map && map.data && map.data.spawns) ? map.data.spawns : []);
            if (spawns.length > 0) {
                const spawn = Utils.randChoice(spawns);
                this.moveDir = (spawn.x * TILE_SIZE) > p.getCenterX() ? 1 : -1;
            } else {
                this.moveDir = Math.random() > 0.5 ? 1 : -1;
            }
            this.strafeTimer = Utils.rand(1, 3);
        }

        this.input.right = this.moveDir > 0;
        this.input.left = this.moveDir < 0;

        if (this.jumpCooldown <= 0 && Math.random() < 0.04) {
            this.input.jump = true;
            this.jumpCooldown = Utils.rand(0.5, 1.5);
        }

        this.desiredAimAngle = this.moveDir > 0 ? 0 : Math.PI;

        // Turn at edges
        const mapWidth = (map && map.width) ? map.width : ((map && map.data) ? map.data.width * TILE_SIZE : 2000);
        if (p.x < TILE_SIZE * 2) this.moveDir = 1;
        if (p.x > mapWidth - TILE_SIZE * 2) this.moveDir = -1;

        if (this.target || this.stateTimer <= 0) {
            this.behaviorState = this.target ? 'engage' : 'roam';
        }
    }

    // ========= SMOOTH AIM =========

    updateAim(dt) {
        // Smoothly rotate current aim toward desired aim — this is key for human feel
        let diff = this.desiredAimAngle - this.currentAimAngle;

        // Normalize angle difference to [-PI, PI]
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;

        const aimSpeed = this.params.aimSpeed;
        const maxRotation = aimSpeed * dt;

        if (Math.abs(diff) < maxRotation) {
            this.currentAimAngle = this.desiredAimAngle;
            this.aimSettled = true;
        } else {
            this.currentAimAngle += Math.sign(diff) * maxRotation;
            this.aimSettled = Math.abs(diff) < 0.15; // "close enough" to fire
        }

        // Normalize current aim
        while (this.currentAimAngle > Math.PI) this.currentAimAngle -= Math.PI * 2;
        while (this.currentAimAngle < -Math.PI) this.currentAimAngle += Math.PI * 2;

        // Add subtle micro-jitter (humans can't hold perfectly still)
        if (this.target) {
            this.currentAimAngle += Utils.rand(-0.005, 0.005);
        }
    }

    // ========= ABILITIES =========

    updateAbilities(now, dt) {
        const p = this.player;
        if (this.abilityCooldownDelay > 0) return;
        // BUG FIX #12/#13/#14: safely check abilities exist
        if (!p.abilities) return;

        const shouldUseAbility = Math.random() < 0.02;
        if (!shouldUseAbility) return;

        const hpPercent = p.health / p.maxHealth;
        const inCombat = this.behaviorState === 'engage' || this.behaviorState === 'panic';

        // Shield
        if (p.abilities.shield && hpPercent < 0.4 && inCombat && !p.abilities.shield.active && now > (p.abilities.shield.cooldownEnd || 0)) {
            if (hpPercent < 0.5 || Math.random() < 0.3) {
                this.input.shield = true;
                this.abilityCooldownDelay = this.params.abilityDelay;
                return;
            }
        }

        // Dash
        if (p.abilities.dash && !p.abilities.dash.active && now > (p.abilities.dash.cooldownEnd || 0)) {
            if (this.behaviorState === 'retreat' && Math.random() < 0.3) {
                this.input.dash = true;
                this.abilityCooldownDelay = this.params.abilityDelay;
                return;
            }
            if (this.target && Utils.dist(p.getCenterX(), p.getCenterY(), this.target.getCenterX(), this.target.getCenterY()) < 100) {
                if (Math.random() < 0.2) {
                    this.input.dash = true;
                    this.abilityCooldownDelay = this.params.abilityDelay;
                    return;
                }
            }
        }

        // Invis
        if (p.abilities.invisibility && !p.abilities.invisibility.active && now > (p.abilities.invisibility.cooldownEnd || 0)) {
            if ((this.behaviorState === 'retreat' || this.behaviorState === 'hunt') && Math.random() < 0.15) {
                this.input.invis = true;
                this.abilityCooldownDelay = this.params.abilityDelay;
            }
        }
    }

    // ========= CTF OVERRIDE =========

    ctfOverride(map, gameMode) {
        const p = this.player;
        // BUG FIX #8/#9: safely check hasFlag and flags
        if (!map || !map.flags) return;

        if (p.hasFlag) {
            const base = (p.team === 'red' && map.flags.red) ? map.flags.red : map.flags.blue;
            if (!base) return;
            const dx = base.x * TILE_SIZE - p.getCenterX();
            this.input.left = dx < 0;
            this.input.right = dx > 0;
            this.input.sprint = true;
            if (this.target && this.target.alive) {
                this.desiredAimAngle = Math.atan2(
                    this.target.getCenterY() - p.getCenterY(),
                    this.target.getCenterX() - p.getCenterX()
                );
            }
            return;
        }

        if (!this.target && Math.random() < 0.5 * this.personality.aggression) {
            const enemyFlag = (p.team === 'red' && map.flags.blue) ? map.flags.blue : map.flags.red;
            if (!enemyFlag) return;
            const dx = enemyFlag.x * TILE_SIZE - p.getCenterX();
            this.input.right = dx > 0;
            this.input.left = dx < 0;
            this.input.sprint = true;
        }
    }

    // ========= WEAPON SELECTION =========

    pickBestWeapon(dist) {
        const p = this.player;
        if (!p.weapons || p.weapons.length === 0) return;
        let bestIdx = 0;
        let bestScore = -1;

        for (let i = 0; i < p.weapons.length; i++) {
            const w = p.weapons[i];
            if (!w || !w.data) continue;
            if (w.ammo === 0 && w.reserveAmmo === 0) continue;

            let score = 0;
            const t = w.data.type;
            if (dist < 120) {
                score = t === 'shotgun' ? 10 : t === 'smg' ? 8 : t === 'pistol' ? 5 : 3;
            } else if (dist < 350) {
                score = t === 'assault' ? 10 : t === 'smg' ? 7 : t === 'laser' ? 8 : t === 'slime' ? 6 : 4;
            } else {
                score = t === 'sniper' ? 10 : t === 'assault' ? 6 : t === 'laser' ? 7 : t === 'rocket' ? 5 : 3;
            }

            if (this.preferredRange === 'close' && (t === 'shotgun' || t === 'smg')) score += 3;
            if (this.preferredRange === 'mid' && (t === 'assault' || t === 'laser' || t === 'slime')) score += 3;
            if (this.preferredRange === 'far' && (t === 'sniper' || t === 'rocket')) score += 3;

            if (score > bestScore) { bestScore = score; bestIdx = i; }
        }

        // BUG FIX #7: use switchWeapon which should handle index
        if (bestIdx !== (p.currentWeaponIndex || 0)) {
            if (typeof p.switchWeapon === 'function') {
                p.switchWeapon(bestIdx);
            }
        }
    }

    // ========= RESET =========

    resetInput() {
        this.input.left = false; this.input.right = false;
        this.input.jump = false; this.input.crouch = false;
        this.input.sprint = false; this.input.shoot = false;
        this.input.reload = false; this.input.dash = false;
        this.input.shield = false; this.input.invis = false;
    }
}
