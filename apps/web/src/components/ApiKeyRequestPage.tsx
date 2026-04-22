import { useState } from 'react';
import { ApiError, submitApiKeyRequest } from '../api';

type FieldErrors = Partial<Record<'owner' | 'email' | 'website' | 'useCase', string>>;

export function ApiKeyRequestPage({ onBack }: { onBack: () => void }) {
  const [owner, setOwner] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [useCase, setUseCase] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    setSubmitting(true);

    try {
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

  return (
    <div className="app-shell">
      <div className="background-orb background-orb-one" aria-hidden="true" />
      <div className="background-orb background-orb-two" aria-hidden="true" />

      <header className="topbar">
        <div>
          <div className="brand">Tech Radar LATAM</div>
          <p className="muted">API pública para comunidades tech de LATAM.</p>
        </div>
        <button className="secondary-button" type="button" onClick={onBack}>
          ← Volver al radar
        </button>
      </header>

      <main className="api-page">
        <section className="panel api-hero">
          <div className="eyebrow">API pública</div>
          <h1>Integra los eventos de Tech Radar en tu sitio</h1>
          <p className="muted">
            Expón las próximas conferencias, meetups y hackathons de LATAM en el sitio de tu comunidad, bot o
            dashboard. Acceso gratuito, rate limit de 1000 requests/hora por key.
          </p>

          <div className="api-examples">
            <ApiCard
              title="Widget embebible"
              description="Un <script> y aparecen 5 eventos filtrados por país/ciudad en el sitio de tu comunidad."
            />
            <ApiCard
              title="REST puro"
              description="GET /public/v1/events con filtros por país, ciudad, fuente, tag y búsqueda de texto."
            />
            <ApiCard
              title="OpenAPI + Scalar UI"
              description="Docs interactivos en /public/docs. Spec oficial para autogenerar SDK en cualquier lenguaje."
            />
          </div>
        </section>

        <section className="panel">
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
                <small className="muted api-hint">{useCase.length}/1000 — mínimo 20 caracteres.</small>
                {fieldErrors.useCase ? <small className="api-error-inline">{fieldErrors.useCase}</small> : null}
              </label>

              {error ? <div className="api-error-banner">{error}</div> : null}

              <div className="api-actions">
                <button type="submit" className="primary-button" disabled={submitting}>
                  {submitting ? 'Enviando…' : 'Solicitar API key'}
                </button>
                <a href="/public/docs" target="_blank" rel="noopener" className="text-link-button">
                  Ver la documentación →
                </a>
              </div>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}

function ApiCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="api-card">
      <h3>{title}</h3>
      <p className="muted">{description}</p>
    </div>
  );
}
