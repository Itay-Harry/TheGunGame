const GAME_WIDTH = 1600;
const GAME_HEIGHT = 900;
const GRAVITY = 0.6;
const TILE_SIZE = 40;
const MATCH_DURATION = 180; // 3 minutes
const RESPAWN_TIME = 3;
const MAX_KILLS_FFA = 20;
const MAX_KILLS_TDM = 30;
const CTF_CAPTURES_TO_WIN = 3;

// Movement spread penalty: multiplier added to spread when moving
const MOVE_SPREAD_MULT = 1.25;
// Crouch spread bonus: multiplier when crouching
const CROUCH_SPREAD_MULT = 0.6;
// Recoil recovery speed (per second, in radians)
const RECOIL_RECOVERY = 12;
const KILL_STREAK_TIMEOUT = 4000;
const COINS_PER_LEVEL = 50;
const XP_PER_LEVEL_BASE = 100;
const XP_PER_LEVEL = (level = 1) => XP_PER_LEVEL_BASE;
const DAILY_REWARD_COINS = 25;
const XP_PER_KILL = 20;
const XP_PER_WIN = 50;
const XP_PER_FLAG = 30;
const XP_PER_HEADSHOT = 10;
const COINS_PER_KILL = 5;
const COINS_PER_WIN = 25;

const ABILITIES = {
    dash: { name: 'Dash', key: 'q' },
    shield: { name: 'Shield', key: 'e' },
    invisibility: { name: 'Invis', key: 'f' }
};

const WEAPONS = {
    pistol: {
        name: 'Pistol', icon: '🔫', type: 'pistol',
        damage: 18, fireRate: 280, reloadTime: 1100, magSize: 12, totalAmmo: 120,
        spread: 0.02, bulletSpeed: 28, range: 520, recoil: 1.0,
        recoilRecovery: 14,
        auto: false, bulletCount: 1, headshotMult: 2.0,
        sound: 'pistol', slot: 0,
        screenShake: 1, hitShake: 3
    },
    shotgun: {
        name: 'Shotgun', icon: '💥', type: 'shotgun',
        damage: 9, fireRate: 750, reloadTime: 2000, magSize: 6, totalAmmo: 36,
        spread: 0.14, bulletSpeed: 22, range: 260, recoil: 4,
        recoilRecovery: 8,
        auto: false, bulletCount: 8, headshotMult: 1.5,
        sound: 'shotgun', slot: 1,
        screenShake: 3, hitShake: 2
    },
    smg: {
        name: 'SMG', icon: '🔥', type: 'smg',
        damage: 11, fireRate: 75, reloadTime: 1400, magSize: 30, totalAmmo: 180,
        spread: 0.045, bulletSpeed: 24, range: 380, recoil: 0.6,
        recoilRecovery: 16,
        auto: true, bulletCount: 1, headshotMult: 1.8,
        sound: 'smg', slot: 1,
        screenShake: 0.5, hitShake: 2
    },
    assault: {
        name: 'Assault Rifle', icon: '🎯', type: 'assault',
        damage: 22, fireRate: 115, reloadTime: 1700, magSize: 25, totalAmmo: 150,
        spread: 0.03, bulletSpeed: 30, range: 650, recoil: 1.5,
        recoilRecovery: 12,
        auto: true, bulletCount: 1, headshotMult: 2.0,
        sound: 'assault', slot: 2,
        screenShake: 1.2, hitShake: 3
    },
    sniper: {
        name: 'Sniper', icon: '🔭', type: 'sniper',
        damage: 90, fireRate: 1100, reloadTime: 2400, magSize: 5, totalAmmo: 25,
        spread: 0.003, bulletSpeed: 50, range: 1400, recoil: 6,
        recoilRecovery: 5,
        auto: false, bulletCount: 1, headshotMult: 2.5,
        sound: 'sniper', slot: 3,
        screenShake: 4, hitShake: 5
    },
    laser: {
        name: 'Laser Gun', icon: '⚡', type: 'laser',
        damage: 14, fireRate: 55, reloadTime: 1900, magSize: 40, totalAmmo: 200,
        spread: 0.01, bulletSpeed: 50, range: 750, recoil: 0.15,
        recoilRecovery: 20,
        auto: true, bulletCount: 1, headshotMult: 1.5,
        sound: 'laser', slot: 3, isLaser: true,
        screenShake: 0.2, hitShake: 1.5
    },
    slime: {
        name: 'Slime Blaster', icon: '🟢', type: 'slime',
        damage: 28, fireRate: 480, reloadTime: 1700, magSize: 8, totalAmmo: 48,
        spread: 0.06, bulletSpeed: 16, range: 340, recoil: 1.5,
        recoilRecovery: 8,
        auto: false, bulletCount: 3, headshotMult: 1.3,
        sound: 'slime', slot: 2, isSlime: true, slowEffect: 0.5,
        screenShake: 1.5, hitShake: 2
    },
    rocket: {
        name: 'Rocket Launcher', icon: '🚀', type: 'rocket',
        damage: 70, fireRate: 1500, reloadTime: 3000, magSize: 2, totalAmmo: 10,
        spread: 0.01, bulletSpeed: 14, range: 800, recoil: 5,
        recoilRecovery: 4,
        auto: false, bulletCount: 1, headshotMult: 1.0,
        sound: 'rocket', slot: 4, explosive: true, explosionRadius: 85,
        screenShake: 4, hitShake: 8
    }
};

