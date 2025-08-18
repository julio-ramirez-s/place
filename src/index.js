import React from 'react';
import ReactDOM from 'react-dom/client'; // Importa desde react-dom/client para React 18
import './index.css'; // Estilos globales básicos
import App from './App'; // Importa el componente principal de tu juego
// import reportWebVitals from './reportWebVitals'; // ¡Esta línea se elimina!

// Obtiene el elemento raíz donde se montará la aplicación de React
const root = ReactDOM.createRoot(document.getElementById('root'));

// Renderiza el componente App dentro del StrictMode para detectar problemas
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Si quieres medir el rendimiento de tu aplicación, pasa una función
// para registrar los resultados (por ejemplo: reportWebVitals(console.log))
// Ya no es necesario llamar a reportWebVitals si el archivo no existe.
// reportWebVitals();
