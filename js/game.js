class Game {
	constructor(canvas, ui, progression) {
		this.canvas = canvas;
		this.ctx = canvas.getContext('2d');
		this.ui = ui;
		this.progression = progression;
		this.particles = new ParticleSystem();
		this.shake = new ScreenShake();

		this.players = [];
		this.bullets = [];
		this.bots = [];
		this.localPlayer = null;
		this.map = null;
		this.gameMode = null;
		this.weaponPickups = [];

		this.player2 = null;
		this.is2Player = false;
		this.camera = { x: 0, y: 0 };
		this.camera2 = { x: 0, y: 0 };
		this.p2AimAngle = 0;
		this.p1AimAngle = 0;

		this.paused = false;
		this.running = false;
		this.spectating = false;
		this.spectateIndex = 0;

		this.keys = {};
		this.mouse = { x: 0, y: 0, down: false };
		this._prevMouseDown = false;
		this._firedThisClick = false;
		this._prevP2Shoot = false;

		this.setupInput();
		this.resizeCanvas();
		window.addEventListener('resize', () => this.resizeCanvas());
		window.addEventListener('orientationchange', () => {
			setTimeout(() => this.resizeCanvas(), 200);
		});
	}

	resizeCanvas() {
		this.canvas.width = window.innerWidth;
		this.canvas.height = window.innerHeight;
	}

	setupInput() {
		window.addEventListener('keydown', e => {
			const key = e.key.toLowerCase();
			this.keys[key] = true;
			this.keys[e.code] = true;

			if (!this.running) return;

			if (this.localPlayer && e.key >= '1' && e.key <= '5') {
				this.localPlayer.switchWeapon(parseInt(e.key) - 1);
			}
			if (this.player2 && e.key >= '7' && e.key <= '9') {
				this.player2.switchWeapon(parseInt(e.key) - 7);
			}
			if (key === 'r' && this.localPlayer && this.localPlayer.alive) {
				this.localPlayer.currentWeapon.startReload(performance.now());
			}
			if (key === 'p' && this.player2 && this.player2.alive) {
				this.player2.currentWeapon.startReload(performance.now());
			}
			if (e.key === 'Tab') {
				e.preventDefault();
				this.ui.showScoreboard(this.players, this.localPlayer?.id);
			}
			if (!this.localPlayer?.alive && (key === 'a' || key === 'd' || e.code === 'ArrowLeft' || e.code === 'ArrowRight')) {
				this.cycleSpectate((key === 'd' || e.code === 'ArrowRight') ? 1 : -1);
			}
			if (e.code === 'ArrowUp' || e.code === 'ArrowDown' || e.code === 'ArrowLeft' || e.code === 'ArrowRight' || e.code === 'Space') {
				e.preventDefault();
			}
		});

		window.addEventListener('keyup', e => {
			this.keys[e.key.toLowerCase()] = false;
			this.keys[e.code] = false;
			if (e.key === 'Tab') this.ui.hideScoreboard();
		});

		this.canvas.addEventListener('mousemove', e => {
			this.mouse.x = e.clientX;
			this.mouse.y = e.clientY;
		});

		this.canvas.addEventListener('mousedown', e => {
			if (e.button === 0) { this.mouse.down = true; this._firedThisClick = false; }
			Sound.ensureReady();
		});

		this.canvas.addEventListener('mouseup', e => {
			if (e.button === 0) { this.mouse.down = false; this._firedThisClick = false; }
		});

		this.canvas.addEventListener('contextmenu', e => e.preventDefault());
	}

	getLocalInput() {
		if (!this.localPlayer || !this.localPlayer.alive) return {};
		const playerScreenX = this.localPlayer.getCenterX() - this.camera.x;
		const playerScreenY = this.localPlayer.getCenterY() - this.camera.y;

		let aimAngle = this.p1AimAngle;

		const hasMouse = Math.abs(this.mouse.x - this.canvas.width / 2) > 5 ||
			Math.abs(this.mouse.y - this.canvas.height / 2) > 5;

		if (hasMouse) {
			aimAngle = Math.atan2(this.mouse.y - playerScreenY, this.mouse.x - playerScreenX);
			this.p1AimAngle = aimAngle;
			aimAngle = this.applyAimAssist(aimAngle);
		} else {
			const aimSpeed = 5.0;
			const dt = 0.016;
			if (this.keys['arrowup']) this.p1AimAngle -= aimSpeed * dt;
			if (this.keys['arrowdown']) this.p1AimAngle += aimSpeed * dt;
			if (this.keys['arrowleft']) this.p1AimAngle -= aimSpeed * dt * 0.8;
			if (this.keys['arrowright']) this.p1AimAngle += aimSpeed * dt * 0.8;
			aimAngle = this.p1AimAngle;
		}

		return {
			left: this.keys['a'] || this.keys['arrowleft'] || this.keys['ArrowLeft'],
			right: this.keys['d'] || this.keys['arrowright'] || this.keys['ArrowRight'],
			jump: this.keys['w'] || this.keys[' '] || this.keys['arrowup'] || this.keys['ArrowUp'],
			crouch: this.keys['s'] || this.keys['arrowdown'] || this.keys['ArrowDown'],
			sprint: this.keys['shift'],
			shoot: this.mouse.down,
			reload: this.keys['r'],
			dash: this.keys['q'],
			shield: this.keys['e'],
			invis: this.keys['f'],
			aimAngle: aimAngle
		};
	}

	getPlayer2Input() {
		if (!this.player2 || !this.player2.alive) return {};

		const p2 = this.player2;
		let bestDist = Infinity;
		let bestAngle = this.p2AimAngle;

		for (const other of this.players) {
			if (other === p2 || !other.alive) continue;
			if (p2.team && other.team === p2.team) continue;
			if (other.abilities && other.abilities.invisibility.active) continue;
			const d = Utils.dist(p2.getCenterX(), p2.getCenterY(), other.getCenterX(), other.getCenterY());
			if (d < bestDist) {
				bestDist = d;
				bestAngle = Math.atan2(other.getCenterY() - p2.getCenterY(), other.getCenterX() - p2.getCenterX());
			}
		}

		if (this.keys['u']) this.p2AimAngle -= 3.5 * 0.016;
		if (this.keys['y']) this.p2AimAngle += 3.5 * 0.016;

		if (bestDist < 600) {
			let diff = bestAngle - this.p2AimAngle;
			while (diff > Math.PI) diff -= Math.PI * 2;
			while (diff < -Math.PI) diff += Math.PI * 2;
			this.p2AimAngle += diff * 0.15;
		} else {
			if (this.keys['l']) this.p2AimAngle = Utils.lerp(this.p2AimAngle, 0, 0.1);
			else if (this.keys['j']) this.p2AimAngle = Utils.lerp(this.p2AimAngle, Math.PI, 0.1);
		}

		return {
			left: this.keys['j'],
			right: this.keys['l'],
			jump: this.keys['i'],
			crouch: this.keys['k'],
			sprint: false,
			shoot: this.keys['o'],
			reload: this.keys['p'],
			dash: this.keys['n'],
			shield: this.keys['m'],
			invis: this.keys[','],
			aimAngle: this.p2AimAngle
		};
	}

	applyAimAssist(aimAngle) {
		const assistRadius = 0.12;
		const assistRange = 500;
		const p = this.localPlayer;
		let bestAngleDiff = assistRadius;
		let bestTargetAngle = aimAngle;

		for (const other of this.players) {
			if (other === p || !other.alive) continue;
			if (p.team && other.team === p.team) continue;
			if (other.abilities && other.abilities.invisibility.active) continue;

			const dist = Utils.dist(p.getCenterX(), p.getCenterY(), other.getCenterX(), other.getCenterY());
			if (dist > assistRange) continue;

			const targetAngle = Math.atan2(
				other.getCenterY() - p.getCenterY(),
				other.getCenterX() - p.getCenterX()
			);

			let diff = targetAngle - aimAngle;
			while (diff > Math.PI) diff -= Math.PI * 2;
			while (diff < -Math.PI) diff += Math.PI * 2;

			if (Math.abs(diff) < bestAngleDiff) {
				bestAngleDiff = Math.abs(diff);
				bestTargetAngle = targetAngle;
			}
		}

		if (bestTargetAngle !== aimAngle) {
			let diff = bestTargetAngle - aimAngle;
			while (diff > Math.PI) diff -= Math.PI * 2;
			while (diff < -Math.PI) diff += Math.PI * 2;
			const strength = 0.3 * (1 - bestAngleDiff / assistRadius);
			aimAngle += diff * strength;
		}

		return aimAngle;
	}

	cycleSpectate(dir) {
		const alive = this.players.filter(p => p.alive && p !== this.localPlayer);
		if (alive.length === 0) return;
		this.spectateIndex = ((this.spectateIndex + dir) % alive.length + alive.length) % alive.length;
		this.spectating = true;
	}

	getSpectateTarget() {
		const alive = this.players.filter(p => p.alive && p !== this.localPlayer);
		if (alive.length === 0) return this.localPlayer;
		this.spectateIndex = Math.min(this.spectateIndex, alive.length - 1);
		return alive[this.spectateIndex];
	}

	startMatch(settings) {
		this.running = true;
		this.paused = false;
		this.bullets = [];
		this.particles.clear();
		this.weaponPickups = [];
		this.spectating = false;
		this.spectateIndex = 0;
		this.shake.intensity = 0;
		this.is2Player = settings.players === '2p';
		this.player2 = null;
		this.p2AimAngle = 0;
		this.p1AimAngle = 0;

		this.map = new GameMap(MAPS[settings.mapIndex] || MAPS[0]);
		this.gameMode = new GameMode(settings.mode);

		this.players = [];
		const skin = this.progression.getPlayerSkin();
		this.localPlayer = new Player('player', this.is2Player ? 'P1' : 'You', true, null, skin);
		const startWeapons = this.progression.getStartingWeapons();
		this.localPlayer.weapons = startWeapons.map(id => new WeaponInstance(id));
		this.players.push(this.localPlayer);

		if (this.is2Player) {
			const p2Skin = PLAYER_SKINS.find(s => s.id === 'red_ninja') || PLAYER_SKINS[1] || PLAYER_SKINS[0];
			this.player2 = new Player('player2', 'P2', true, null, p2Skin);
			this.player2.weapons = startWeapons.map(id => new WeaponInstance(id));
			this.players.push(this.player2);
			this.setupSplitScreenHUD();
		} else {
			this.removeSplitScreenHUD();
		}

		this.bots = [];
		const botNames = Utils.shuffle(BOT_NAMES);
		for (let i = 0; i < settings.botCount; i++) {
			const botSkin = Utils.randChoice(PLAYER_SKINS);
			const botPlayer = new Player(`bot_${i}`, botNames[i % botNames.length], false, null, botSkin);
			const bot = new Bot(botPlayer, settings.botDifficulty);

			const botWeapons = ['pistol'];
			let pool;
			if (bot.preferredRange === 'close') pool = ['shotgun', 'smg'];
			else if (bot.preferredRange === 'far') pool = ['sniper', 'assault', 'rocket'];
			else pool = ['assault', 'laser', 'slime', 'smg'];
			const extras = Utils.shuffle(pool).slice(0, Utils.randInt(1, 2));
			botWeapons.push(...extras);
			botPlayer.weapons = botWeapons.map(id => new WeaponInstance(id));

			this.players.push(botPlayer);
			this.bots.push(bot);
		}

		this.gameMode.assignTeams(this.players);
		this.spawnAllPlayers();
		this.spawnWeaponPickups();

		this.ui.showScreen('game-screen');
		this.ui.clearGameHUD();

		Sound.ensureReady();
		Sound.startBGMusic();

		this.lastTime = performance.now();
		this._prevMouseDown = false;
		this._firedThisClick = false;
		this._prevP2Shoot = false;
		this.loop();
	}

	setupSplitScreenHUD() {
		this.removeSplitScreenHUD();
		const hud = document.getElementById('hud');
		if (!hud) return;

		const divider = document.createElement('div');
		divider.className = 'split-divider';
		divider.id = 'split-divider';
		hud.appendChild(divider);

		const labelP1 = document.createElement('div');
		labelP1.className = 'split-label split-label-p1';
		labelP1.id = 'split-label-p1';
		labelP1.textContent = 'P1';
		hud.appendChild(labelP1);

		const labelP2 = document.createElement('div');
		labelP2.className = 'split-label split-label-p2';
		labelP2.id = 'split-label-p2';
		labelP2.textContent = 'P2';
		hud.appendChild(labelP2);

		const p2Hud = document.createElement('div');
		p2Hud.className = 'p2-hud';
		p2Hud.id = 'p2-hud';
		p2Hud.innerHTML = '<div class="p2-hud-top"></div><div class="p2-hud-bottom"></div>';
		hud.appendChild(p2Hud);
	}

	removeSplitScreenHUD() {
		['split-divider', 'split-label-p1', 'split-label-p2', 'p2-hud'].forEach(id => {
			const el = document.getElementById(id);
			if (el) el.remove();
		});
	}

	spawnAllPlayers() {
		for (const p of this.players) this.spawnPlayer(p);
	}

	spawnPlayer(player) {
		const spawns = this.map.getSpawnPoint(player.team);
		let bestSpawn = Utils.randChoice(spawns);
		let bestMinDist = 0;
		for (const spawn of spawns) {
			const sx = spawn.x * TILE_SIZE;
			const sy = spawn.y * TILE_SIZE;
			let minDist = Infinity;
			for (const other of this.players) {
				if (other === player || !other.alive) continue;
				const d = Utils.dist(sx, sy, other.getCenterX(), other.getCenterY());
				if (d < minDist) minDist = d;
			}
			if (minDist > bestMinDist) { bestMinDist = minDist; bestSpawn = spawn; }
		}
		player.spawn(bestSpawn.x, bestSpawn.y);
	}

	spawnWeaponPickups() {
		this.weaponPickups = [];
		const weaponKeys = Object.keys(WEAPONS).filter(w => w !== 'pistol');
		const numPickups = Math.min(6, 3 + Math.floor(this.map.data.width / 15));
		for (let i = 0; i < numPickups; i++) {
			const spawn = this.map.spawns[i % this.map.spawns.length];
			this.weaponPickups.push({
				x: spawn.x * TILE_SIZE + Utils.rand(-40, 40),
				y: spawn.y * TILE_SIZE - 10,
				weaponId: Utils.randChoice(weaponKeys),
				alive: true, respawnTimer: 0,
				bobT: Math.random() * Math.PI * 2
			});
		}
	}

	loop() {
		if (!this.running) return;
		const now = performance.now();
		const dt = Math.min((now - this.lastTime) / 1000, 0.05);
		this.lastTime = now;
		if (!this.paused) this.update(now, dt);
		this.render();
		requestAnimationFrame(() => this.loop());
	}

	update(now, dt) {
		this.map.update(dt);

		if (this.localPlayer) this._antiCheatCheck(this.localPlayer);
		if (this.player2) this._antiCheatCheck(this.player2);

		this.gameMode.update(this.players, this.map, dt);
		if (this.gameMode.ended) { this.endMatch(); return; }

		const localInput = this.getLocalInput();
		if (this.localPlayer.alive) {
			this.localPlayer.update(localInput, this.map, now, dt);
		}

		if (this.player2) {
			const p2Input = this.getPlayer2Input();
			if (this.player2.alive) {
				this.player2.update(p2Input, this.map, now, dt);
			}
		}

		for (const bot of this.bots) {
			bot.update(this.players, this.map, this.gameMode, now, dt);
			if (bot.player.alive) bot.player.update(bot.input, this.map, now, dt);
		}

		this.handleShooting(now);
		this.updateBullets(now, dt);
		this.handleRespawns(now, dt);
		this.updatePickups(dt);

		this.particles.update(dt);
		this.shake.update();
		this.updateCamera();
		if (this.is2Player) this.updateCamera2();

		if (this.localPlayer) this.ui.updateHUD(this.localPlayer, this.gameMode, now);
		if (this.player2) this.ui.updateP2HUD(this.player2);
	}

	_antiCheatCheck(p) {
		if (p.alive) {
			p.health = Math.min(p.health, p.maxHealth);
			if (p.health < 0) p.health = 0;
		}
		const maxVx = 25;
		const maxVy = 25;
		p.vx = Utils.clamp(p.vx, -maxVx, maxVx);
		p.vy = Utils.clamp(p.vy, -maxVy, maxVy);
		if (this.map) {
			p.x = Utils.clamp(p.x, 0, this.map.width);
			p.y = Utils.clamp(p.y, -200, this.map.height + 100);
		}
		const w = p.currentWeapon;
		if (w && w.data) {
			if (w.ammo > w.data.magSize) w.ammo = w.data.magSize;
			if (w.ammo < 0) w.ammo = 0;
			if (w.reserveAmmo > w.data.totalAmmo * 2) w.reserveAmmo = w.data.totalAmmo * 2;
		}
	}

	handleShooting(now) {
		for (const p of this.players) {
			if (!p.alive) continue;

			let shouldShoot = false;
			if (p === this.localPlayer) {
				if (p.currentWeapon.data.auto) {
					shouldShoot = this.mouse.down || this.keys['v'];
				} else {
					if ((this.mouse.down && !this._prevMouseDown) || (this.keys['v'] && !this._prevP2Shoot)) {
						shouldShoot = true;
					}
				}
			} else if (p === this.player2) {
				if (p.currentWeapon.data.auto) {
					shouldShoot = !!this.keys['o'];
				} else {
					if (this.keys['o'] && !this._prevP2Shoot) shouldShoot = true;
				}
			} else {
				const bot = this.bots.find(b => b.player === p);
				if (bot) {
					shouldShoot = bot.input.shoot;
					if (bot.input.reload) p.currentWeapon.startReload(now);
				}
			}

			if (shouldShoot) {
				const gunPos = p.getGunPos();
				const effectiveAngle = p.aimAngle + p.recoilOffset;
				const effectiveSpread = p.getEffectiveSpread();

				const result = p.currentWeapon.fire(
					gunPos.x, gunPos.y, effectiveAngle, effectiveSpread,
					p.id, p.team, now
				);

				if (result.bullets.length > 0) {
					const maxBullets = p.currentWeapon.data.bulletCount;
					this.bullets.push(...result.bullets.slice(0, maxBullets));
					this.particles.muzzleFlash(gunPos.x, gunPos.y, effectiveAngle);
					p.addRecoil(result.recoilAmount);

					if (p === this.localPlayer || p === this.player2) {
						const shakeAmt = p.currentWeapon.data.screenShake || 1;
						this.shake.addDirectional(shakeAmt, effectiveAngle);
					}
				}
			}
		}
		this._prevMouseDown = this.mouse.down;
		this._prevP2Shoot = !!this.keys['o'] || !!this.keys['v'];
	}

	updateBullets(now, dt) {
		const allPlats = this.map.getAllPlatforms();

		for (let i = this.bullets.length - 1; i >= 0; i--) {
			const b = this.bullets[i];
			b.update();
			if (!b.alive) { this.bullets.splice(i, 1); continue; }

			for (const p of allPlats) {
				const pr = { x: p.x * TILE_SIZE, y: p.y * TILE_SIZE, w: p.w * TILE_SIZE, h: p.h * TILE_SIZE };
				if (Utils.pointInRect(b.x, b.y, pr)) {
					b.alive = false;
					if (b.explosive) this.handleExplosion(b);
					else this.particles.bulletImpact(b.x, b.y, b.isLaser ? '#00ffcc' : b.isSlime ? '#00ff00' : '#ffcc00');
					break;
				}
			}
			if (!b.alive) { this.bullets.splice(i, 1); continue; }

			for (const p of this.players) {
				if (!p.alive || p.id === b.ownerId) continue;
				if (b.ownerTeam && p.team === b.ownerTeam) continue;

				const hitBox = { x: p.x, y: p.y, w: p.width, h: p.height };
				if (Utils.pointInRect(b.x, b.y, hitBox)) {
					const isHeadshot = b.y < p.y + 14 && b.y >= p.y;
					let dmg = b.damage;
					if (isHeadshot) dmg = Math.floor(dmg * b.headshotMult);

					const actualDmg = p.takeDamage(dmg, b.ownerId, isHeadshot);
					const attacker = this.players.find(pl => pl.id === b.ownerId);
					if (attacker) attacker.damageDealt += actualDmg;

					if (isHeadshot) { this.particles.damageNumber(b.x, b.y, dmg, true); Sound.playHeadshot(); }
					else { this.particles.damageNumber(b.x, b.y, dmg, false); Sound.playHit(); }

					this.particles.bloodSplatter(b.x, b.y);

					if (b.ownerId === this.localPlayer.id || (this.player2 && b.ownerId === this.player2.id)) {
						this.ui.showHitmarker(isHeadshot);
						const hitShake = (attacker?.currentWeapon?.data?.hitShake) || 2;
						this.shake.add(hitShake);
					}
					if (p === this.localPlayer || p === this.player2) this.ui.showDamageOverlay();

					if (b.slowEffect && p.alive) { p.slowMultiplier = b.slowEffect; p.slowTimer = 2; }
					if (!p.alive) this.onPlayerKill(attacker, p, isHeadshot, b.weaponType);

					b.alive = false;
					if (b.explosive) this.handleExplosion(b);
					break;
				}
			}

			if (b.alive) {
				if (b.isLaser && Math.random() < 0.3) this.particles.laserTrail(b.x, b.y);
				if (b.isSlime && Math.random() < 0.3) this.particles.slimeTrail(b.x, b.y);
			}
			if (!b.alive) this.bullets.splice(i, 1);
		}
	}

	handleExplosion(bullet) {
		this.particles.explosion(bullet.x, bullet.y, bullet.explosionRadius);
		Sound.playExplosion();
		this.shake.add(10);

		for (const p of this.players) {
			if (!p.alive) continue;
			if (p.team && p.team === bullet.ownerTeam && p.id !== bullet.ownerId) continue;
			const dist = Utils.dist(bullet.x, bullet.y, p.getCenterX(), p.getCenterY());
			if (dist < bullet.explosionRadius) {
				const falloff = 1 - (dist / bullet.explosionRadius);
				const dmg = Math.floor(bullet.damage * falloff);
				if (dmg > 0) {
					const actualDmg = p.takeDamage(dmg, bullet.ownerId, false);
					const attacker = this.players.find(pl => pl.id === bullet.ownerId);
					if (attacker && attacker !== p) attacker.damageDealt += actualDmg;
					this.particles.damageNumber(p.getCenterX(), p.y, dmg, false);
					if (p === this.localPlayer || p === this.player2) this.ui.showDamageOverlay();
					if (!p.alive) this.onPlayerKill(attacker, p, false, bullet.weaponType);
				}
			}
		}
	}

	onPlayerKill(killer, victim, isHeadshot, weaponType) {
		this.particles.deathEffect(victim.getCenterX(), victim.getCenterY(), victim.skin.color);
		Sound.playDeath();

		if (killer && killer !== victim) {
			killer.kills = Math.floor(killer.kills) + 1;
			killer.score = Math.floor(killer.score) + (isHeadshot ? 150 : 100);
			if (isHeadshot) killer.headshots = Math.floor(killer.headshots) + 1;
			if (weaponType) killer.weaponKills[weaponType] = (killer.weaponKills[weaponType] || 0) + 1;

			const killNow = performance.now();
			if (killNow - killer.lastKillTime < KILL_STREAK_TIMEOUT) killer.killStreak++;
			else killer.killStreak = 1;
			killer.lastKillTime = killNow;

			if (killer === this.localPlayer || killer === this.player2) Sound.playKillConfirm();

			const killerBot = this.bots.find(b => b.player === killer);
			if (killerBot) killerBot.onKill();
			const victimBot = this.bots.find(b => b.player === victim);
			if (victimBot) victimBot.onDeath();

			if (killer.team) {
				for (const bot of this.bots) {
					if (bot.player !== killer && bot.player.alive && bot.player.team === killer.team)
						bot.onTeammateKill(killer);
				}
			}

			for (const streak of KILL_STREAKS) {
				if (killer.killStreak === streak.kills) {
					if (killer === this.localPlayer || killer === this.player2)
						this.ui.showKillStreak(streak.name, streak.color);
					this.ui.addKillFeed(killer.name, streak.name, '🔥', false);
					break;
				}
			}
		} else {
			const victimBot = this.bots.find(b => b.player === victim);
			if (victimBot) victimBot.onDeath();
		}

		victim.respawnTimer = RESPAWN_TIME;
		this.gameMode.onPlayerDeath(victim, killer, this.map);

		const killerName = killer ? killer.name : '☠️';
		const weaponIcon = killer ? killer.currentWeapon.data.icon : '💀';
		this.ui.addKillFeed(killerName, victim.name, weaponIcon, isHeadshot);

		if (killer === this.localPlayer || killer === this.player2)
			this.ui.showNotification(isHeadshot ? '💀 HEADSHOT!' : '✓ ELIMINATED', isHeadshot ? '#ff0000' : '#ffcc00');
		if (victim === this.localPlayer || victim === this.player2)
			this.ui.showNotification(`${victim.name} killed by ${killerName}`, '#ff4444');
	}

	handleRespawns(now, dt) {
		for (const p of this.players) {
			if (p.alive) continue;
			p.respawnTimer -= dt;
			if (p.respawnTimer <= 0) {
				this.spawnPlayer(p);
				if (p === this.localPlayer) this.spectating = false;
			}
		}
	}

	updatePickups(dt) {
		for (const pk of this.weaponPickups) {
			if (!pk.alive) {
				pk.respawnTimer -= dt;
				if (pk.respawnTimer <= 0) {
					pk.alive = true;
					pk.weaponId = Utils.randChoice(Object.keys(WEAPONS).filter(w => w !== 'pistol'));
				}
				continue;
			}
			pk.bobT += dt * 3;
			for (const p of this.players) {
				if (!p.alive) continue;
				if (Utils.dist(p.getCenterX(), p.getCenterY(), pk.x, pk.y) < 30) {
					p.pickupWeapon(pk.weaponId);
					pk.alive = false;
					pk.respawnTimer = 12;
					if (p === this.localPlayer || p === this.player2) {
						Sound.playPickup();
						this.ui.showNotification(`${p.name} picked up ${WEAPONS[pk.weaponId].name}`, '#00ccff');
					} else {
						const bot = this.bots.find(b => b.player === p);
						if (bot) bot.onPickup(WEAPONS[pk.weaponId].name);
					}
					break;
				}
			}
		}
	}

	updateCamera() {
		let target = this.localPlayer;
		if (!this.localPlayer.alive && this.spectating) target = this.getSpectateTarget();
		if (!target) return;
		const halfView = this.is2Player ? this.canvas.width / 4 : this.canvas.width / 2;
		const maxCamX = this.is2Player ? this.map.width - this.canvas.width / 2 : this.map.width - this.canvas.width;
		const targetX = target.getCenterX() - halfView;
		const targetY = target.getCenterY() - this.canvas.height / 2;
		this.camera.x = Utils.lerp(this.camera.x, targetX, 0.1);
		this.camera.y = Utils.lerp(this.camera.y, targetY, 0.1);
		this.camera.x = Utils.clamp(this.camera.x, 0, Math.max(0, maxCamX));
		this.camera.y = Utils.clamp(this.camera.y, 0, Math.max(0, this.map.height - this.canvas.height));
	}

	updateCamera2() {
		if (!this.player2) return;
		const target = this.player2;
		const targetX = target.getCenterX() - this.canvas.width / 4;
		const targetY = target.getCenterY() - this.canvas.height / 2;
		this.camera2.x = Utils.lerp(this.camera2.x, targetX, 0.1);
		this.camera2.y = Utils.lerp(this.camera2.y, targetY, 0.1);
		this.camera2.x = Utils.clamp(this.camera2.x, 0, Math.max(0, this.map.width - this.canvas.width / 2));
		this.camera2.y = Utils.clamp(this.camera2.y, 0, Math.max(0, this.map.height - this.canvas.height));
	}

	render() {
		if (this.is2Player) this.renderSplitScreen(this.ctx);
		else this.renderSinglePlayer(this.ctx);
	}

	renderSinglePlayer(ctx) {
		const cx = this.camera.x + this.shake.offsetX;
		const cy = this.camera.y + this.shake.offsetY;
		ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

		this.map.render(ctx, cx, cy);
		if (this.gameMode.type === 'ctf') this.map.renderFlags(ctx, cx, cy, this.gameMode);
		this.renderPickups(ctx, cx, cy);

		const renderOrder = this.players.filter(p => p !== this.localPlayer);
		renderOrder.push(this.localPlayer);
		for (const p of renderOrder) { if (p) p.render(ctx, cx, cy, p === this.localPlayer); }

		for (const b of this.bullets) b.render(ctx, cx, cy);
		this.particles.render(ctx, cx, cy);

		if (this.localPlayer && this.localPlayer.alive) {
			this.renderCrosshairAt(ctx, this.mouse.x, this.mouse.y, this.localPlayer);
			this.renderReloadBar(ctx);
		}
		if (this.localPlayer && !this.localPlayer.alive) this.renderDeathOverlay(ctx);
	}

	renderSplitScreen(ctx) {
		const halfW = Math.floor(this.canvas.width / 2);
		const fullH = this.canvas.height;
		const sx = this.shake.offsetX;
		const sy = this.shake.offsetY;
		ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

		// === LEFT: P1 ===
		ctx.save();
		ctx.beginPath(); ctx.rect(0, 0, halfW, fullH); ctx.clip();
		const cx1 = this.camera.x + sx, cy1 = this.camera.y + sy;
		this.map.render(ctx, cx1, cy1);
		if (this.gameMode.type === 'ctf') this.map.renderFlags(ctx, cx1, cy1, this.gameMode);
		this.renderPickups(ctx, cx1, cy1);
		for (const p of this.players) { if (p && p.alive) p.render(ctx, cx1, cy1, p === this.localPlayer); }
		for (const b of this.bullets) b.render(ctx, cx1, cy1);
		this.particles.render(ctx, cx1, cy1);
		if (this.localPlayer && this.localPlayer.alive) {
			const clampedMX = Math.min(this.mouse.x, halfW - 5);
			this.renderCrosshairAt(ctx, clampedMX, this.mouse.y, this.localPlayer);
		}
		if (this.localPlayer && !this.localPlayer.alive) {
			ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(0, 0, halfW, fullH);
			ctx.fillStyle = '#fff'; ctx.font = 'bold 20px Orbitron, sans-serif'; ctx.textAlign = 'center';
			ctx.fillText(`Respawn: ${Math.max(0, Math.ceil(this.localPlayer.respawnTimer))}`, halfW / 2, fullH / 2);
		}
		ctx.restore();

		// === RIGHT: P2 ===
		ctx.save();
		ctx.beginPath(); ctx.rect(halfW, 0, halfW, fullH); ctx.clip();
		ctx.save(); ctx.translate(halfW, 0);
		const cx2 = this.camera2.x + sx, cy2 = this.camera2.y + sy;
		this.map.render(ctx, cx2, cy2);
		if (this.gameMode.type === 'ctf') this.map.renderFlags(ctx, cx2, cy2, this.gameMode);
		this.renderPickups(ctx, cx2, cy2);
		for (const p of this.players) { if (p && p.alive) p.render(ctx, cx2, cy2, p === this.player2); }
		for (const b of this.bullets) b.render(ctx, cx2, cy2);
		this.particles.render(ctx, cx2, cy2);
		if (this.player2 && this.player2.alive) {
			const p2sx = this.player2.getCenterX() - cx2;
			const p2sy = this.player2.getCenterY() - cy2;
			const p2mx = p2sx + Math.cos(this.p2AimAngle) * 60;
			const p2my = p2sy + Math.sin(this.p2AimAngle) * 60;
			this.renderCrosshairAt(ctx, p2mx, p2my, this.player2);
		}
		if (this.player2 && !this.player2.alive) {
			ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(0, 0, halfW, fullH);
			ctx.fillStyle = '#fff'; ctx.font = 'bold 20px Orbitron, sans-serif'; ctx.textAlign = 'center';
			ctx.fillText(`Respawn: ${Math.max(0, Math.ceil(this.player2.respawnTimer))}`, halfW / 2, fullH / 2);
		}
		ctx.restore(); ctx.restore();
	}

	renderPickups(ctx, cx, cy) {
		for (const pk of this.weaponPickups) {
			if (!pk.alive) continue;
			const psx = pk.x - cx, psy = pk.y - cy + Math.sin(pk.bobT) * 4;
			if (psx < -30 || psx > this.canvas.width + 30 || psy < -30 || psy > this.canvas.height + 30) continue;
			ctx.fillStyle = 'rgba(255,200,0,0.15)';
			ctx.beginPath(); ctx.arc(psx, psy, 16, 0, Math.PI * 2); ctx.fill();
			ctx.font = '18px Arial'; ctx.textAlign = 'center';
			ctx.fillText(WEAPONS[pk.weaponId].icon, psx, psy + 6);
		}
	}

	renderCrosshairAt(ctx, mx, my, player) {
		const spread = player.currentSpread || 0;
		const gap = 4 + spread * 60;
		const size = 10 + spread * 20;
		const sn = Utils.clamp(spread / 0.15, 0, 1);
		ctx.strokeStyle = `rgba(255,${Math.floor(Utils.lerp(255, 200, sn))},${Math.floor(Utils.lerp(255, 150, sn))},0.9)`;
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.moveTo(mx - size, my); ctx.lineTo(mx - gap, my);
		ctx.moveTo(mx + gap, my); ctx.lineTo(mx + size, my);
		ctx.moveTo(mx, my - size); ctx.lineTo(mx, my - gap);
		ctx.moveTo(mx, my + gap); ctx.lineTo(mx, my + size);
		ctx.stroke();
		ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(mx, my, 1.5, 0, Math.PI * 2); ctx.fill();
	}

	renderReloadBar(ctx) {
		const w = this.localPlayer.currentWeapon;
		if (!w || !w.reloading) return;
		const mx = this.mouse.x, my = this.mouse.y;
		const progress = w.getReloadProgress(performance.now());
		ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(mx - 20, my + 22, 40, 4);
		ctx.fillStyle = '#ffcc00'; ctx.fillRect(mx - 20, my + 22, 40 * progress, 4);
		ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1; ctx.strokeRect(mx - 20, my + 22, 40, 4);
	}

	renderDeathOverlay(ctx) {
		ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
		ctx.fillStyle = '#fff'; ctx.font = 'bold 32px Orbitron, sans-serif'; ctx.textAlign = 'center';
		ctx.fillText(`Respawning in ${Math.max(0, Math.ceil(this.localPlayer.respawnTimer))}...`, this.canvas.width / 2, this.canvas.height / 2 - 20);
		ctx.font = '16px Rajdhani, sans-serif'; ctx.fillStyle = '#aaa';
		ctx.fillText('Press A/D to spectate other players', this.canvas.width / 2, this.canvas.height / 2 + 20);
		if (this.spectating) {
			const target = this.getSpectateTarget();
			if (target && target !== this.localPlayer) {
				ctx.fillStyle = '#ffcc00'; ctx.font = 'bold 16px Rajdhani, sans-serif';
				ctx.fillText(`Spectating: ${target.name}`, this.canvas.width / 2, 50);
			}
		}
	}

	endMatch() {
		this.running = false;
		Sound.stopBGMusic();
		const won = this.gameMode.type === 'ffa'
			? this.gameMode.winner === this.localPlayer
			: this.gameMode.winner === this.localPlayer.team;
		const stats = {
			kills: this.localPlayer.kills, deaths: this.localPlayer.deaths,
			headshots: this.localPlayer.headshots, damageDealt: this.localPlayer.damageDealt,
			flagCaptures: this.localPlayer.flagCaptures, sniperKills: this.localPlayer.weaponKills['sniper'] || 0,
			won: won
		};
		const xpResult = this.progression.recordMatchEnd(stats, won);
		this.ui.showMatchEnd(this.players, this.localPlayer, this.gameMode, xpResult);

		const recordEntry = (player) => {
			if (!player || !player.isHuman || !window.leaderboard) return;
			const playerWon = this.gameMode.type === 'ffa'
				? this.gameMode.winner === player
				: this.gameMode.winner === player.team;
			const wins = playerWon ? 1 : 0;
			const kills = Math.floor(player.kills || 0);
			const deaths = Math.floor(player.deaths || 0);
			const score = Math.floor(player.score || 0);
			window.leaderboard.addEntry(player.name, kills, deaths, wins, score, false);
			if (window.leaderboard.syncSupabaseEntry) {
				window.leaderboard.syncSupabaseEntry({ name: player.name, kills, deaths, wins, score });
			}
		};

		recordEntry(this.localPlayer);
		if (this.player2 && this.player2.isHuman) recordEntry(this.player2);
	}

	pause() { this.paused = true; this.ui.showPause(); }
	resume() { this.paused = false; this.ui.hidePause(); this.lastTime = performance.now(); }
	quit() {
		this.running = false; this.paused = false;
		this.player2 = null; this.is2Player = false;
		this.removeSplitScreenHUD();
		Sound.stopBGMusic(); this.ui.hidePause();
		document.getElementById('match-end')?.classList.add('hidden');
		this.ui.showScreen('main-menu'); this.ui.updateMenuInfo();
	}
}