const MAPS = [
    {
        id: 'arena', name: 'The Arena', icon: '🏟️', size: 'Small',
        width: 40, height: 22, bg: '#1a1a2e',
        platforms: [
            { x: 0, y: 20, w: 40, h: 2, type: 'solid' },
            { x: 0, y: 14, w: 1, h: 6, type: 'solid' },
            { x: 39, y: 14, w: 1, h: 6, type: 'solid' },
            { x: 4, y: 17, w: 8, h: 1, type: 'platform' },
            { x: 28, y: 17, w: 8, h: 1, type: 'platform' },
            { x: 13, y: 14, w: 14, h: 1, type: 'platform' },
            { x: 3, y: 12, w: 7, h: 1, type: 'platform' },
            { x: 30, y: 12, w: 7, h: 1, type: 'platform' },
            { x: 8, y: 9, w: 6, h: 1, type: 'platform' },
            { x: 26, y: 9, w: 6, h: 1, type: 'platform' },
            { x: 16, y: 7, w: 8, h: 1, type: 'platform' },
        ],
        spawns: [
            { x: 3, y: 18 }, { x: 37, y: 18 }, { x: 20, y: 12 },
            { x: 7, y: 15 }, { x: 33, y: 15 }, { x: 20, y: 5 },
            { x: 10, y: 7 }, { x: 30, y: 7 }
        ],
        flags: { red: { x: 5, y: 19 }, blue: { x: 35, y: 19 } }
    },
    {
        id: 'towers', name: 'Twin Towers', icon: '🏗️', size: 'Medium',
        width: 50, height: 25, bg: '#0a1628',
        platforms: [
            { x: 0, y: 23, w: 50, h: 2, type: 'solid' },
            { x: 0, y: 17, w: 1, h: 6, type: 'solid' },
            { x: 49, y: 17, w: 1, h: 6, type: 'solid' },
            { x: 3, y: 7, w: 8, h: 1, type: 'platform' },
            { x: 3, y: 12, w: 8, h: 1, type: 'platform' },
            { x: 3, y: 17, w: 8, h: 1, type: 'platform' },
            { x: 39, y: 7, w: 8, h: 1, type: 'platform' },
            { x: 39, y: 12, w: 8, h: 1, type: 'platform' },
            { x: 39, y: 17, w: 8, h: 1, type: 'platform' },
            { x: 12, y: 11, w: 26, h: 1, type: 'platform' },
            { x: 15, y: 17, w: 8, h: 1, type: 'platform' },
            { x: 27, y: 17, w: 8, h: 1, type: 'platform' },
            { x: 20, y: 20, w: 10, h: 1, type: 'platform' },
            { x: 20, y: 5, w: 10, h: 1, type: 'platform' },
        ],
        spawns: [
            { x: 6, y: 5 }, { x: 43, y: 5 }, { x: 25, y: 9 },
            { x: 6, y: 15 }, { x: 43, y: 15 }, { x: 25, y: 21 },
            { x: 18, y: 15 }, { x: 32, y: 15 }
        ],
        flags: { red: { x: 5, y: 22 }, blue: { x: 44, y: 22 } }
    },
    {
        id: 'warehouse', name: 'Warehouse', icon: '🏭', size: 'Large',
        width: 60, height: 28, bg: '#1a1410',
        platforms: [
            { x: 0, y: 26, w: 60, h: 2, type: 'solid' },
            { x: 0, y: 20, w: 1, h: 6, type: 'solid' },
            { x: 59, y: 20, w: 1, h: 6, type: 'solid' },
            { x: 6, y: 25, w: 3, h: 1, type: 'solid' },
            { x: 51, y: 25, w: 3, h: 1, type: 'solid' },
            { x: 20, y: 25, w: 2, h: 1, type: 'solid' },
            { x: 38, y: 25, w: 2, h: 1, type: 'solid' },
            { x: 10, y: 21, w: 10, h: 1, type: 'platform' },
            { x: 40, y: 21, w: 10, h: 1, type: 'platform' },
            { x: 5, y: 16, w: 12, h: 1, type: 'platform' },
            { x: 43, y: 16, w: 12, h: 1, type: 'platform' },
            { x: 22, y: 17, w: 16, h: 1, type: 'platform' },
            { x: 10, y: 11, w: 10, h: 1, type: 'platform' },
            { x: 40, y: 11, w: 10, h: 1, type: 'platform' },
            { x: 23, y: 10, w: 14, h: 1, type: 'platform' },
            { x: 27, y: 5, w: 6, h: 1, type: 'platform' },
        ],
        spawns: [
            { x: 3, y: 24 }, { x: 57, y: 24 }, { x: 30, y: 8 },
            { x: 8, y: 14 }, { x: 52, y: 14 }, { x: 30, y: 15 },
            { x: 15, y: 24 }, { x: 45, y: 24 }
        ],
        flags: { red: { x: 5, y: 25 }, blue: { x: 55, y: 25 } },
        movingPlatforms: [
            { x: 18, y: 14, w: 5, h: 1, moveX: 0, moveY: 5, speed: 0.008 },
            { x: 37, y: 14, w: 5, h: 1, moveX: 0, moveY: 5, speed: 0.01 },
        ]
    }
];

