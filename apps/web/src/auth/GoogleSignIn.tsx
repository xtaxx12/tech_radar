import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from './AuthContext';

type Props = {
  compact?: boolean;
  onSuccess?: () => void;
};

export function GoogleSignIn({ compact = false, onSuccess }: Props) {
  const { loginWithCredential, config } = useAuth();

  if (!config?.enabled || !config.googleClientId) {
    return null;
  }

  return (
    <div className={compact ? 'google-signin google-signin-compact' : 'google-signin'}>
      <GoogleLogin
        onSuccess={async (credentialResponse) => {
          const credential = credentialResponse.credential;
          if (!credential) return;
          try {
            await loginWithCredential(credential);
            onSuccess?.();
          } catch {
            // error ya expuesto por el context
          }
        }}
        onError={() => {
          console.warn('Google login flow interrumpido');
        }}
        theme="filled_black"
        shape="pill"
        size={compact ? 'medium' : 'large'}
        text="signin_with"
      />
    </div>
  );
}
