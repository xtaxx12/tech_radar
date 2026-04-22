import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * Aviso sticky cuando hay una nueva versión del SW. El usuario decide cuándo
 * recargar — evita que un deploy de Render en medio de la visita interrumpa
 * lo que esté haciendo en /api (form) o en el chat.
 */
export function UpdateBanner() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      // Revisa actualizaciones cada hora. Render puede deployar cambios y
      // queremos que los usuarios que dejan la tab abierta vean el banner.
      if (registration) {
        setInterval(() => {
          void registration.update();
        }, 60 * 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.warn('[pwa] SW registration failed:', error);
    }
  });

  if (offlineReady) {
    return (
      <div className="pwa-update-banner pwa-update-ready" role="status">
        <span>✅ Listo para funcionar sin conexión.</span>
        <button type="button" onClick={() => setOfflineReady(false)}>
          Cerrar
        </button>
      </div>
    );
  }

  if (needRefresh) {
    return (
      <div className="pwa-update-banner" role="alert">
        <span>Hay una nueva versión de Tech Radar disponible.</span>
        <div className="pwa-update-actions">
          <button type="button" className="pwa-update-later" onClick={() => setNeedRefresh(false)}>
            Después
          </button>
          <button type="button" className="pwa-update-now" onClick={() => void updateServiceWorker(true)}>
            Actualizar ahora
          </button>
        </div>
      </div>
    );
  }

  return null;
}
