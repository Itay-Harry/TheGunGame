class SoundEngine {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.musicGain = null;
        this.sfxGain = null;
        this.initialized = false;
    }

    init() {
        if (this.initialized) return;
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = 0.5;
            this.masterGain.connect(this.ctx.destination);

            this.sfxGain = this.ctx.createGain();
            this.sfxGain.gain.value = 0.7;
            this.sfxGain.connect(this.masterGain);

            this.musicGain = this.ctx.createGain();
            this.musicGain.gain.value = 0.15;
            this.musicGain.connect(this.masterGain);

            this.initialized = true;
        } catch (e) {
            console.warn('Audio not available:', e);
        }
    }

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => {});
        }
    }

    ensureReady() {
        this.init();
        this.resume();
    }

    playNoise(duration, volume, filterFreq) {
        if (!this.initialized) return;
        try {
            const bufferSize = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

            const source = this.ctx.createBufferSource();
            source.buffer = buffer;

            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(volume, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = filterFreq || 3000;

            source.connect(filter).connect(gain).connect(this.sfxGain);
            source.start();
            source.stop(this.ctx.currentTime + duration + 0.05);
        } catch (e) { /* ignore audio errors */ }
    }

    playTone(freq, duration, type = 'sine', volume = 0.3) {
        if (!this.initialized) return;
        try {
            const osc = this.ctx.createOscillator();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(volume, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

            osc.connect(gain).connect(this.sfxGain);
            osc.start();
            osc.stop(this.ctx.currentTime + duration + 0.05);
        } catch (e) { /* ignore audio errors */ }
    }

    playGunSound(type) {
        this.ensureReady();
        switch (type) {
            case 'pistol':
                this.playNoise(0.08, 0.5, 4000);
                this.playTone(800, 0.05, 'square', 0.2);
                break;
            case 'shotgun':
                this.playNoise(0.15, 0.8, 2000);
                this.playTone(200, 0.1, 'sawtooth', 0.3);
                break;
            case 'smg':
                this.playNoise(0.04, 0.3, 5000);
                this.playTone(1200, 0.03, 'square', 0.15);
                break;
            case 'assault':
                this.playNoise(0.06, 0.5, 3500);
                this.playTone(600, 0.05, 'square', 0.2);
                break;
            case 'sniper':
                this.playNoise(0.2, 0.7, 1500);
                this.playTone(150, 0.15, 'sawtooth', 0.4);
                this.playTone(100, 0.3, 'sine', 0.2);
                break;
            case 'laser':
                this.playTone(2000, 0.08, 'sine', 0.3);
                this.playTone(2500, 0.06, 'sine', 0.2);
                break;
            case 'slime':
                this.playTone(200, 0.15, 'sine', 0.4);
                this.playNoise(0.1, 0.2, 800);
                break;
            case 'rocket':
                this.playNoise(0.3, 0.6, 500);
                this.playTone(80, 0.4, 'sawtooth', 0.4);
                break;
        }
    }

    playHit() {
        this.playTone(1000, 0.06, 'square', 0.35);
        this.playNoise(0.04, 0.25, 6000);
    }

    playHeadshot() {
        this.playTone(1500, 0.1, 'square', 0.45);
        this.playTone(2200, 0.08, 'sine', 0.35);
        this.playNoise(0.06, 0.35, 8000);
    }

    playKillConfirm() {
        // Satisfying "ding" on kill
        this.playTone(880, 0.12, 'sine', 0.4);
        setTimeout(() => this.playTone(1320, 0.1, 'sine', 0.35), 60);
    }

    playExplosion() {
        this.playNoise(0.5, 0.9, 400);
        this.playTone(60, 0.4, 'sawtooth', 0.5);
        this.playTone(40, 0.6, 'sine', 0.3);
    }

    playReload() {
        setTimeout(() => this.playTone(600, 0.05, 'square', 0.15), 0);
        setTimeout(() => this.playTone(800, 0.05, 'square', 0.15), 200);
        setTimeout(() => this.playTone(1000, 0.03, 'square', 0.2), 400);
    }

    playDeath() { this.playTone(400, 0.2, 'sawtooth', 0.3); this.playTone(200, 0.3, 'sine', 0.2); }
    playPickup() { this.playTone(800, 0.08, 'sine', 0.3); setTimeout(() => this.playTone(1200, 0.08, 'sine', 0.3), 80); }
    playAbility() { this.playTone(600, 0.1, 'sine', 0.25); this.playTone(900, 0.1, 'sine', 0.2); }
    playKillStreak() { this.playTone(880, 0.1, 'sine', 0.35); setTimeout(() => this.playTone(1100, 0.1, 'sine', 0.35), 100); setTimeout(() => this.playTone(1320, 0.15, 'sine', 0.4), 200); }
    playVictory() { [523, 659, 784, 1047].forEach((n, i) => setTimeout(() => this.playTone(n, 0.3, 'sine', 0.3), i * 150)); }
    playDefeat() { [400, 350, 300, 200].forEach((n, i) => setTimeout(() => this.playTone(n, 0.3, 'sine', 0.25), i * 200)); }

    startBGMusic() {
        if (!this.initialized || this._bgInterval) return;
        const scale = [261, 293, 329, 349, 392, 440, 493, 523];
        let step = 0;
        this._bgInterval = setInterval(() => {
            if (!this.ctx || this.ctx.state === 'suspended') return;
            try {
                const note = scale[step % scale.length];
                const osc = this.ctx.createOscillator();
                osc.type = 'sine';
                osc.frequency.value = note * 0.5;
                const g = this.ctx.createGain();
                g.gain.setValueAtTime(0.05, this.ctx.currentTime);
                g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.8);
                osc.connect(g).connect(this.musicGain);
                osc.start();
                osc.stop(this.ctx.currentTime + 0.8);
            } catch (e) {}
            step++;
        }, 800);
    }

    stopBGMusic() {
        if (this._bgInterval) { clearInterval(this._bgInterval); this._bgInterval = null; }
    }
}

const Sound = new SoundEngine();
