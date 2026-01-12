import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import GameCanvas from './components/GameCanvas';
import { COUNTRIES } from './constants/countries';

// Connect to backend (using User provided Render URL)
const socket = io('https://superpong.onrender.com', {
    autoConnect: false
});

function App() {
    // Views: 'home', 'lobby', 'game', 'gameover'
    const [view, setView] = useState('home');
    const [roomCode, setRoomCode] = useState('');
    const [joinCode, setJoinCode] = useState('');

    const [playerName, setPlayerName] = useState('');
    const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0].code);
    const [countrySearch, setCountrySearch] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);
    const dropdownRef = useRef(null);

    const [players, setPlayers] = useState([]);
    const [scores, setScores] = useState({ human: 0, ai: 0 });
    const [winner, setWinner] = useState(null);

    // Filter countries
    const filteredCountries = COUNTRIES.filter(c =>
        c.label.toLowerCase().includes(countrySearch.toLowerCase())
    );

    useEffect(() => {
        // Socket Listeners
        socket.on('roomCreated', (code) => {
            setRoomCode(code);
            setView('lobby');
        });

        socket.on('roomJoined', (code) => {
            setRoomCode(code);
            setView('lobby');
        });

        socket.on('playerList', (list) => {
            setPlayers(list);
        });

        socket.on('gameStarted', () => {
            setView('game');
        });

        socket.on('scoreUpdate', (s) => setScores(s));

        socket.on('gameOver', ({ winner }) => {
            setWinner(winner);
            setView('gameover');
        });

        socket.on('error', (msg) => {
            alert(msg);
        });

        // Dropdown Handling
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);

        return () => {
            socket.off('roomCreated');
            socket.off('roomJoined');
            socket.off('playerList');
            socket.off('gameStarted');
            socket.off('scoreUpdate');
            socket.off('gameOver');
            socket.off('error');
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const initiateConnection = () => {
        if (!socket.connected) socket.connect();
    }

    const handleCreate = () => {
        if (!playerName.trim()) return alert("Enter name!");
        initiateConnection();
        const country = selectedCountry ? selectedCountry : '🌍';
        socket.emit('createRoom', { name: playerName, country });
    };

    const handleJoin = () => {
        if (!playerName.trim() || !joinCode.trim()) return alert("Enter name and code!");
        initiateConnection();
        const country = selectedCountry ? selectedCountry : '🌍';
        socket.emit('joinRoom', { code: joinCode, name: playerName, country });
    };

    const handleStartGame = () => {
        socket.emit('startGame');
    };

    const handleCountrySelect = (c) => {
        setSelectedCountry(c.code);
        setCountrySearch(c.label);
        setShowDropdown(false);
    };

    const handleBackToHome = () => {
        window.location.reload(); // Simple reset
    };

    return (
        <div className="app-container" style={{
            minHeight: '100vh',
            width: '100vw',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'black',
            overflow: 'hidden',
            color: 'white',
            fontFamily: 'var(--font-body)'
        }}>

            {/* --- HOME VIEW --- */}
            {view === 'home' && (
                <div className="home-view" style={{ maxWidth: '500px', width: '90%', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <img src="/logo.png" alt="Superpong I/O" style={{ maxWidth: '80%', height: 'auto', margin: '0 auto' }} />
                    <p style={{ opacity: 0.7 }}>Beat the AI. Together.</p>

                    {/* Input Section */}
                    <div className="input-group" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <input
                            type="text"
                            placeholder="Your Name"
                            value={playerName}
                            onChange={(e) => setPlayerName(e.target.value)}
                            style={inputStyle}
                        />

                        {/* Searchable Country Selector */}
                        <div className="country-selector" ref={dropdownRef} style={{ position: 'relative', width: '100%' }}>
                            <div style={{ display: 'flex', alignItems: 'center', background: '#222', border: '1px solid #333', borderRadius: '8px', paddingRight: '10px' }}>
                                <span style={{ fontSize: '1.5rem', paddingLeft: '1rem' }}>{selectedCountry}</span>
                                <input
                                    type="text"
                                    placeholder="Select Country"
                                    value={countrySearch}
                                    onClick={() => setShowDropdown(true)}
                                    onChange={(e) => {
                                        setCountrySearch(e.target.value);
                                        setShowDropdown(true);
                                    }}
                                    style={{ ...inputStyle, background: 'transparent', border: 'none', width: '100%' }}
                                />
                            </div>
                            {showDropdown && (
                                <div className="dropdown" style={dropdownStyle}>
                                    {filteredCountries.map(c => (
                                        <div key={c.label} onClick={() => handleCountrySelect(c)} style={dropdownItemStyle}>
                                            <span>{c.code}</span> <span>{c.label}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                        <button onClick={handleCreate} style={{ ...btnStyle, flex: 1, background: '#4285F4', color: 'white', border: 'none' }}>Create Game</button>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <div style={{ height: '1px', background: '#333', flex: 1 }}></div>
                        <span style={{ opacity: 0.5, fontSize: '0.9rem' }}>OR JOIN</span>
                        <div style={{ height: '1px', background: '#333', flex: 1 }}></div>
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                        <input
                            type="text"
                            placeholder="Enter Code (e.g. ABCD)"
                            value={joinCode}
                            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                            maxLength={4}
                            style={{ ...inputStyle, flex: 1, textAlign: 'center', letterSpacing: '2px', textTransform: 'uppercase' }}
                        />
                        <button onClick={handleJoin} style={{ ...btnStyle, flex: 1 }}>Join -> </button>
                    </div>
                </div>
            )}

            {/* --- LOBBY VIEW --- */}
            {view === 'lobby' && (
                <div className="lobby-view" style={{ textAlign: 'center', maxWidth: '600px', width: '90%' }}>
                    <h2 style={{ opacity: 0.5, marginBottom: '0' }}>ROOM CODE</h2>
                    <h1 style={{ fontSize: '4rem', margin: '0 0 2rem 0', letterSpacing: '5px', color: '#FBBC04' }}>{roomCode}</h1>

                    <div className="player-list-box" style={{ background: '#111', borderRadius: '12px', padding: '20px', marginBottom: '20px', minHeight: '200px' }}>
                        <h3 style={{ borderBottom: '1px solid #333', paddingBottom: '10px', marginTop: 0 }}>Team Human ({players.length})</h3>
                        {players.map(p => (
                            <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px', borderBottom: '1px solid #222' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span style={{ fontSize: '1.5rem' }}>{p.country}</span>
                                    <span style={{ fontWeight: p.id === socket.id ? 'bold' : 'normal' }}>{p.name} {p.id === socket.id && '(You)'}</span>
                                </div>
                                {p.isHost && <span style={{ fontSize: '0.8rem', background: '#333', padding: '2px 6px', borderRadius: '4px' }}>HOST</span>}
                            </div>
                        ))}
                    </div>

                    <p style={{ opacity: 0.6, marginBottom: '20px' }}>Wait for your friends to join using the code above.</p>

                    {/* Only Host can start */}
                    {players.find(p => p.id === socket.id)?.isHost ? (
                        <button onClick={handleStartGame} style={{ ...btnStyle, background: '#34A853', color: 'white', border: 'none', width: '100%', fontSize: '1.5rem' }}>START GAME</button>
                    ) : (
                        <div style={{ padding: '1rem', background: '#222', borderRadius: '8px', opacity: 0.8 }}>Waiting for host to start...</div>
                    )}
                </div>
            )}

            {/* --- GAME VIEW --- */}
            {view === 'game' && (
                <>
                    <div className="header-section" style={{ ...headerStyle, marginBottom: '20px' }}>
                        {/* Scoreboard removed from here? No user said remove from LOBBY. It should be in game. */}
                        <div className="score-board" style={{ display: 'flex', gap: '40px', fontSize: '3rem', fontFamily: 'Rubik Mono One, sans-serif' }}>
                            <span>{scores.human}</span>
                            <span style={{ fontSize: '1rem', opacity: 0.5, fontFamily: 'Outfit, sans-serif' }}>VS</span>
                            <span>{scores.ai}</span>
                        </div>
                    </div>

                    <div className="game-wrapper" style={{ position: 'relative', width: '100%', maxWidth: '900px' }}>
                        <div className="in-game-player-list" style={{ position: 'absolute', left: '-220px', top: '50%', transform: 'translateY(-50%)', textAlign: 'right', color: 'white' }}>
                            <h3 style={{ borderBottom: '1px solid #333', paddingBottom: '5px', color: '#888' }}>Team Human</h3>
                            {players.map(p => (
                                <div key={p.id} style={{ opacity: p.id === socket.id ? 1 : 0.5, padding: '4px 0' }}>
                                    {p.country} {p.name}
                                </div>
                            ))}
                        </div>
                        <GameCanvas socket={socket} />
                    </div>
                </>
            )}

            {/* --- GAME OVER VIEW --- */}
            {view === 'gameover' && (
                <div className="game-over-view" style={{ textAlign: 'center' }}>
                    <h1 style={{ fontSize: '4rem', marginBottom: '1rem' }}>
                        {winner === 'human' ? 'VICTORY! 🏆' : 'DEFEAT 💀'}
                    </h1>
                    <p style={{ fontSize: '1.5rem', opacity: 0.8 }}>
                        {winner === 'human' ? 'You defeated the AI!' : 'The machine prevails...'}
                    </p>
                    <div style={{ fontSize: '3rem', fontFamily: 'Rubik Mono One, sans-serif', margin: '2rem 0' }}>
                        {scores.human} - {scores.ai}
                    </div>
                    <button onClick={handleBackToHome} style={btnStyle}>Play Again</button>
                </div>
            )}

        </div>
    );
}

// --- Styles ---
const headerStyle = {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px'
};

const inputStyle = {
    padding: '1rem',
    fontSize: '1rem',
    borderRadius: '8px',
    border: '1px solid #333',
    background: '#222',
    color: 'white',
    fontFamily: 'var(--font-body)',
    outline: 'none',
    boxSizing: 'border-box'
};

const btnStyle = {
    padding: '1rem 2rem',
    borderRadius: '8px',
    border: '1px solid white',
    background: 'transparent',
    color: 'white',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontFamily: 'var(--font-body)',
    transition: 'all 0.2s'
};

const dropdownStyle = {
    position: 'absolute',
    top: '110%',
    left: 0,
    width: '100%',
    maxHeight: '200px',
    overflowY: 'auto',
    background: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: '8px',
    zIndex: 100,
    textAlign: 'left'
};

const dropdownItemStyle = {
    padding: '10px 15px',
    cursor: 'pointer',
    borderBottom: '1px solid #222',
    color: '#eee'
};

export default App;
