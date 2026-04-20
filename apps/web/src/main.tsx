import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './auth/AuthContext';
import { GoogleAuthBridge } from './auth/GoogleAuthBridge';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AuthProvider>
      <GoogleAuthBridge>
        <App />
      </GoogleAuthBridge>
    </AuthProvider>
  </React.StrictMode>
);