const PLAYER_SKINS = [
    { id: 'default', name: 'Recruit', icon: '🧑', color: '#4488ff', price: 0 },
    { id: 'red_ninja', name: 'Red Ninja', icon: '🥷', color: '#ff2222', price: 0 },
    { id: 'green_soldier', name: 'Soldier', icon: '💂', color: '#22cc44', price: 100 },
    { id: 'purple_mage', name: 'Mage', icon: '🧙', color: '#9944ff', price: 150 },
    { id: 'gold_elite', name: 'Gold Elite', icon: '👑', color: '#ffcc00', price: 300 },
    { id: 'shadow', name: 'Shadow', icon: '🕶️', color: '#222222', price: 200 },
    { id: 'frost', name: 'Frost', icon: '❄️', color: '#88ccff', price: 250 },
    { id: 'flame', name: 'Inferno', icon: '🔥', color: '#ff4400', price: 250 },
    { id: 'toxic', name: 'Toxic', icon: '☣️', color: '#44ff00', price: 200 },
    { id: 'cyber', name: 'Cyber', icon: '🤖', color: '#00ffcc', price: 350 },
    { id: 'pirate', name: 'Pirate', icon: '🏴‍☠️', color: '#aa6633', price: 300 },
    { id: 'astronaut', name: 'Astronaut', icon: '🧑‍🚀', color: '#cccccc', price: 400 },
    { id: 'vampire', name: 'Vampire', icon: '🧛', color: '#880044', price: 350 },
    { id: 'zombie', name: 'Zombie', icon: '🧟', color: '#668844', price: 300 },
    { id: 'angel', name: 'Angel', icon: '😇', color: '#ffffff', price: 500 },
    { id: 'demon', name: 'Demon', icon: '😈', color: '#ff0044', price: 500 },
    { id: 'alien', name: 'Alien', icon: '👽', color: '#00ff88', price: 400 },
    { id: 'samurai', name: 'Samurai', icon: '⚔️', color: '#cc0000', price: 450 },
    { id: 'detective', name: 'Detective', icon: '🕵️', color: '#556677', price: 250 },
    { id: 'clown', name: 'Clown', icon: '🤡', color: '#ff66cc', price: 200 },
    { id: 'king', name: 'King', icon: '🤴', color: '#ffaa00', price: 600 },
    { id: 'diamond', name: 'Diamond', icon: '💎', color: '#44ddff', price: 800 },
    { id: 'witch', name: 'Witch', icon: '🧙‍♀️', color: '#aa44cc', price: 350 },
    { id: 'chef', name: 'Chef', icon: '👨‍🍳', color: '#ffeecc', price: 200 },
    { id: 'cowboy', name: 'Cowboy', icon: '🤠', color: '#bb8844', price: 300 },
    { id: 'superhero', name: 'Superhero', icon: '🦸', color: '#ff2266', price: 500 },
    { id: 'robot', name: 'Robot', icon: '🤖', color: '#667788', price: 400 },
    { id: 'skeleton', name: 'Skeleton', icon: '💀', color: '#ddddcc', price: 350 },
    { id: 'tiger', name: 'Tiger', icon: '🐯', color: '#ff8800', price: 300 },
    { id: 'dragon_s', name: 'Dragon', icon: '🐉', color: '#cc2200', price: 700 },
    { id: 'elf', name: 'Elf', icon: '🧝', color: '#44bb66', price: 300 },
    { id: 'genie', name: 'Genie', icon: '🧞', color: '#4466ff', price: 450 },
];

