import { GoogleOAuthProvider } from '@react-oauth/google';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './auth/AuthContext';
import './styles.css';

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';

const rootNode = (
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  googleClientId ? <GoogleOAuthProvider clientId={googleClientId}>{rootNode}</GoogleOAuthProvider> : rootNode
);
