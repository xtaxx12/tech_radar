import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './auth/AuthContext';
import { GoogleAuthBridge } from './auth/GoogleAuthBridge';
import { initAnalytics } from './lib/analytics';
import './styles.css';

// Boot de Google Analytics (no-op si VITE_GA_MEASUREMENT_ID no está seteado).
initAnalytics();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AuthProvider>
      <GoogleAuthBridge>
        <App />
      </GoogleAuthBridge>
    </AuthProvider>
  </React.StrictMode>
);
