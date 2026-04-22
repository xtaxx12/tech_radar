import { useState } from 'react';
import { ApiError, getOpenApiSpecUrl, getPublicDocsUrl, submitApiKeyRequest } from '../api';
import { trackEvent } from '../lib/analytics';

type FieldErrors = Partial<Record<'owner' | 'email' | 'website' | 'useCase', string>>;

type Tab = 'curl' | 'js' | 'widget';

const CODE_SNIPPETS: Record<Tab, { language: string; code: string }> = {
  curl: {
    language: 'bash',
    code: `curl -H "Authorization: Bearer trk_..." \\
  "https://tech-radar-api.onrender.com/public/v1/events?country=Ecuador&upcoming=true&limit=5"`
  },
  js: {
    language: 'javascript',
    code: `const response = await fetch(
  'https://tech-radar-api.onrender.com/public/v1/events?country=Ecuador&upcoming=true&limit=5',
  { headers: { Authorization: 'Bearer trk_...' } }
);

const { events } = await response.json();
console.log(events);`
  },
  widget: {
    language: 'html',
    code: `<div id="tech-radar-events"></div>
<script
  src="https://tech-radar-latam.vercel.app/widget.js"
  data-api-key="trk_..."
  data-country="Ecuador"
  data-limit="5"
  data-target="#tech-radar-events"
></script>`
  }
};

const RESPONSE_PREVIEW = `{
  "total": 42,
  "limit": 5,
  "offset": 0,
  "events": [
    {
      "id": "gdg-12345",
      "title": "Build With AI — LAN Party",
      "date": "2026-04-25T14:00:00.000Z",
      "country": "Ecuador",
      "city": "Quito",
      "source": "gdg",
      "tags": ["ia", "workshop"],
      "url": "https://gdg.community.dev/..."
    }
  ]
}`;

const FEATURES = [
  {
    icon: '⚡',
    title: 'Setup en 2 minutos',
    copy: 'Recibes tu key por email y ya puedes hacer requests. Sin OAuth, sin contratos.'
  },
  {
    icon: '🌎',
    title: 'Cobertura LATAM',
    copy: 'Eventos en 8+ países agregados desde Meetup, Eventbrite y GDG Chapters con dedup e IA.'
  },
  {
    icon: '🔌',
    title: 'Plug & play',
    copy: 'Usa la REST cruda, el widget embebible, o generamos un SDK desde la spec OpenAPI.'
  },
  {
    icon: '🛡️',
    title: 'Rate limit generoso',
    copy: '1000 requests/hora por key. Subimos el límite si tu comunidad lo necesita.'
  }
];

const STATS = [
  { value: '389+', label: 'eventos indexados' },
  { value: '8', label: 'países LATAM' },
  { value: '3', label: 'fuentes agregadas' },
  { value: '1000', label: 'req/h por key' }
];