const WEAPON_SKINS = [
    { id: 'default_ws', name: 'Standard', icon: '🔫', weaponType: 'all', color: '#888', price: 0 },
    { id: 'golden_gun', name: 'Golden', icon: '✨', weaponType: 'all', color: '#ffcc00', price: 200 },
    { id: 'neon_gun', name: 'Neon', icon: '💜', weaponType: 'all', color: '#cc44ff', price: 250 },
    { id: 'bloody_gun', name: 'Bloody', icon: '🩸', weaponType: 'all', color: '#cc0000', price: 200 },
    { id: 'ice_gun', name: 'Frozen', icon: '🧊', weaponType: 'all', color: '#88ddff', price: 250 },
    { id: 'fire_gun', name: 'Blazing', icon: '🔥', weaponType: 'all', color: '#ff6600', price: 300 },
    { id: 'galaxy_gun', name: 'Galaxy', icon: '🌌', weaponType: 'all', color: '#6644cc', price: 400 },
    { id: 'camo_gun', name: 'Camo', icon: '🌿', weaponType: 'all', color: '#447733', price: 150 },
    { id: 'chrome_gun', name: 'Chrome', icon: '🪞', weaponType: 'all', color: '#cccccc', price: 300 },
    { id: 'pixel_gun', name: 'Pixel', icon: '👾', weaponType: 'all', color: '#44ff44', price: 250 },
    { id: 'dragon_gun', name: 'Dragon', icon: '🐉', weaponType: 'all', color: '#ff2244', price: 500 },
    { id: 'electric_gun', name: 'Electric', icon: '⚡', weaponType: 'all', color: '#ffff00', price: 350 },
    { id: 'shadow_gun', name: 'Shadow', icon: '🌑', weaponType: 'all', color: '#222222', price: 300 },
    { id: 'ocean_gun', name: 'Ocean', icon: '🌊', weaponType: 'all', color: '#0066cc', price: 250 },
    { id: 'rose_gun', name: 'Rose Gold', icon: '🌹', weaponType: 'all', color: '#dd7799', price: 350 },
    { id: 'toxic_gun', name: 'Toxic', icon: '☠️', weaponType: 'all', color: '#88ff00', price: 300 },
    { id: 'diamond_gun', name: 'Diamond', icon: '💎', weaponType: 'all', color: '#44eeff', price: 800 },
    { id: 'lava_gun', name: 'Lava', icon: '🌋', weaponType: 'all', color: '#ff3300', price: 400 },
    { id: 'candy_gun', name: 'Candy', icon: '🍭', weaponType: 'all', color: '#ff66aa', price: 200 },
    { id: 'stealth_gun', name: 'Stealth', icon: '🥷', weaponType: 'all', color: '#333344', price: 350 },
    { id: 'hologram_gun', name: 'Hologram', icon: '🔮', weaponType: 'all', color: '#88ccff', price: 450 },
    { id: 'jungle_gun', name: 'Jungle', icon: '🌴', weaponType: 'all', color: '#228833', price: 250 },
    { id: 'arctic_gun', name: 'Arctic', icon: '🏔️', weaponType: 'all', color: '#cceeFF', price: 300 },
    { id: 'sunset_gun', name: 'Sunset', icon: '🌅', weaponType: 'all', color: '#ff8844', price: 300 },
    { id: 'skull_gun', name: 'Skull', icon: '💀', weaponType: 'all', color: '#aaaaaa', price: 350 },
    { id: 'rainbow_gun', name: 'Rainbow', icon: '🌈', weaponType: 'all', color: '#ff44ff', price: 500 },
];

