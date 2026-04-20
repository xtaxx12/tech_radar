import { GoogleOAuthProvider } from '@react-oauth/google';
import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';

type Props = {
  children: ReactNode;
};

/**
 * Monta el <GoogleOAuthProvider> usando el Client ID devuelto por
 * /auth/config. Así el frontend usa una única fuente de verdad (el
 * backend) y no es posible que el botón se renderee con un clientId
 * distinto al que la API acepta. Mientras el config aún se está
 * cargando, o si auth está deshabilitado, renderea los children sin
 * provider para que el resto de la app funcione.
 */
export function GoogleAuthBridge({ children }: Props) {
  const { config } = useAuth();
  const clientId = config?.enabled ? config.googleClientId : null;

  if (!clientId) {
    return <>{children}</>;
  }

  return <GoogleOAuthProvider clientId={clientId}>{children}</GoogleOAuthProvider>;
}