export function ApiKeyRequestPage({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState<Tab>('curl');
  const [owner, setOwner] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [useCase, setUseCase] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copied, setCopied] = useState<Tab | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    setSubmitting(true);

    try {
      trackEvent('api_key_request_submitted', {
        has_website: Boolean(website.trim())
      });
      const response = await submitApiKeyRequest({
        owner: owner.trim(),
        email: email.trim(),
        website: website.trim() || undefined,
        useCase: useCase.trim()
      });
      setSuccess(response.message);
      setOwner('');
      setEmail('');
      setWebsite('');
      setUseCase('');
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 400 && err.details?.fields && typeof err.details.fields === 'object') {
          setFieldErrors(err.details.fields as FieldErrors);
          setError('Revisa los campos marcados.');
        } else if (err.status === 429) {
          setError('Demasiadas solicitudes desde esta IP. Inténtalo en una hora.');
        } else {
          setError(err.message);
        }
      } else {
        setError('No pudimos enviar la solicitud. Inténtalo más tarde.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const copyCode = async (which: Tab) => {
    try {
      await navigator.clipboard.writeText(CODE_SNIPPETS[which].code);
      setCopied(which);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      // ignore
    }
  };

  const scrollToForm = () => {
    document.getElementById('api-request-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="app-shell api-shell">
      <div className="background-orb background-orb-one" aria-hidden="true" />
      <div className="background-orb background-orb-two" aria-hidden="true" />

      <header className="topbar api-topbar">
        <div>
          <div className="brand">Tech Radar LATAM</div>
          <p className="muted">API pública para comunidades tech.</p>
        </div>
        <button className="secondary-button" type="button" onClick={onBack}>
          ← Volver al radar
        </button>
      </header>

      <main className="api-page">
        {/* HERO */}
        <section className="api-hero-v2">
          <div className="api-hero-copy">
            <span className="api-badge">
              <span className="api-badge-dot" aria-hidden="true" /> API v1 · gratis
            </span>
            <h1 className="api-hero-title">
              La infra de eventos tech <span className="api-highlight">de LATAM</span>,
              en tu sitio.
            </h1>
            <p className="api-hero-sub">
              Expón las próximas conferencias, meetups y hackathons directamente en el sitio de tu comunidad, bot o
              dashboard. REST limpia, widget embebible, o SDK autogenerado desde OpenAPI.
            </p>
            <div className="api-hero-ctas">
              <button type="button" className="primary-button" onClick={scrollToForm}>
                Solicitar key gratis →
              </button>
              <a
                href={getPublicDocsUrl()}
                target="_blank"
                rel="noopener"
                className="secondary-button"
              >
                Ver documentación
              </a>
            </div>
            <div className="api-stats">
              {STATS.map((stat) => (
                <div key={stat.label} className="api-stat">
                  <strong>{stat.value}</strong>
                  <span>{stat.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="api-hero-preview" aria-label="Ejemplo de request y respuesta">
            <div className="api-code-card">
              <div className="api-code-tabs" role="tablist">
                {(['curl', 'js', 'widget'] as Tab[]).map((value) => (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={tab === value}
                    className={tab === value ? 'api-code-tab api-code-tab-active' : 'api-code-tab'}
                    onClick={() => setTab(value)}
                  >
                    {value === 'curl' ? 'cURL' : value === 'js' ? 'JavaScript' : 'Widget'}
                  </button>
                ))}
                <button
                  type="button"
                  className="api-code-copy"
                  onClick={() => copyCode(tab)}
                  aria-label="Copiar código"
                >
                  {copied === tab ? '✓ Copiado' : 'Copiar'}
                </button>
              </div>
              <pre className="api-code-block">
                <code>{CODE_SNIPPETS[tab].code}</code>
              </pre>
            </div>

            <div className="api-code-card api-code-response">
              <div className="api-code-header">
                <span className="api-status-badge">200 OK</span>
                <span className="muted api-code-filename">application/json</span>
              </div>
              <pre className="api-code-block">
                <code>{RESPONSE_PREVIEW}</code>
              </pre>
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section className="api-features">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="api-feature">
              <div className="api-feature-icon">{feature.icon}</div>
              <h3>{feature.title}</h3>
              <p>{feature.copy}</p>
            </div>
          ))}
        </section>

        {/* FORM + SIDEBAR */}
        <section className="api-form-section" id="api-request-form">
          <div className="panel api-form-panel">
            <div className="eyebrow">Solicitar una key</div>
            <h2>Cuéntanos sobre tu comunidad</h2>
            <p className="muted">
              Revisamos las solicitudes manualmente (1-2 días hábiles) y te enviamos la key por email cuando quede
              aprobada.
            </p>

            {success ? (
              <div className="api-success">
                <strong>✅ {success}</strong>
                <button className="text-link-button" type="button" onClick={() => setSuccess(null)}>
                  Enviar otra solicitud
                </button>
              </div>
            ) : (
              <form onSubmit={submit} className="api-form">
                <div className="api-form-grid">
                  <label className="api-field">
                    <span>Nombre de la comunidad / proyecto *</span>
                    <input
                      value={owner}
                      onChange={(e) => setOwner(e.target.value)}
                      placeholder="Flutter Ecuador, GDG Cuenca, etc."
                      maxLength={100}
                      required
                      disabled={submitting}
                    />
                    {fieldErrors.owner ? <small className="api-error-inline">{fieldErrors.owner}</small> : null}
                  </label>

                  <label className="api-field">
                    <span>Email de contacto *</span>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="tu@comunidad.com"
                      required
                      disabled={submitting}
                    />
                    {fieldErrors.email ? <small className="api-error-inline">{fieldErrors.email}</small> : null}
                  </label>
                </div>

                <label className="api-field">
                  <span>Website (opcional)</span>
                  <input
                    type="url"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="https://flutterecuador.dev"
                    disabled={submitting}
                  />
                  {fieldErrors.website ? <small className="api-error-inline">{fieldErrors.website}</small> : null}
                </label>

                <label className="api-field">
                  <span>¿Qué quieres construir? *</span>
                  <textarea
                    value={useCase}
                    onChange={(e) => setUseCase(e.target.value)}
                    placeholder="Ej: widget en nuestra landing con próximos meetups de Flutter en Ecuador."
                    rows={4}
                    maxLength={1000}
                    minLength={20}
                    required
                    disabled={submitting}
                  />
                  <div className="api-field-meta">
                    <small className="muted">{useCase.length}/1000 — mínimo 20 caracteres.</small>
                    {fieldErrors.useCase ? <small className="api-error-inline">{fieldErrors.useCase}</small> : null}
                  </div>
                </label>

                {error ? <div className="api-error-banner">{error}</div> : null}

                <div className="api-submit-wrap">
                  <span className="muted api-form-hint">
                    Gratis · sin tarjeta · respuesta en 1-2 días hábiles
                  </span>
                  <button type="submit" className="api-submit-v2" disabled={submitting}>
                    <span>{submitting ? 'Enviando…' : 'Enviar solicitud'}</span>
                    {!submitting ? <span className="api-submit-arrow" aria-hidden="true">→</span> : null}
                  </button>
                </div>
              </form>
            )}
          </div>

          <aside className="panel api-aside">
            <h3>Qué incluye tu key</h3>
            <ul className="api-list">
              <li>
                <span className="api-list-bullet" aria-hidden="true">✓</span>
                <span>
                  <strong>1000 req/hora.</strong> Ampliable si muestras buen uso.
                </span>
              </li>
              <li>
                <span className="api-list-bullet" aria-hidden="true">✓</span>
                <span>
                  <strong>Endpoints completos.</strong> <code>/events</code>, <code>/countries</code>,{' '}
                  <code>/sources</code>.
                </span>
              </li>
              <li>
                <span className="api-list-bullet" aria-hidden="true">✓</span>
                <span>
                  <strong>Filtros avanzados.</strong> País, ciudad, fuente, tag y búsqueda de texto con AND entre
                  tokens.
                </span>
              </li>
              <li>
                <span className="api-list-bullet" aria-hidden="true">✓</span>
                <span>
                  <strong>Widget drop-in.</strong> Un <code>{'<script>'}</code> y aparecen tus eventos.
                </span>
              </li>
              <li>
                <span className="api-list-bullet" aria-hidden="true">✓</span>
                <span>
                  <strong>CORS abierto.</strong> Llama desde cualquier dominio.
                </span>
              </li>
              <li>
                <span className="api-list-bullet" aria-hidden="true">✓</span>
                <span>
                  <strong>Soporte directo.</strong> Respondemos por el email que uses al registrarte.
                </span>
              </li>
            </ul>

            <div className="api-aside-sample">
              <div className="api-aside-sample-label">Así se ve una key</div>
              <code className="api-aside-sample-key">trk_••••••••••••••••••••</code>
              <small className="muted">Te la enviamos al email cuando aprobemos tu solicitud.</small>
            </div>

            <button type="button" className="api-aside-cta" onClick={scrollToForm}>
              ↓ Ir al formulario
            </button>
          </aside>
        </section>

        {/* FOOTER CTA */}
        <section className="panel api-footer-cta">
          <div className="api-footer-preview" aria-hidden="true">
            <div className="api-footer-terminal">
              <div className="api-footer-terminal-bar">
                <span className="api-footer-dot api-footer-dot-red" />
                <span className="api-footer-dot api-footer-dot-yellow" />
                <span className="api-footer-dot api-footer-dot-green" />
                <span className="api-footer-terminal-title">openapi.json</span>
              </div>
              <pre className="api-footer-terminal-body">
                <code>
                  <span className="api-footer-line">
                    <span className="api-footer-k">"openapi"</span>: <span className="api-footer-s">"3.1.0"</span>,
                  </span>
                  <span className="api-footer-line">
                    <span className="api-footer-k">"info"</span>: {'{'}
                  </span>
                  <span className="api-footer-line api-footer-indent">
                    <span className="api-footer-k">"title"</span>:{' '}
                    <span className="api-footer-s">"Tech Radar · Public API"</span>,
                  </span>
                  <span className="api-footer-line api-footer-indent">
                    <span className="api-footer-k">"version"</span>: <span className="api-footer-s">"1.0.0"</span>
                  </span>
                  <span className="api-footer-line">{'}'}</span>
                </code>
              </pre>
            </div>
          </div>

          <div className="api-footer-content">
            <div className="eyebrow">OpenAPI 3.1 spec</div>
            <h2>Generá un SDK en tu lenguaje favorito</h2>
            <p className="muted">
              Descargá la spec en JSON o abrí la documentación interactiva con <strong>Scalar UI</strong> — podés
              probar requests en vivo pegando tu key.
            </p>
            <div className="api-footer-ctas">
              <a href={getPublicDocsUrl()} target="_blank" rel="noopener" className="primary-button">
                Abrir docs interactivos
              </a>
              <a href={getOpenApiSpecUrl()} target="_blank" rel="noopener" className="secondary-button">
                Descargar spec JSON
              </a>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
