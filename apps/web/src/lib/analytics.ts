// Google Analytics 4 — cargado condicionalmente si VITE_GA_MEASUREMENT_ID está
// seteado en build-time. Si no hay ID, todas las funciones son no-op: podés
// desarrollar local sin tracking y en producción se activa solo cuando lo
// configures en Vercel.
//
// Privacidad:
// - anonymize_ip: true (trunca el último octeto del IPv4 / 80 bits del IPv6
//   antes de guardar; cumple LGPD/GDPR básico para analytics agregados).
// - send_page_view: false → controlamos pageviews manualmente en App.tsx
//   para ajustar timing a routes client-side y setear títulos correctos.

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const GA_ID = (import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined)?.trim();

export function analyticsEnabled(): boolean {
  return Boolean(GA_ID);
}

export function initAnalytics(): void {
  if (!GA_ID) return;
  if (typeof window === 'undefined') return;
  if (document.querySelector(`script[data-ga-id="${GA_ID}"]`)) return; // idempotente

  const gtagScript = document.createElement('script');
  gtagScript.async = true;
  gtagScript.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`;
  gtagScript.dataset.gaId = GA_ID;
  document.head.appendChild(gtagScript);

  window.dataLayer = window.dataLayer || [];
  // gtag() empuja argumentos al dataLayer — GA4 lo consume.
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  window.gtag('js', new Date());
  window.gtag('config', GA_ID, {
    anonymize_ip: true,
    send_page_view: false
  });
}

export function trackPageView(path: string, title?: string): void {
  if (!GA_ID || typeof window === 'undefined' || !window.gtag) return;
  window.gtag('event', 'page_view', {
    page_path: path,
    page_title: title ?? document.title,
    page_location: window.location.href
  });
}

export function trackEvent(name: string, params: Record<string, unknown> = {}): void {
  if (!GA_ID || typeof window === 'undefined' || !window.gtag) return;
  window.gtag('event', name, params);
}