const EMOTES = [
    { id: 'wave', name: 'Wave', icon: '👋', price: 0 },
    { id: 'thumbsup', name: 'Thumbs Up', icon: '👍', price: 0 },
    { id: 'laugh', name: 'Laugh', icon: '😂', price: 50 },
    { id: 'dance', name: 'Dance', icon: '💃', price: 100 },
    { id: 'flex', name: 'Flex', icon: '💪', price: 100 },
    { id: 'rage', name: 'Rage', icon: '😡', price: 75 },
    { id: 'cry', name: 'Cry', icon: '😭', price: 75 },
    { id: 'cool', name: 'Cool', icon: '😎', price: 100 },
    { id: 'fire', name: 'Fire', icon: '🔥', price: 150 },
    { id: 'skull', name: 'Skull', icon: '💀', price: 150 },
    { id: 'heart', name: 'Heart', icon: '❤️', price: 100 },
    { id: 'crown', name: 'Crown', icon: '👑', price: 200 },
    { id: 'ghost', name: 'Ghost', icon: '👻', price: 100 },
    { id: 'mind_blown', name: 'Mind Blown', icon: '🤯', price: 150 },
    { id: 'thinking', name: 'Thinking', icon: '🤔', price: 50 },
    { id: 'clap', name: 'Clap', icon: '👏', price: 75 },
    { id: 'sleep', name: 'Sleep', icon: '💤', price: 50 },
    { id: 'salute', name: 'Salute', icon: '🫡', price: 100 },
    { id: 'eyes', name: 'Watching', icon: '👀', price: 75 },
    { id: 'rocket', name: 'Rocket', icon: '🚀', price: 200 },
    { id: 'party', name: 'Party', icon: '🎉', price: 150 },
    { id: 'peace', name: 'Peace', icon: '✌️', price: 100 },
    { id: 'devil', name: 'Devil', icon: '😈', price: 200 },
    { id: 'angel_e', name: 'Angel', icon: '😇', price: 200 },
    { id: 'shrug', name: 'Shrug', icon: '🤷', price: 75 },
    { id: 'money', name: 'Money', icon: '🤑', price: 250 },
    { id: 'nerd', name: 'Nerd', icon: '🤓', price: 100 },
    { id: 'poop', name: 'Poop', icon: '💩', price: 150 },
    { id: 'alien_e', name: 'Alien', icon: '👽', price: 200 },
    { id: 'rainbow', name: 'Rainbow', icon: '🌈', price: 250 },
    { id: 'kiss', name: 'Kiss', icon: '😘', price: 100 },
    { id: 'star', name: 'Star', icon: '⭐', price: 150 },
    { id: 'tornado', name: 'Tornado', icon: '🌪️', price: 200 },
    { id: 'lightning', name: 'Lightning', icon: '⚡', price: 175 },
    { id: 'snowflake', name: 'Snowflake', icon: '❄️', price: 125 },
    { id: 'moon', name: 'Moon', icon: '🌙', price: 150 },
    { id: 'sun', name: 'Sun', icon: '☀️', price: 150 },
    { id: 'sword', name: 'Sword', icon: '⚔️', price: 200 },
    { id: 'diamond_e', name: 'Diamond', icon: '💎', price: 300 },
    { id: 'bomb', name: 'Bomb', icon: '💣', price: 175 },
    { id: 'music', name: 'Music', icon: '🎵', price: 100 },
    { id: 'trophy', name: 'Trophy', icon: '🏆', price: 250 },
    { id: 'pig', name: 'Pig', icon: '🐷', price: 100 },
    { id: 'monkey', name: 'Monkey', icon: '🐵', price: 100 },
    { id: 'snake', name: 'Snake', icon: '🐍', price: 150 },
];

