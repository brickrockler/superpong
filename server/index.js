import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// --- Game Constants ---
const PADDLE_WIDTH = 24;
const PADDLE_HEIGHT = 120;
const BALL_SIZE = 16;
const BALL_SPEED_BASE = 8;
const CANVAS_WIDTH = 900;
const CANVAS_HEIGHT = 600;
const WIN_SCORE = 21;

// --- State Management ---
// rooms = { [roomCode]: { gameState, status: 'lobby'|'playing'|'finished', hostId } }
const rooms = {};

function generateRoomCode() {
    return Math.random().toString(36).substring(2, 6).toUpperCase();
}

function createInitialState() {
    return {
        players: {}, // socketId -> { id, name, country, y, team: 'human' }
        ball: {
            x: CANVAS_WIDTH / 2,
            y: CANVAS_HEIGHT / 2,
            vx: BALL_SPEED_BASE,
            vy: 0
        },
        ai: {
            y: CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2,
            score: 0
        },
        teamHuman: {
            score: 0
        },
        winner: null // 'human' or 'ai'
    };
}

// --- Physics Engine ---
function updateRoomPhysics(roomCode) {
    const room = rooms[roomCode];
    if (!room || room.status !== 'playing') return;

    const state = room.gameState;

    // 1. Move Ball
    state.ball.x += state.ball.vx;
    state.ball.y += state.ball.vy;

    // 2. Wall Bounce (Top/Bottom)
    if (state.ball.y <= 0 || state.ball.y + BALL_SIZE >= CANVAS_HEIGHT) {
        state.ball.vy *= -1;
    }

    // 3. Paddle Collisions
    // Human Team (Left Check)
    let humanHit = false;
    Object.values(state.players).forEach(p => {
        // Simple collision box for each player
        if (state.ball.x <= 40 + PADDLE_WIDTH &&
            state.ball.x >= 40 &&
            state.ball.y + BALL_SIZE >= p.y &&
            state.ball.y <= p.y + PADDLE_HEIGHT &&
            state.ball.vx < 0) {

            humanHit = true;
            // Spin
            const hitPos = (state.ball.y - p.y) / PADDLE_HEIGHT;
            state.ball.vy += (hitPos - 0.5) * 10;
        }
    });

    if (humanHit) {
        state.ball.vx *= -1.05; // Speed up
        // Clamp speed
        state.ball.vx = Math.max(-25, Math.min(25, state.ball.vx));
    }

    // AI (Right Check)
    if (state.ball.x >= CANVAS_WIDTH - 40 - PADDLE_WIDTH - BALL_SIZE &&
        state.ball.y + BALL_SIZE >= state.ai.y &&
        state.ball.y <= state.ai.y + PADDLE_HEIGHT &&
        state.ball.vx > 0) {

        state.ball.vx *= -1.15; // Aggressive AI Speed
        state.ball.vx = Math.max(-25, Math.min(25, state.ball.vx));

        const hitPos = (state.ball.y - state.ai.y) / PADDLE_HEIGHT;
        state.ball.vy += (hitPos - 0.5) * 12; // Aggressive AI Spin
    }

    // 4. Scoring
    if (state.ball.x < -50) {
        // AI Scored
        state.ai.score++;
        checkWin(roomCode);
        resetBall(state, 1);
        io.to(roomCode).emit('scoreUpdate', { human: state.teamHuman.score, ai: state.ai.score });
    } else if (state.ball.x > CANVAS_WIDTH + 50) {
        // Human Scored
        state.teamHuman.score++;
        checkWin(roomCode);
        resetBall(state, -1);
        io.to(roomCode).emit('scoreUpdate', { human: state.teamHuman.score, ai: state.ai.score });
    }

    // 5. AI Movement
    const targetY = state.ball.y - PADDLE_HEIGHT / 2;
    // AI moves faster if ball is coming towards it
    const difficulty = state.ball.vx > 0 ? 0.25 : 0.05;
    state.ai.y += (targetY - state.ai.y) * difficulty;
    // Clamp AI
    state.ai.y = Math.max(0, Math.min(CANVAS_HEIGHT - PADDLE_HEIGHT, state.ai.y));

    // 6. Broadcast (Volatile to prevent lag buildup)
    io.to(roomCode).volatile.emit('gameState', {
        ball: state.ball,
        ai: state.ai,
        players: state.players
    });
}

