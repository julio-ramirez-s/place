import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import { Heart, Home, Moon, Sun, Utensils, Tv, Cat, Dog, Gift } from 'lucide-react';
import './App.css';

// IMPORTANTE: Cuando despliegues en Render, debes cambiar 'http://localhost:3001' 
// por la URL de tu servicio de backend (server.js) desplegado.
const SERVER_URL = process.env.NODE_ENV === 'production' 
  ? 'https://place-server.onrender.com' // Reemplaza esto con la URL real de tu servidor
  : 'https://place-server.onrender.com';

const socket = io(SERVER_URL);

// Configuración de las habitaciones
const ROOMS = [
  { id: 'bedroom', name: 'Dormitorio', icon: <Moon size={24} />, color: 'var(--color-bedroom)' },
  { id: 'kitchen', name: 'Cocina', icon: <Utensils size={24} />, color: 'var(--color-kitchen)' },
  { id: 'living', name: 'Sala', icon: <Tv size={24} />, color: 'var(--color-living)' },
  { id: 'garden', name: 'Jardín', icon: <Sun size={24} />, color: 'var(--color-garden)' },
];

function App() {
  const [hasJoined, setHasJoined] = useState(false);
  const [gameState, setGameState] = useState(null);
  const [myName, setMyName] = useState('');
  const [notification, setNotification] = useState('');

  // --- EFECTOS DE SOCKET ---
  useEffect(() => {
    socket.on('connect', () => console.log('Conectado al servidor Socket.io'));
    
    socket.on('game_update', (data) => {
      setGameState(data);
    });

    socket.on('notification', (msg) => {
      setNotification(msg);
      setTimeout(() => setNotification(''), 3000);
    });

    socket.on('special_effect', (data) => {
      if (data.type === 'kiss') {
        setNotification(`¡${data.from} te envió un beso! 💋`);
        setTimeout(() => setNotification(''), 4000);
      }
    });

    return () => {
      socket.off('connect');
      socket.off('game_update');
      socket.off('notification');
      socket.off('special_effect');
    };
  }, []);

  // --- HANDLERS ---

  const handleJoin = (avatar) => {
    if (!myName.trim()) return alert("Por favor escribe tu nombre");
    // Emitir el evento de unirse con el ID del socket
    socket.emit('join_house', { name: myName, avatar });
    setHasJoined(true);
  };

  const moveTo = (roomId) => {
    socket.emit('move_room', roomId);
  };

  const interactPet = (action) => {
    socket.emit('interact_pet', action);
  };

  const sendKiss = () => {
    socket.emit('send_kiss');
  };

  // --- RENDERIZADO: PANTALLA DE LOGIN ---
  if (!hasJoined) {
    return (
      <div className="login-container">
        <div className="login-card">
          <Heart className="login-icon" size={60} fill="#ec4899" />
          <h1>Nuestro Nido</h1>
          <p>Ingresa para ver a tu pareja</p>
          
          <input 
            type="text" 
            placeholder="Tu nombre..." 
            value={myName}
            onChange={(e) => setMyName(e.target.value)}
          />
          
          <div className="avatar-selection">
            <p>Elige tu personaje:</p>
            <div className="avatars">
              {['👩', '👨', '🧑', '👱‍♀️', '🧔'].map((av) => (
                <button key={av} onClick={() => handleJoin(av)}>{av}</button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- RENDERIZADO: CARGANDO ---
  if (!gameState || !gameState.players[socket.id]) return <div className="loading">Cargando la casa...</div>;

  const myPlayer = gameState.players[socket.id];
  const pet = gameState.pet;

  // --- RENDERIZADO: JUEGO PRINCIPAL ---
  return (
    <div className="app-container">
      
      {/* NOTIFICACIONES FLOTANTES */}
      {notification && <div className="notification-toast">{notification}</div>}

      {/* HEADER: ESTADO DE LA CASA */}
      <header className="header">
        <div className="house-title">
          <Home size={20} /> Casa de Nosotros
        </div>
        <div className="love-meter">
          <Heart size={20} fill="white" /> {gameState.loveMeter}% Amor
        </div>
      </header>

      {/* SECCIÓN MASCOTA */}
      <section className="pet-section">
        <div className="pet-card">
          <div className="pet-icon">
            {pet.type === 'cat' ? <Cat size={40}/> : <Dog size={40}/>}
          </div>
          <div className="pet-info">
            <h3>{pet.name}</h3>
            
            <div className="stat-row">
              <span>Hambre</span>
              <div className="progress-bar">
                <div className="fill hunger" style={{width: `${pet.hunger}%`}}></div>
              </div>
            </div>

            <div className="stat-row">
              <span>Felicidad</span>
              <div className="progress-bar">
                <div className="fill happiness" style={{width: `${pet.happiness}%`}}></div>
              </div>
            </div>
          </div>
          
          <div className="pet-actions">
            <button onClick={() => interactPet('feed')} title="Alimentar">🍖</button>
            <button onClick={() => interactPet('play')} title="Jugar">🎾</button>
          </div>
        </div>
      </section>

      {/* GRID DE HABITACIONES */}
      <main className="rooms-grid">
        {ROOMS.map((room) => {
          // Filtrar quién está en esta habitación
          const playersHere = Object.values(gameState.players).filter(p => p.room === room.id);
          const isMyRoom = myPlayer.room === room.id; // Uso myPlayer en lugar de la variable local

          return (
            <div 
              key={room.id} 
              className={`room-card ${isMyRoom ? 'active-room' : ''}`}
              style={{ backgroundColor: room.color }}
              onClick={() => moveTo(room.id)}
            >
              <div className="room-header">
                <span>{room.name}</span>
                {room.icon}
              </div>

              <div className="players-container">
                {playersHere.map((p) => (
                  <div key={p.id} className="player-avatar">
                    <span className="avatar-emoji">{p.avatar}</span>
                    <span className="player-name">{p.name}</span>
                  </div>
                ))}
              </div>
              
              {isMyRoom && <div className="action-tag">{myPlayer.action}</div>}
            </div>
          );
        })}
      </main>

      {/* CONTROLES INFERIORES */}
      <footer className="footer-controls">
        <button className="big-button kiss-btn" onClick={sendKiss}>
          <Heart fill="currentColor" /> Enviar Beso
        </button>
        <button className="big-button gift-btn" onClick={() => setNotification('Función de regalo próxima!')}>
          <Gift /> Regalo
        </button>
      </footer>

    </div>
  );
}

export default App;