const TITLES = [
    { id: 'none', name: 'No Title', icon: '', price: 0 },
    { id: 'newbie', name: 'Newbie', icon: '🌱', price: 0 },
    { id: 'warrior', name: 'Warrior', icon: '⚔️', price: 100 },
    { id: 'sniper_t', name: 'Sharpshooter', icon: '🎯', price: 150 },
    { id: 'legend', name: 'Legend', icon: '⭐', price: 300 },
    { id: 'killer', name: 'Killer', icon: '💀', price: 200 },
    { id: 'champion', name: 'Champion', icon: '🏆', price: 400 },
    { id: 'ghost_t', name: 'Ghost', icon: '👻', price: 200 },
    { id: 'shadow_t', name: 'Shadow', icon: '🌑', price: 200 },
    { id: 'berserker', name: 'Berserker', icon: '🔥', price: 250 },
    { id: 'tactician', name: 'Tactician', icon: '🧠', price: 250 },
    { id: 'hunter', name: 'Hunter', icon: '🏹', price: 200 },
    { id: 'storm', name: 'Storm', icon: '⛈️', price: 300 },
    { id: 'viper', name: 'Viper', icon: '🐍', price: 250 },
    { id: 'phoenix', name: 'Phoenix', icon: '🦅', price: 350 },
    { id: 'reaper', name: 'Reaper', icon: '💀', price: 400 },
    { id: 'titan', name: 'Titan', icon: '🗿', price: 500 },
    { id: 'ace', name: 'Ace', icon: '♠️', price: 300 },
    { id: 'warlord', name: 'Warlord', icon: '🛡️', price: 450 },
    { id: 'nightmare', name: 'Nightmare', icon: '😈', price: 400 },
    { id: 'king_t', name: 'King', icon: '👑', price: 600 },
    { id: 'god', name: 'God', icon: '⚡', price: 1000 },
    { id: 'noob', name: 'Noob', icon: '🐣', price: 50 },
    { id: 'tryhard', name: 'Tryhard', icon: '😤', price: 150 },
    { id: 'bot_t', name: 'Bot', icon: '🤖', price: 100 },
    { id: 'pro_t', name: 'Pro', icon: '💎', price: 500 },
    { id: 'predator', name: 'Predator', icon: '🦁', price: 350 },
    { id: 'assassin', name: 'Assassin', icon: '🗡️', price: 400 },
    { id: 'overlord', name: 'Overlord', icon: '👁️', price: 600 },
    { id: 'savage', name: 'Savage', icon: '🐺', price: 300 },
    { id: 'immortal', name: 'Immortal', icon: '♾️', price: 800 },
    { id: 'mastermind', name: 'Mastermind', icon: '🧠', price: 500 },
    { id: 'commander', name: 'Commander', icon: '🎖️', price: 400 },
    { id: 'destroyer', name: 'Destroyer', icon: '💥', price: 350 },
    { id: 'ninja_t', name: 'Ninja', icon: '🥷', price: 300 },
    { id: 'pirate_t', name: 'Pirate', icon: '☠️', price: 250 },
    { id: 'gladiator', name: 'Gladiator', icon: '🏛️', price: 400 },
    { id: 'mystic_t', name: 'Mystic', icon: '🔮', price: 350 },
    { id: 'outlaw', name: 'Outlaw', icon: '🤠', price: 250 },
    { id: 'demon_t', name: 'Demon', icon: '👹', price: 500 },
    { id: 'fallen', name: 'Fallen', icon: '🪽', price: 450 },
    { id: 'chosen_one', name: 'The Chosen One', icon: '✨', price: 1000 },
];

