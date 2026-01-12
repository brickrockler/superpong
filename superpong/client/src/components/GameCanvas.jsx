import React, { useRef, useEffect } from 'react';
import { io } from 'socket.io-client';

const PADDLE_HEIGHT = 120;
const PADDLE_WIDTH = 24;
const BALL_SIZE = 16;
const GAME_WIDTH = 900;
const GAME_HEIGHT = 600;

export default function GameCanvas({ socket }) {
    const canvasRef = useRef(null);

    // Local state for smoothing
    const gameState = useRef({
        ball: { x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2 },
        ai: { y: GAME_HEIGHT / 2, score: 0 },
        players: {},
        teamHuman: { score: 0 }
    });

    useEffect(() => {
        // Input Loop
        const handleMouseMove = (e) => {
            if (!canvasRef.current) return;
            const rect = canvasRef.current.getBoundingClientRect();
            // Calculate scale if canvas is resized via CSS
            const scaleY = GAME_HEIGHT / rect.height;
            const y = (e.clientY - rect.top) * scaleY - PADDLE_HEIGHT / 2;
            socket.emit('input', { y });
        };

        window.addEventListener('mousemove', handleMouseMove);

        // Socket Listeners
        socket.on('gameState', (serverState) => {
            // Direct apply for prototype (interpolation is task #19)
            gameState.current = { ...gameState.current, ...serverState };
        });

        socket.on('scoreUpdate', (scores) => {
            gameState.current.teamHuman.score = scores.human;
            gameState.current.ai.score = scores.ai;
        });

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            socket.off('gameState');
            socket.off('scoreUpdate');
        };
    }, [socket]);

    // Render Loop
    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        let animationFrameId;

        const render = () => {
            // Clear
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

            // Net
            ctx.strokeStyle = '#222';
            ctx.lineWidth = 2;
            ctx.setLineDash([20, 20]);
            ctx.beginPath();
            ctx.moveTo(GAME_WIDTH / 2, 0);
            ctx.lineTo(GAME_WIDTH / 2, GAME_HEIGHT);
            ctx.stroke();

            const state = gameState.current;

            // Draw Players (Gradient Paddles)
            const drawPaddle = (x, y) => {
                const grad = ctx.createLinearGradient(x, y, x, y + PADDLE_HEIGHT);
                grad.addColorStop(0, '#34A853');
                grad.addColorStop(0.3, '#4285F4');
                grad.addColorStop(0.7, '#FBBC04');
                grad.addColorStop(1, '#EA4335');
                ctx.fillStyle = grad;
                ctx.shadowBlur = 15;
                ctx.shadowColor = '#4285F4';
                ctx.beginPath();
                ctx.roundRect(x, y, PADDLE_WIDTH, PADDLE_HEIGHT, 8);
                ctx.fill();
                ctx.shadowBlur = 0;
            };

            // Draw all human players (maybe semi-transparent for others?)
            if (state.players) {
                Object.values(state.players).forEach(p => {
                    // If purely coop, maybe we only draw "THE" paddle?
                    // Or we draw ghost paddles for teammates?
                    // Let's draw everyone for chaos fun
                    const isMe = p.id === socket.id;
                    ctx.globalAlpha = isMe ? 1 : 0.4;
                    drawPaddle(40, p.y);
                });
                ctx.globalAlpha = 1;
            }

            // Draw AI
            drawPaddle(GAME_WIDTH - 40 - PADDLE_WIDTH, state.ai.y);

            // Draw Ball
            ctx.fillStyle = '#ffffff';
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#ffffff';
            ctx.beginPath();
            ctx.arc(state.ball.x + BALL_SIZE / 2, state.ball.y + BALL_SIZE / 2, BALL_SIZE / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;

            // Draw HUD (Score) - Overlay on Canvas or keep separate? 
            // User wanted it OUTSIDE, so we'll pass score up or App handles it.
            // But for internal consistency let's rely on parent passing score props if needed,
            // or just focus on game drawing here.

            animationFrameId = requestAnimationFrame(render);
        };

        render();
        return () => cancelAnimationFrame(animationFrameId);
    }, [socket]);

    return (
        <canvas
            ref={canvasRef}
            width={GAME_WIDTH}
            height={GAME_HEIGHT}
            style={{
                width: '100%',
                maxWidth: '900px',
                aspectRatio: '3/2',
                display: 'block'
            }}
        />
    );
}
