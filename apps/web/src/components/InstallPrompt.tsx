import { useEffect, useState } from 'react';

// Chrome/Edge/Brave exponen este evento cuando la PWA es instalable.
// Safari iOS no lo dispara — para iOS hacemos un hint distinto (agregar a pantalla de inicio).
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt: () => Promise<void>;
}

const DISMISSED_KEY = 'trk-install-dismissed-at';
const DISMISS_COOLDOWN_DAYS = 30;

function isRecentlyDismissed(): boolean {
  const raw = localStorage.getItem(DISMISSED_KEY);
  if (!raw) return false;
  const when = Number(raw);
  if (!Number.isFinite(when)) return false;
  const daysSince = (Date.now() - when) / (1000 * 60 * 60 * 24);
  return daysSince < DISMISS_COOLDOWN_DAYS;
}

function isInstalled(): boolean {
  // iOS Safari, Chrome Android y desktop: reportan "standalone" cuando la app
  // está instalada en home screen / como app ventana.
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true;
  // iOS Safari legacy
  const nav = window.navigator as unknown as { standalone?: boolean };
  return nav.standalone === true;
}

export function InstallPrompt() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(() => isRecentlyDismissed() || isInstalled());

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    };

    const installedHandler = () => {
      setPromptEvent(null);
      setDismissed(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', installedHandler);
    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  if (dismissed || !promptEvent) return null;

  const install = async () => {
    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === 'accepted') {
        setPromptEvent(null);
      } else {
        // Usuario clickeó "no" en el diálogo del browser: respetamos, dormimos 30d.
        localStorage.setItem(DISMISSED_KEY, String(Date.now()));
        setDismissed(true);
      }
    } catch {
      // Algunos browsers fallan si el evento ya se consumió; ignoramos.
    }
  };

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    setDismissed(true);
  };

  return (
    <div className="pwa-install-card" role="dialog" aria-live="polite" aria-label="Instalar Tech Radar">
      <div className="pwa-install-icon" aria-hidden="true">📲</div>
      <div className="pwa-install-copy">
        <strong>Instala Tech Radar</strong>
        <span>Acceso rápido desde tu pantalla de inicio, carga instantánea y funciona sin conexión.</span>
      </div>
      <div className="pwa-install-actions">
        <button type="button" className="pwa-install-dismiss" onClick={dismiss}>
          Ahora no
        </button>
        <button type="button" className="pwa-install-accept" onClick={install}>
          Instalar
        </button>
      </div>
    </div>
  );
}