const ACHIEVEMENTS = [
    { id: 'first_blood', name: 'First Blood', desc: 'Get your first kill', icon: '🩸', reward: 50, check: s => s.totalKills >= 1 },
    { id: 'sharpshooter', name: 'Sharpshooter', desc: 'Get 10 headshots', icon: '🎯', reward: 100 },
    { id: 'rampage', name: 'Rampage', desc: 'Get a 5 kill streak', icon: '🔥', reward: 150 },
    { id: 'collector', name: 'Collector', desc: 'Pick up 20 weapons', icon: '🔫', reward: 75 },
    { id: 'survivor', name: 'Survivor', desc: 'Win a match with under 10 HP', icon: '💪', reward: 200 },
    { id: 'flag_runner', name: 'Flag Runner', desc: 'Capture 5 flags', icon: '🚩', reward: 150 },
    { id: 'sniper_elite', name: 'Sniper Elite', desc: 'Get 15 sniper kills', icon: '🔭', reward: 200 },
    { id: 'unstoppable', name: 'Unstoppable', desc: 'Get a 10 kill streak', icon: '⚡', reward: 300 },
    { id: 'veteran', name: 'Veteran', desc: 'Play 50 matches', icon: '🎖️', reward: 250 },
    { id: 'demolition', name: 'Demolition', desc: 'Get 10 explosive kills', icon: '💥', reward: 150 },
    { id: 'ghost_ach', name: 'Ghost', desc: 'Get 5 kills while invisible', icon: '👻', reward: 200 },
    { id: 'double_kill', name: 'Double Kill', desc: 'Kill 2 enemies within 3 seconds', icon: '💀', reward: 100 },
    { id: 'rich', name: 'Rich', desc: 'Earn 5000 total currency', icon: '💰', reward: 100 },
    { id: 'max_level', name: 'Max Level', desc: 'Reach level 50', icon: '👑', reward: 500 },
    { id: 'perfectionist', name: 'Perfectionist', desc: 'Win a match with 0 deaths', icon: '🏆', reward: 400 },
    { id: 'trigger_happy', name: 'Trigger Happy', desc: 'Fire 10,000 bullets total', icon: '🔫', reward: 150 },
    { id: 'headhunter', name: 'Headhunter', desc: 'Get 50 headshots', icon: '🎯', reward: 300 },
    { id: 'bruiser', name: 'Bruiser', desc: 'Deal 50,000 total damage', icon: '💪', reward: 250 },
    { id: 'ninja_ach', name: 'Ninja', desc: 'Get 20 kills with dash active', icon: '🥷', reward: 200 },
    { id: 'team_player', name: 'Team Player', desc: 'Win 10 TDM matches', icon: '👥', reward: 200 },
    { id: 'shotgun_master', name: 'Shotgun Master', desc: 'Get 25 shotgun kills', icon: '💥', reward: 200 },
    { id: 'laser_tag', name: 'Laser Tag', desc: 'Get 25 laser kills', icon: '⚡', reward: 200 },
    { id: 'slime_time', name: 'Slime Time', desc: 'Get 15 slime kills', icon: '🟢', reward: 150 },
    { id: 'rocket_man', name: 'Rocket Man', desc: 'Get 10 rocket kills', icon: '🚀', reward: 200 },
    { id: 'smg_spray', name: 'SMG Spray', desc: 'Get 30 SMG kills', icon: '🔥', reward: 200 },
    { id: 'pistol_pro', name: 'Pistol Pro', desc: 'Get 20 pistol kills', icon: '🔫', reward: 150 },
    { id: 'assault_ace', name: 'Assault Ace', desc: 'Get 30 assault rifle kills', icon: '🎯', reward: 200 },
    { id: 'marathon', name: 'Marathon', desc: 'Play 100 matches', icon: '🏃', reward: 500 },
    { id: 'godlike', name: 'Godlike', desc: 'Get a 15 kill streak', icon: '⚡', reward: 500 },
    { id: 'jack_of_all', name: 'Jack of All Trades', desc: 'Get a kill with every weapon type', icon: '🃏', reward: 300 },
];

const DAILY_CHALLENGES = [
    { id: 'daily_kills', name: 'Get 15 kills', type: 'kills', target: 15, reward: 75, icon: '💀' },
    { id: 'daily_headshots', name: 'Get 5 headshots', type: 'headshots', target: 5, reward: 100, icon: '🎯' },
    { id: 'daily_wins', name: 'Win 2 matches', type: 'wins', target: 2, reward: 120, icon: '🏆' },
    { id: 'daily_damage', name: 'Deal 2000 damage', type: 'damage', target: 2000, reward: 80, icon: '💥' },
    { id: 'daily_flags', name: 'Capture 2 flags', type: 'flags', target: 2, reward: 100, icon: '🚩' },
    { id: 'daily_sniper', name: 'Get 3 sniper kills', type: 'sniperKills', target: 3, reward: 90, icon: '🔭' },
    { id: 'daily_streak', name: 'Get a 5 kill streak', type: 'streak', target: 5, reward: 150, icon: '🔥' },
    { id: 'daily_play', name: 'Play 3 matches', type: 'matches', target: 3, reward: 60, icon: '🎮' },
    { id: 'daily_shotgun', name: 'Get 5 shotgun kills', type: 'shotgunKills', target: 5, reward: 80, icon: '💥' },
    { id: 'daily_explosive', name: 'Get 3 explosive kills', type: 'explosiveKills', target: 3, reward: 100, icon: '🚀' },
    { id: 'daily_no_death', name: 'Win with 2 or fewer deaths', type: 'lowDeathWin', target: 1, reward: 150, icon: '🛡️' },
    { id: 'daily_collect', name: 'Pick up 5 weapons', type: 'pickups', target: 5, reward: 60, icon: '🔫' },
];

