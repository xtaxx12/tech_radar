import type { ProfileOptions, UserProfile } from '../types';

type Props = {
  profile: UserProfile;
  options: ProfileOptions | null;
  onChange: (nextProfile: UserProfile) => void;
  onSubmit: () => void;
  submitting: boolean;
};

const roleLabels: Record<string, string> = {
  frontend: 'Frontend',
  backend: 'Backend',
  fullstack: 'Fullstack',
  data: 'Data',
  design: 'Diseño',
  founder: 'Founder',
  mobile: 'Mobile',
  devops: 'DevOps',
  product: 'Product'
};

export function ProfileForm({ profile, options, onChange, onSubmit, submitting }: Props) {
  const toggleInterest = (interest: string) => {
    const nextInterests = profile.interests.includes(interest)
      ? profile.interests.filter((item) => item !== interest)
      : [...profile.interests, interest];

    onChange({ ...profile, interests: nextInterests });
  };

  return (
    <section className="panel onboarding-panel">
      <div className="eyebrow">Onboarding</div>
      <h2>Cuéntanos quién eres y te mostramos eventos que sí importan.</h2>
      <p className="muted">Selecciona tu país, rol, nivel e intereses. El radar usa estos datos para priorizar eventos y explicar cada recomendación.</p>

      <div className="form-grid">
        <label>
          <span>País</span>
          <select value={profile.country} onChange={(event) => onChange({ ...profile, country: event.target.value })}>
            {(options?.countries ?? ['Ecuador', 'México', 'Perú']).map((country) => (
              <option key={country} value={country}>{country}</option>
            ))}
          </select>
        </label>

        <label>
          <span>Rol</span>
          <select value={profile.role} onChange={(event) => onChange({ ...profile, role: event.target.value as UserProfile['role'] })}>
            {(options?.roles ?? ['frontend', 'backend', 'data']).map((role) => (
              <option key={role} value={role}>{roleLabels[role] ?? role}</option>
            ))}
          </select>
        </label>

        <label>
          <span>Nivel</span>
          <select value={profile.level} onChange={(event) => onChange({ ...profile, level: event.target.value as UserProfile['level'] })}>
            {(options?.levels ?? ['junior', 'mid', 'senior']).map((level) => (
              <option key={level} value={level}>{level.toUpperCase()}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="chip-group">
        <div className="chip-title">Intereses</div>
        <div className="chips">
          {(options?.interests ?? ['ia', 'web', 'mobile', 'blockchain', 'cloud', 'data']).map((interest) => {
            const active = profile.interests.includes(interest);
            return (
              <button key={interest} type="button" className={active ? 'chip chip-active' : 'chip'} onClick={() => toggleInterest(interest)}>
                {interest}
              </button>
            );
          })}
        </div>
      </div>

      <button className="primary-button" type="button" onClick={onSubmit} disabled={submitting}>
        {submitting ? 'Cargando radar...' : 'Explorar mi radar'}
      </button>
    </section>
  );
}
