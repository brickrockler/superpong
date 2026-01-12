import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import GameCanvas from './components/GameCanvas';
import { COUNTRIES } from './constants/countries';

// Connect to backend (assumed localhost:3000 for dev)
const socket = io('http://localhost:3000', {
    autoConnect: false
});

function App() {
    const [inGame, setInGame] = useState(false);
    const [playerName, setPlayerName] = useState('');
    const [countrySearch, setCountrySearch] = useState('');
    const [selectedCountry, setSelectedCountry] = useState(null); // {code, label}
    const [showDropdown, setShowDropdown] = useState(false);
    const [scores, setScores] = useState({ human: 0, ai: 0 });
    const [playerCount, setPlayerCount] = useState(0);
    const [players, setPlayers] = useState([]);

    const dropdownRef = useRef(null);

    // Filter countries
    const filteredCountries = COUNTRIES.filter(c =>
        c.label.toLowerCase().includes(countrySearch.toLowerCase())
    );

    useEffect(() => {
        // Global socket listeners
        socket.on('scoreUpdate', (s) => setScores(s));

        // We should listen for player list to update count
        socket.on('playerList', (list) => {
            setPlayerCount(list.length);
            setPlayers(list);
        });

        // Click outside to close dropdown
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);

        return () => {
            socket.off('scoreUpdate');
            socket.off('playerList');
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const handleJoin = () => {
        if (!playerName.trim()) return;
        socket.connect();
        // Default to World if none selected
        const countryCode = selectedCountry ? selectedCountry.code : '🌍';
        socket.emit('join', { name: playerName, country: countryCode });
        setInGame(true);
    };

    const handleCountrySelect = (c) => {
        setSelectedCountry(c);
        setCountrySearch(c.label);
        setShowDropdown(false);
    };

    return (
        <div className="app-container" style={{
            minHeight: '100vh',
            width: '100vw',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center', // True Centering
            background: 'black',
            overflow: 'hidden'
        }}>
            {!inGame ? (
                <div className="lobby" style={{
                    width: '100%',
                    maxWidth: '600px',
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '2rem',
                    padding: '20px'
                }}>
                    {/* New Logo */}
                    <img src="/logo.png" alt="Superpong I/O" style={{ maxWidth: '80%', height: 'auto' }} />

                    <div style={{ fontFamily: 'var(--font-body)', fontSize: '1.25rem', lineHeight: '1.6', color: '#ccc', maxWidth: '480px' }}>
                        <p style={{ marginBottom: '1rem', opacity: 0.8 }}>15 years ago, Deepmind trained an AI to play pong.</p>
                        <p style={{ fontWeight: '700', color: 'white' }}>Today, we join forces to try and beat that AI at its own game.</p>
                    </div>

                    <div className="input-group" style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '15px',
                        width: '100%',
                        maxWidth: '320px'
                    }}>

                        {/* 1. Name Input */}
                        <input
                            type="text"
                            placeholder="Enter Your Name"
                            value={playerName}
                            onChange={(e) => setPlayerName(e.target.value)}
                            style={{
                                padding: '1rem',
                                fontSize: '1.1rem',
                                borderRadius: '8px',
                                border: '1px solid #333',
                                background: '#111',
                                color: 'white',
                                textAlign: 'left',
                                fontFamily: 'var(--font-body)',
                                width: '100%',
                                boxSizing: 'border-box'
                            }}
                        />

                        {/* 2. Country Searchable Dropdown */}
                        <div className="country-selector" ref={dropdownRef} style={{ position: 'relative', width: '100%' }}>
                            <div style={{ display: 'flex', alignItems: 'center', background: '#111', border: '1px solid #333', borderRadius: '8px', paddingRight: '10px' }}>
                                {/* Flag Preview inside input */}
                                {selectedCountry && <span style={{ fontSize: '1.5rem', paddingLeft: '1rem' }}>{selectedCountry.code}</span>}
                                <input
                                    type="text"
                                    placeholder="Select Country"
                                    value={countrySearch}
                                    onClick={() => setShowDropdown(true)}
                                    onChange={(e) => {
                                        setCountrySearch(e.target.value);
                                        setShowDropdown(true);
                                        if (e.target.value === '') setSelectedCountry(null);
                                    }}
                                    style={{
                                        padding: '1rem',
                                        fontSize: '1.1rem',
                                        border: 'none',
                                        background: 'transparent',
                                        color: 'white',
                                        width: '100%',
                                        fontFamily: 'var(--font-body)',
                                        outline: 'none'
                                    }}
                                />
                                <span style={{ opacity: 0.5, cursor: 'pointer', fontSize: '0.8rem' }} onClick={() => setShowDropdown(!showDropdown)}>▼</span>
                            </div>

                            {showDropdown && (
                                <div className="dropdown-list" style={{
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
                                }}>
                                    {filteredCountries.map(c => (
                                        <div
                                            key={c.label}
                                            onClick={() => handleCountrySelect(c)}
                                            style={{
                                                padding: '10px 15px',
                                                cursor: 'pointer',
                                                borderBottom: '1px solid #222',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '10px',
                                                color: '#eee',
                                                fontFamily: 'var(--font-body)'
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.background = '#333'}
                                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                        >
                                            <span style={{ fontSize: '1.2rem' }}>{c.code}</span>
                                            <span>{c.label}</span>
                                        </div>
                                    ))}
                                    {filteredCountries.length === 0 && (
                                        <div style={{ padding: '10px', color: '#666' }}>No country found</div>
                                    )}
                                </div>
                            )}
                        </div>

                        <button
                            onClick={handleJoin}
                            style={{
                                marginTop: '0.5rem',
                                width: '100%',
                                padding: '1rem',
                                fontSize: '1.1rem',
                                background: 'white',
                                color: 'black',
                                border: 'none',
                                borderRadius: '2rem',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                fontFamily: 'var(--font-body)'
                            }}
                        >
                            Start Playing
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    {/* Game Header with Scoreboard (Only in Game) */}
                    <div className="header-section" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                        <img src="/logo.png" alt="logo" style={{ height: '40px' }} />
                        <div className="score-board" style={{ display: 'flex', gap: '40px', fontSize: '3rem', fontFamily: 'Rubik Mono One, sans-serif' }}>
                            <span>{scores.human}</span>
                            <span style={{ fontSize: '1rem', opacity: 0.5, fontFamily: 'Outfit, sans-serif' }}>VS</span>
                            <span>{scores.ai}</span>
                        </div>
                    </div>

                    <div className="game-wrapper" style={{ position: 'relative', width: '100%', maxWidth: '900px' }}>
                        <div className="player-list" style={{ position: 'absolute', left: '-220px', top: '50%', transform: 'translateY(-50%)', textAlign: 'right', color: 'white' }}>
                            <h3 style={{ borderBottom: '1px solid #333', paddingBottom: '5px', color: '#888' }}>Team Human</h3>
                            {/* My Player */}
                            <div style={{ color: '#4285F4', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                                <span>You</span>
                                <span style={{ fontSize: '1.2rem' }}>{selectedCountry ? selectedCountry.code : (players.find(p => p.id === socket.id)?.country || '🌍')}</span>
                            </div>

                            {/* Other Players */}
                            {players.filter(p => p.id !== socket.id).map(p => (
                                <div key={p.id} style={{ opacity: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                                    <span>{p.name}</span>
                                    <span style={{ fontSize: '1.2rem' }}>{p.country || '🌍'}</span>
                                </div>
                            ))}
                        </div>

                        <GameCanvas socket={socket} />

                        <div className="controls-hint" style={{ textAlign: 'center', marginTop: '10px', color: '#666' }}>Mouse Control Active</div>
                    </div>
                </>
            )}
        </div>
    );
}

export default App;