function resetBall(state, direction) {
    state.ball.x = CANVAS_WIDTH / 2;
    state.ball.y = CANVAS_HEIGHT / 2;
    state.ball.vx = BALL_SPEED_BASE * direction;
    state.ball.vy = (Math.random() - 0.5) * 6;
}

function checkWin(roomCode) {
    const room = rooms[roomCode];
    const state = room.gameState;

    if (state.teamHuman.score >= WIN_SCORE) {
        room.status = 'finished';
        state.winner = 'human';
        io.to(roomCode).emit('gameOver', { winner: 'human' });
    } else if (state.ai.score >= WIN_SCORE) {
        room.status = 'finished';
        state.winner = 'ai';
        io.to(roomCode).emit('gameOver', { winner: 'ai' });
    }
}

// --- Global Tick Loop ---
setInterval(() => {
    Object.keys(rooms).forEach(code => {
        updateRoomPhysics(code);
    });
}, 1000 / 60);

// --- Socket Handlers ---
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    let currentRoom = null;

    // 1. Create Room
    socket.on('createRoom', ({ name, country }) => {
        const code = generateRoomCode();
        rooms[code] = {
            gameState: createInitialState(),
            status: 'lobby',
            hostId: socket.id
        };

        socket.join(code);
        currentRoom = code;

        // Add Host Player
        rooms[code].gameState.players[socket.id] = {
            id: socket.id,
            name,
            country,
            y: CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2,
            isHost: true
        };

        socket.emit('roomCreated', code);
        io.to(code).emit('playerList', Object.values(rooms[code].gameState.players));
    });

    // 2. Join Room
    socket.on('joinRoom', ({ code, name, country }) => {
        const room = rooms[code.toUpperCase()];
        if (room && room.status === 'lobby') {
            socket.join(code.toUpperCase());
            currentRoom = code.toUpperCase();

            // Add Player
            room.gameState.players[socket.id] = {
                id: socket.id,
                name,
                country,
                y: CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2,
                isHost: false
            };

            socket.emit('roomJoined', currentRoom);
            io.to(currentRoom).emit('playerList', Object.values(room.gameState.players));
        } else {
            socket.emit('error', 'Room not found or game already started');
        }
    });

    // 3. Start Game
    socket.on('startGame', () => {
        if (currentRoom && rooms[currentRoom].hostId === socket.id) {
            rooms[currentRoom].status = 'playing';
            io.to(currentRoom).emit('gameStarted');
        }
    });

    // 4. Input Handling
    socket.on('input', (data) => {
        if (currentRoom && rooms[currentRoom] && rooms[currentRoom].status === 'playing') {
            const player = rooms[currentRoom].gameState.players[socket.id];
            if (player) {
                player.y = Math.max(0, Math.min(CANVAS_HEIGHT - PADDLE_HEIGHT, data.y));
            }
        }
    });

    // 5. Disconnect
    socket.on('disconnect', () => {
        if (currentRoom && rooms[currentRoom]) {
            const room = rooms[currentRoom];
            delete room.gameState.players[socket.id];

            // If empty, delete room
            if (Object.keys(room.gameState.players).length === 0) {
                delete rooms[currentRoom];
            } else {
                // If host left, assign new host? For now, just remove player.
                io.to(currentRoom).emit('playerList', Object.values(room.gameState.players));
            }
        }
    });
});

const PORT = 3000;
httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