const BOT_NAMES = [
    'Shadow', 'Ghost', 'Viper', 'Phoenix', 'Storm', 'Blade', 'Hawk', 'Wolf',
    'Reaper', 'Cobra', 'Fury', 'Blaze', 'Titan', 'Fang', 'Ace', 'Nova',
    'Raven', 'Frost', 'Dagger', 'Spark', 'Wraith', 'Cipher', 'Onyx', 'Neon',
    'Phantom', 'Raptor', 'Echo', 'Jinx', 'Havoc', 'Zenith', 'Saber', 'Drift',
    'Pyro', 'Glitch', 'Omega', 'Flux', 'Vandal', 'Mystic', 'Torque', 'Apex',
    'Crypt', 'Pulse', 'Bane', 'Striker', 'Jett', 'Ember', 'Knox', 'Riot',
    'Shade', 'Bolt', 'Cinder', 'Hex', 'Mantis', 'Surge', 'Talon', 'Venom',
    'Warden', 'Zephyr', 'Specter', 'Razor', 'Lynx', 'Cannon', 'Dash', 'Grim'
];

const KILL_STREAKS = [
    { kills: 3, name: 'TRIPLE KILL', color: '#ffcc00' },
    { kills: 5, name: 'RAMPAGE', color: '#ff6600' },
    { kills: 7, name: 'DOMINATING', color: '#ff3300' },
    { kills: 10, name: 'UNSTOPPABLE', color: '#ff0066' },
    { kills: 15, name: 'GODLIKE', color: '#cc00ff' },
    { kills: 20, name: 'LEGENDARY', color: '#ff00ff' },
    { kills: 25, name: 'BEYOND GODLIKE', color: '#00ffff' },
];

// Make all arrays available on window for backward compatibility
window.PLAYER_SKINS = PLAYER_SKINS;
window.WEAPON_SKINS = WEAPON_SKINS;
window.EMOTES = EMOTES;
window.TITLES = TITLES;
window.ACHIEVEMENTS = ACHIEVEMENTS;
window.DAILY_CHALLENGES = DAILY_CHALLENGES;
window.BOT_NAMES = BOT_NAMES;
window.KILL_STREAKS = KILL_STREAKS;
window.MAPS = MAPS;
window.WEAPONS = WEAPONS;
window.GAME_WIDTH = GAME_WIDTH;
window.GAME_HEIGHT = GAME_HEIGHT;
window.GRAVITY = GRAVITY;
window.TILE_SIZE = TILE_SIZE;
window.MATCH_DURATION = MATCH_DURATION;
window.RESPAWN_TIME = RESPAWN_TIME;
window.MAX_KILLS_FFA = MAX_KILLS_FFA;
window.MAX_KILLS_TDM = MAX_KILLS_TDM;
window.CTF_CAPTURES_TO_WIN = CTF_CAPTURES_TO_WIN;
window.MOVE_SPREAD_MULT = MOVE_SPREAD_MULT;
window.CROUCH_SPREAD_MULT = CROUCH_SPREAD_MULT;
window.RECOIL_RECOVERY = RECOIL_RECOVERY;
window.KILL_STREAK_TIMEOUT = KILL_STREAK_TIMEOUT;
window.COINS_PER_LEVEL = COINS_PER_LEVEL;
window.XP_PER_LEVEL = XP_PER_LEVEL;
window.DAILY_REWARD_COINS = DAILY_REWARD_COINS;
window.XP_PER_KILL = XP_PER_KILL;
window.XP_PER_WIN = XP_PER_WIN;
window.XP_PER_FLAG = XP_PER_FLAG;
window.XP_PER_HEADSHOT = XP_PER_HEADSHOT;
window.COINS_PER_KILL = COINS_PER_KILL;
window.COINS_PER_WIN = COINS_PER_WIN;
window.ABILITIES = ABILITIES;