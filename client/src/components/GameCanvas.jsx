import React, { useRef, useEffect } from 'react';

// Linear interpolation helper
const lerp = (start, end, factor) => {
    return start + (end - start) * factor;
};

const GameCanvas = ({ socket }) => {
    const canvasRef = useRef(null);

    // State refs for animation loop
    const gameStateRef = useRef(null); // The latest server state
    const visualStateRef = useRef(null); // What we are currently drawing

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        let animationFrameId;

        // Game Constants
        const PADDLE_WIDTH = 24;
        const PADDLE_HEIGHT = 120; // 120
        const GAME_WIDTH = 900;
        const GAME_HEIGHT = 600;

        // Socket Listener
        const onGameState = (serverState) => {
            gameStateRef.current = serverState;

            // Initialize visual state if first packet
            if (!visualStateRef.current) {
                visualStateRef.current = JSON.parse(JSON.stringify(serverState));
            }
        };

        socket.on('gameState', onGameState);

        // Render Loop
        const render = () => {
            // 1. Clear
            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'; // Trail effect
            ctx.fillRect(0, 0, canvas.width, canvas.height); // Using canvas dims

            // Safety check
            if (gameStateRef.current && visualStateRef.current) {
                const target = gameStateRef.current;
                const current = visualStateRef.current;

                // Interpolate Ball (Smoothing factor 0.2 creates a slide effect)
                current.ball.x = lerp(current.ball.x, target.ball.x, 0.2);
                current.ball.y = lerp(current.ball.y, target.ball.y, 0.2);

                // Interpolate AI Paddle
                current.ai.y = lerp(current.ai.y, target.ai.y, 0.1);

                // Players don't need much lerp since input is local-ish, but let's do it for others
                // We might lag behind real position slightly, but it looks good.

                // --- DRAWING ---

                // Draw Ball
                ctx.beginPath();
                // Basic Neon Glow for ball
                ctx.arc(current.ball.x, current.ball.y, 8, 0, Math.PI * 2);
                ctx.fillStyle = '#ffffff';
                ctx.shadowBlur = 10;
                ctx.shadowColor = '#ffffff';
                ctx.fill();
                ctx.shadowBlur = 0;

                // Draw Human Paddles
                if (target.players) {
                    const myId = socket.id;
                    Object.values(target.players).forEach(p => {
                        const isMe = p.id === myId;

                        // Draw Paddle Rect
                        const x = 40;
                        // Note: We use the immediate target for paddle Y to fix input lag feeling
                        // But for others we could lerp. For simplicity, just render target Y.
                        const y = p.y;

                        if (isMe) {
                            const grad = ctx.createLinearGradient(x, y, x, y + PADDLE_HEIGHT);
                            grad.addColorStop(0, '#34A853');
                            grad.addColorStop(0.3, '#4285F4');
                            grad.addColorStop(0.7, '#FBBC04');
                            grad.addColorStop(1, '#EA4335');
                            ctx.fillStyle = grad;
                            ctx.shadowBlur = 15;
                            ctx.shadowColor = '#4285F4';
                        } else {
                            ctx.fillStyle = '#444'; // Dark Gray for teammates
                            ctx.shadowBlur = 0;
                        }

                        ctx.beginPath();
                        ctx.roundRect(x, y, PADDLE_WIDTH, PADDLE_HEIGHT, 8);
                        ctx.fill();
                        ctx.shadowBlur = 0;
                    });
                }

                // Draw AI Paddle
                const aiX = GAME_WIDTH - 40 - PADDLE_WIDTH;
                const aiY = current.ai.y;
                const grad = ctx.createLinearGradient(aiX, aiY, aiX, aiY + PADDLE_HEIGHT);
                grad.addColorStop(0, '#34A853');
                grad.addColorStop(0.3, '#4285F4');
                grad.addColorStop(0.7, '#FBBC04');
                grad.addColorStop(1, '#EA4335');
                ctx.fillStyle = grad;
                ctx.shadowBlur = 15;
                ctx.shadowColor = '#EA4335';
                ctx.beginPath();
                ctx.roundRect(aiX, aiY, PADDLE_WIDTH, PADDLE_HEIGHT, 8);
                ctx.fill();
                ctx.shadowBlur = 0;

            }

            animationFrameId = requestAnimationFrame(render);
        };

        // Start Loop
        render();

        // Input Handling
        const handleMouseMove = (e) => {
            const rect = canvas.getBoundingClientRect();
            const scaleY = 600 / rect.height; // Logical height / visual height
            const y = (e.clientY - rect.top) * scaleY - (120 / 2); // Center paddle
            socket.emit('input', { y });
        };

        canvas.addEventListener('mousemove', handleMouseMove);

        return () => {
            socket.off('gameState', onGameState);
            canvas.removeEventListener('mousemove', handleMouseMove);
            cancelAnimationFrame(animationFrameId);
        };
    }, [socket]);

    return (
        <div className="game-container">
            <canvas
                ref={canvasRef}
                width={900}
                height={600}
                style={{
                    width: '100%',
                    maxWidth: '900px',
                    aspectRatio: '3/2',
                    borderRadius: '4px',
                    cursor: 'none' // Hide cursor during game
                }}
            />
        </div>
    );
};

export default GameCanvas;
