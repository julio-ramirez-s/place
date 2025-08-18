import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import io from 'socket.io-client';

// --- Constantes del Lienzo ---
const TILE_SIZE = 8; // Tamaño de cada píxel en el lienzo
const WORLD_WIDTH_TILES = 80; // Ancho del mundo en píxeles (80 * 8 = 640px)
const WORLD_HEIGHT_TILES = 60; // Alto del mundo en píxeles (60 * 8 = 480px)

// URL del servidor desplegado en Render
const SERVER_URL = 'https://place-server.onrender.com'; 

function App() {
  // --- Estados para la Autenticación ---
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authMessage, setAuthMessage] = useState(''); // Mensajes de éxito o error de autenticación

  // --- Estados del Juego de Píxeles ---
  const [socket, setSocket] = useState(null); // Instancia del socket de Socket.IO
  const [pixels, setPixels] = useState([]); // Almacena todos los píxeles colocados en el lienzo
  const [pixelCredits, setPixelCredits] = useState(0); // Créditos disponibles para colocar píxeles
  const [selectedColor, setSelectedColor] = useState('#ff0000'); // Color actual seleccionado para el píxel
  
  // Nuevos estados y referencias para el dibujo continuo
  const [isDrawing, setIsDrawing] = useState(false); // Verdadero si el clic del ratón está presionado
  const [isSpacebarDrawing, setIsSpacebarDrawing] = useState(false); // Verdadero si la barra espaciadora está presionada
  const lastPixelPlacedRef = useRef({ x: -1, y: -1 }); // Para evitar colocar múltiples píxeles en la misma celda al arrastrar
  const mouseCoordsOnCanvasRef = useRef({ x: -1, y: -1 }); // Guarda las últimas coordenadas del ratón en el lienzo

  const canvasRef = useRef(null); // Referencia al elemento canvas del DOM

  // --- Efecto para la conexión y manejo de Sockets ---
  useEffect(() => {
    console.log('Intentando conectar al servidor Socket.IO en:', SERVER_URL);
    const newSocket = io(SERVER_URL); // Conecta al servidor Socket.IO usando la URL de Render

    setSocket(newSocket); // Guarda la instancia del socket en el estado

    // Evento: Autenticación exitosa (registro o inicio de sesión)
    newSocket.on('authSuccess', (message) => {
      console.log('Auth Success:', message);
      setAuthMessage(message);
    });

    // Evento: Error de autenticación
    newSocket.on('authError', (message) => {
      console.error('Auth Error:', message);
      setAuthMessage(message);
    });

    // Evento: Inicio de sesión exitoso
    newSocket.on('loginSuccess', ({ username, pixelCredits }) => {
      console.log('Login Success - Username:', username, 'Pixel Credits:', pixelCredits);
      setUsername(username);
      setPixelCredits(pixelCredits);
      setIsLoggedIn(true);
      setAuthMessage('');
    });

    // Evento: Recepción de todos los píxeles del lienzo (al iniciar sesión)
    newSocket.on('allPixels', (initialPixels) => {
      console.log('Received all pixels:', initialPixels.length, 'pixels');
      setPixels(initialPixels);
    });

    // Evento: Un píxel ha sido colocado (por cualquier usuario)
    newSocket.on('pixelPlaced', (pixelData) => {
      console.log('Pixel placed:', pixelData);
      setPixels(prevPixels => {
        const existingIndex = prevPixels.findIndex(p => p.x === pixelData.x && p.y === pixelData.y);
        if (existingIndex !== -1) {
          const newPixels = [...prevPixels];
          newPixels[existingIndex] = pixelData;
          return newPixels;
        } else {
          return [...prevPixels, pixelData];
        }
      });
    });

    // Evento: Actualización de créditos de píxeles del usuario
    newSocket.on('updatePixelCredits', ({ pixelCredits }) => {
      console.log('Updated pixel credits:', pixelCredits);
      setPixelCredits(pixelCredits);
    });

    // Evento: Error al colocar un píxel
    newSocket.on('pixelError', (message) => {
      console.error('Pixel Error:', message);
      setAuthMessage(message);
    });

    // Limpieza al desmontar el componente
    return () => {
      console.log('Cerrando conexión de socket...');
      newSocket.close();
    };
  }, []);

  // --- Efecto para dibujar en el Canvas cuando los píxeles cambian ---
  useEffect(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');

    ctx.clearRect(0, 0, WORLD_WIDTH_TILES * TILE_SIZE, WORLD_HEIGHT_TILES * TILE_SIZE);
    
    pixels.forEach(pixel => {
      ctx.fillStyle = pixel.color;
      ctx.fillRect(pixel.x * TILE_SIZE, pixel.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    });
    console.log('Canvas redrawn with', pixels.length, 'pixels.');
  }, [pixels]);

  // --- Función para enviar la solicitud de colocar un píxel al servidor ---
  const sendPlacePixelRequest = useCallback((x, y) => {
    if (!isLoggedIn || !socket) {
      setAuthMessage('Debes iniciar sesión para colocar píxeles.');
      return;
    }

    // Evitar colocar múltiples píxeles en la misma celda si se arrastra muy rápido
    if (lastPixelPlacedRef.current.x === x && lastPixelPlacedRef.current.y === y) {
      return;
    }

    // Actualiza la última posición de píxel colocada
    lastPixelPlacedRef.current = { x, y };

    // Emite el evento 'placePixel' al servidor con la posición y el color
    socket.emit('placePixel', { x, y, color: selectedColor });
  }, [isLoggedIn, socket, selectedColor]);

  // --- Función para obtener las coordenadas del ratón en el canvas ---
  const getCanvasCoordinates = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: -1, y: -1 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = Math.floor(((e.clientX - rect.left) * scaleX) / TILE_SIZE);
    const y = Math.floor(((e.clientY - rect.top) * scaleY) / TILE_SIZE);

    return { x, y };
  }, []);

  // --- Manejador para el Click Inicial en el Canvas (mousedown) ---
  const handleCanvasMouseDown = useCallback((e) => {
    if (e.button === 0) { // Botón izquierdo del ratón
      setIsDrawing(true);
      const { x, y } = getCanvasCoordinates(e);
      sendPlacePixelRequest(x, y); // Coloca el primer píxel inmediatamente
    }
  }, [getCanvasCoordinates, sendPlacePixelRequest]);

  // --- Manejador para el Movimiento del Ratón (mousemove) ---
  const handleCanvasMouseMove = useCallback((e) => {
    const { x, y } = getCanvasCoordinates(e);
    mouseCoordsOnCanvasRef.current = { x, y }; // Actualiza las últimas coordenadas del ratón

    if (isDrawing) {
      // Solo coloca el píxel si las coordenadas son válidas y diferentes de la última
      if (x >= 0 && x < WORLD_WIDTH_TILES && y >= 0 && y < WORLD_HEIGHT_TILES) {
        sendPlacePixelRequest(x, y);
      }
    }
  }, [isDrawing, getCanvasCoordinates, sendPlacePixelRequest]);

  // --- Manejador para Soltar el Clic (mouseup) ---
  const handleCanvasMouseUp = useCallback(() => {
    setIsDrawing(false);
    lastPixelPlacedRef.current = { x: -1, y: -1 }; // Resetear la última posición para el clic
  }, []);

  // --- Manejador para Teclas (keydown y keyup) ---
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space' && !isSpacebarDrawing) {
        e.preventDefault(); // Evita que la barra espaciadora haga scroll
        setIsSpacebarDrawing(true);
        // Cuando se presiona la barra espaciadora, coloca un píxel en la posición actual del ratón
        const { x, y } = mouseCoordsOnCanvasRef.current;
        if (x !== -1 && y !== -1 && x >= 0 && x < WORLD_WIDTH_TILES && y >= 0 && y < WORLD_HEIGHT_TILES) {
          sendPlacePixelRequest(x, y);
        }
      }
    };

    const handleKeyUp = (e) => {
      if (e.code === 'Space' && isSpacebarDrawing) {
        setIsSpacebarDrawing(false);
        lastPixelPlacedRef.current = { x: -1, y: -1 }; // Resetear para la barra espaciadora
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isSpacebarDrawing, sendPlacePixelRequest]);

  // Efecto para dibujar con la barra espaciadora (continuamente mientras está presionada)
  useEffect(() => {
    let spacebarDrawingInterval;
    if (isSpacebarDrawing && isLoggedIn) {
      spacebarDrawingInterval = setInterval(() => {
        // Usa las últimas coordenadas conocidas del ratón para dibujar
        const { x, y } = mouseCoordsOnCanvasRef.current;
        if (x !== -1 && y !== -1 && x >= 0 && x < WORLD_WIDTH_TILES && y >= 0 && y < WORLD_HEIGHT_TILES) {
          sendPlacePixelRequest(x, y);
        }
      }, 50); // Ajusta la velocidad de "trazo" con la barra espaciadora
    } else {
      clearInterval(spacebarDrawingInterval);
    }
    return () => clearInterval(spacebarDrawingInterval);
  }, [isSpacebarDrawing, isLoggedIn, sendPlacePixelRequest]);


  // --- Manejador para el Registro de Usuario ---
  const handleRegister = useCallback(() => {
    if (socket && username.trim() && password.trim()) {
      console.log('Emitting register event...');
      socket.emit('register', { username, password });
      setAuthMessage('Registrando...');
    } else {
      setAuthMessage('Por favor, introduce usuario y contraseña.');
    }
  }, [socket, username, password]);

  // --- Manejador para el Inicio de Sesión de Usuario ---
  const handleLogin = useCallback(() => {
    if (socket && username.trim() && password.trim()) {
      console.log('Emitting login event...');
      socket.emit('login', { username, password });
      setAuthMessage('Iniciando sesión...');
    } else {
      setAuthMessage('Por favor, introduce usuario y contraseña.');
    }
  }, [socket, username, password]);


  // --- Renderizado Condicional: Pantalla de Inicio o Juego ---
  if (!isLoggedIn) {
    return (
      <div className="start-screen">
        <h1 className="game-title">Pixel Canvas</h1>
        <p className="tagline">¡Un lienzo gigante para todos!</p>
        <div className="input-group">
          <label htmlFor="username">Usuario:</label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Introduce tu usuario"
            maxLength="20"
          />
        </div>
        <div className="input-group">
          <label htmlFor="password">Contraseña:</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Introduce tu contraseña"
            maxLength="30"
          />
        </div>
        <button onClick={handleLogin} className="join-button">Iniciar Sesión</button>
        <button onClick={handleRegister} className="register-button">Registrarme</button>
        {authMessage && <p className="start-message">{authMessage}</p>}
      </div>
    );
  }

  // --- Renderizado del Juego (una vez logueado) ---
  return (
    <div className="game-container">
      {/* Banner de información en la parte superior */}
      <div className="info-banner">
        <h3>Pixel Canvas</h3>
        <p>Usuario: <strong>{username}</strong></p>
        <p>Créditos de píxeles: <strong>{pixelCredits}</strong></p>
        {authMessage && <p className="game-message">{authMessage}</p>}
      </div>

      <div className="main-content">
        {/* El elemento Canvas donde se dibujan los píxeles */}
        <canvas
          ref={canvasRef}
          width={WORLD_WIDTH_TILES * TILE_SIZE}
          height={WORLD_HEIGHT_TILES * TILE_SIZE}
          className="pixel-canvas"
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseUp} 
        />
        {/* Selector de color */}
        <div className="color-selector">
          <input
            type="color"
            value={selectedColor}
            onChange={(e) => setSelectedColor(e.target.value)}
            title="Selecciona un color"
          />
        </div>
      </div>
    </div>
  );
}

export default App;
