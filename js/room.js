// Multiplayer room system (Supabase backend)
// Handles room creation, join, host reassignment, code collision, and anti-abuse

const ROOM_TABLE = 'rooms';

async function generateUniqueRoomCode() {
    let code;
    let exists = true;
    while (exists) {
        code = Math.floor(100000 + Math.random() * 900000).toString();
        const { data, error } = await window.supabaseClient
            .from(ROOM_TABLE)
            .select('code')
            .eq('code', code)
            .maybeSingle();
        exists = !!data;
    }
    return code;
}

async function createRoom(hostName, settings) {
    // Validate hostName
    if (!hostName || typeof hostName !== 'string' || hostName.length < 2 || hostName.length > 16) {
        throw new Error('Invalid host name');
    }
    // Generate unique code
    const code = await generateUniqueRoomCode();
    // Create room in Supabase
    const { data, error } = await window.supabaseClient
        .from(ROOM_TABLE)
        .insert([
            {
                code,
                host: hostName,
                settings,
                players: [hostName],
                created_at: new Date().toISOString(),
                status: 'waiting',
                locked: false,
                private: false
            }
        ]);
    if (error) throw error;
    return code;
}

async function joinRoom(code, playerName) {
    // Validate playerName
    if (!playerName || typeof playerName !== 'string' || playerName.length < 2 || playerName.length > 16) {
        throw new Error('Invalid player name');
    }
    // Check room exists
    const { data: room, error } = await window.supabaseClient
        .from(ROOM_TABLE)
        .select('*')
        .eq('code', code)
        .maybeSingle();
    if (error || !room) throw new Error('Room not found');
    // Check for duplicate name
    if (room.players.includes(playerName)) throw new Error('Name already taken');
    // Check room locked or full
    if (room.locked || room.players.length >= 8) throw new Error('Room is locked or full');
    // Add player
    const { error: updateErr } = await window.supabaseClient
        .from(ROOM_TABLE)
        .update({ players: [...room.players, playerName] })
        .eq('code', code);
    if (updateErr) throw updateErr;
    return true;
}

async function handleHostDisconnect(code) {
    // Get room
    const { data: room, error } = await window.supabaseClient
        .from(ROOM_TABLE)
        .select('*')
        .eq('code', code)
        .maybeSingle();
    if (error || !room) return;
    // If players left, assign new host
    if (room.players.length > 1) {
        const newHost = room.players.find(p => p !== room.host);
        await window.supabaseClient
            .from(ROOM_TABLE)
            .update({ host: newHost })
            .eq('code', code);
    } else {
        // End match, delete room
        await window.supabaseClient
            .from(ROOM_TABLE)
            .delete()
            .eq('code', code);
    }
}

// Export functions
window.RoomSystem = {
    createRoom,
    joinRoom,
    handleHostDisconnect
};
