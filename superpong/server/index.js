import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*", // Allow all for prototype
        methods: ["GET", "POST"]
    }
});

// Game Constants
const PADDLE_WIDTH = 24;
const PADDLE_HEIGHT = 120;
const BALL_SIZE = 16;
const BALL_SPEED_BASE = 8;
const CANVAS_WIDTH = 900;  // Matching shrunk prototype
const CANVAS_HEIGHT = 600;

// Game State
let gameState = {
    players: {}, // socketId -> { id, name, y, team: 'human' }
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
    status: 'waiting', // waiting, playing
    trail: [] // We can compute trail on client, but maybe verify hits here
};

// Reset Ball
function resetBall(direction) {
    gameState.ball.x = CANVAS_WIDTH / 2;
    gameState.ball.y = CANVAS_HEIGHT / 2;
    gameState.ball.vx = BALL_SPEED_BASE * direction;
    gameState.ball.vy = (Math.random() - 0.5) * 6;
}

// Physics Loop (60 TPS)
setInterval(() => {
    // Update Ball
    gameState.ball.x += gameState.ball.vx;
    gameState.ball.y += gameState.ball.vy;

    // Wall Collisions
    if (gameState.ball.y <= 0 || gameState.ball.y + BALL_SIZE >= CANVAS_HEIGHT) {
        gameState.ball.vy *= -1;
    }

    // Paddle Collisions

    // 1. Human (Left Side) - Check collision with ANY human paddle
    // In a real coop, maybe we average their input? 
    // For now, let's say the "Team Human" paddle is effectively an aggregate or we check individual rects.
    // Actually, to make it fun, let's treat every player as a physical entity on the left context.
    // BUT the prototype usage implies moving "Team Human" collectively or individually?
    // User said "multiple human players... cooperating". 
    // Let's iterate all human players and check collision.

    let paddleHit = false;
    Object.values(gameState.players).forEach(p => {
        // Determine player x position (maybe they form a wall?)
        // For simplicity V1: All humans are on the same X line (Left)
        if (gameState.ball.x <= 40 + PADDLE_WIDTH &&
            gameState.ball.x >= 40 &&
            gameState.ball.y + BALL_SIZE >= p.y &&
            gameState.ball.y <= p.y + PADDLE_HEIGHT &&
            gameState.ball.vx < 0) {
            paddleHit = true;
            // Calculate hit relative to this specific paddle
            const hitPos = (gameState.ball.y - p.y) / PADDLE_HEIGHT;
            gameState.ball.vy += (hitPos - 0.5) * 10;
        }
    });

    if (paddleHit) {
        gameState.ball.vx *= -1.05;
    }

    // 2. AI (Right Side)
    if (gameState.ball.x >= CANVAS_WIDTH - 40 - PADDLE_WIDTH - BALL_SIZE &&
        gameState.ball.y + BALL_SIZE >= gameState.ai.y &&
        gameState.ball.y <= gameState.ai.y + PADDLE_HEIGHT &&
        gameState.ball.vx > 0) {
        gameState.ball.vx *= -1.15; // Aggressive speed up
        const hitPos = (gameState.ball.y - gameState.ai.y) / PADDLE_HEIGHT;
        gameState.ball.vy += (hitPos - 0.5) * 12; // Aggressive spin
    }

    // Scoring
    if (gameState.ball.x < -20) {
        gameState.ai.score++;
        resetBall(1);
        io.emit('scoreUpdate', { human: gameState.teamHuman.score, ai: gameState.ai.score });
    } else if (gameState.ball.x > CANVAS_WIDTH + 20) {
        gameState.teamHuman.score++;
        resetBall(-1);
        io.emit('scoreUpdate', { human: gameState.teamHuman.score, ai: gameState.ai.score });
    }

    // AI Logic (Superplayer)
    const targetY = gameState.ball.y - PADDLE_HEIGHT / 2;
    if (gameState.ball.vx > 0) {
        gameState.ai.y += (targetY - gameState.ai.y) * 0.25; // Super reflexes
    } else {
        gameState.ai.y += ((CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2) - gameState.ai.y) * 0.05;
    }

    // Clamp AI
    gameState.ai.y = Math.max(0, Math.min(CANVAS_HEIGHT - PADDLE_HEIGHT, gameState.ai.y));

    // Broadcast State (Volatile to drop packets if lagging)
    io.volatile.emit('gameState', {
        ball: gameState.ball,
        ai: gameState.ai,
        players: gameState.players
    });

}, 1000 / 60);

io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);

    // Default Entry
    gameState.players[socket.id] = {
        id: socket.id,
        name: `Player ${Object.keys(gameState.players).length + 1}`,
        y: CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2,
        team: 'human'
    };

    io.emit('playerList', Object.values(gameState.players));

    socket.on('input', (data) => {
        // Data expected: { y: number } (Mouse Y relative to canvas)
        if (gameState.players[socket.id]) {
            let newY = data.y;
            // Clamp
            newY = Math.max(0, Math.min(CANVAS_HEIGHT - PADDLE_HEIGHT, newY));
            gameState.players[socket.id].y = newY;
        }
    });

    socket.on('join', (data) => {
        if (gameState.players[socket.id]) {
            gameState.players[socket.id].name = data.name;
            gameState.players[socket.id].country = data.country;
            io.emit('playerList', Object.values(gameState.players));
        }
    });

    socket.on('disconnect', () => {
        delete gameState.players[socket.id];
        io.emit('playerList', Object.values(gameState.players));
        console.log('Player disconnected:', socket.id);
    });
});

const PORT = 3000;
httpServer.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
