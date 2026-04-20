import type { Level, ProfileOptions, Role, UserProfile } from '../types';

type Props = {
  profile: UserProfile;
  options: ProfileOptions | null;
  onChange: (nextProfile: UserProfile) => void;
  onSubmit: () => void;
  submitting: boolean;
  mode?: 'onboarding' | 'edit';
  onCancel?: () => void;
  hasChanges?: boolean;
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

type Preset = {
  label: string;
  description: string;
  role: Role;
  level: Level;
  interests: string[];
};

const PRESETS: Preset[] = [
  { label: 'IA para junior', description: 'Data + aprendizaje de IA', role: 'data', level: 'junior', interests: ['ia'] },
  { label: 'Frontend senior', description: 'Web avanzado y performance', role: 'frontend', level: 'senior', interests: ['web', 'performance'] },
  { label: 'DevOps cloud', description: 'Cloud, CI/CD, infra', role: 'devops', level: 'mid', interests: ['cloud', 'ia'] },
  { label: 'Product & UX', description: 'Producto, diseño, UX', role: 'product', level: 'mid', interests: ['ux', 'product'] }
];

export function ProfileForm({ profile, options, onChange, onSubmit, submitting, mode = 'onboarding', onCancel, hasChanges = true }: Props) {
  const isEditing = mode === 'edit';

  const toggleInterest = (interest: string) => {
    const nextInterests = profile.interests.includes(interest)
      ? profile.interests.filter((item) => item !== interest)
      : [...profile.interests, interest];

    onChange({ ...profile, interests: nextInterests });
  };

  const applyPreset = (preset: Preset) => {
    onChange({
      ...profile,
      role: preset.role,
      level: preset.level,
      interests: preset.interests
    });
  };

  const activePreset = PRESETS.find((preset) => isPresetActive(preset, profile));

  return (
    <section className="panel onboarding-panel">
      <div className="eyebrow">{isEditing ? 'Editar perfil' : 'Onboarding'}</div>
      <h2>
        {isEditing
          ? 'Ajusta tu perfil y actualizamos el radar.'
          : 'Cuéntanos quién eres y te mostramos eventos que sí importan.'}
      </h2>
      <p className="muted">
        {isEditing
          ? 'Los cambios se guardan localmente y las recomendaciones se reordenan al instante.'
          : 'Selecciona tu país, rol, nivel e intereses. El radar usa estos datos para priorizar eventos y explicar cada recomendación.'}
      </p>

      <div className="preset-row">
        <div className="filter-label">Perfil sugerido</div>
        <div className="prompt-pills">
          {PRESETS.map((preset) => {
            const active = activePreset?.label === preset.label;
            return (
              <button
                key={preset.label}
                type="button"
                className={active ? 'prompt-pill prompt-pill-active' : 'prompt-pill'}
                onClick={() => applyPreset(preset)}
                aria-pressed={active}
                title={preset.description}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>

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
              <button
                key={interest}
                type="button"
                className={active ? 'chip chip-active' : 'chip'}
                onClick={() => toggleInterest(interest)}
                aria-pressed={active}
                aria-label={`Interés ${interest}${active ? ' (seleccionado)' : ''}`}
              >
                {interest}
              </button>
            );
          })}
        </div>
      </div>

      <div className="profile-form-actions">
        {isEditing && onCancel ? (
          <button type="button" className="secondary-button" onClick={onCancel}>
            Cancelar
          </button>
        ) : null}
        <button
          className="primary-button"
          type="button"
          onClick={onSubmit}
          disabled={submitting || (isEditing && !hasChanges)}
        >
          {submitting ? 'Cargando radar...' : isEditing ? (hasChanges ? 'Guardar cambios' : 'Sin cambios') : 'Explorar mi radar'}
        </button>
      </div>
    </section>
  );
}

function isPresetActive(preset: Preset, profile: UserProfile): boolean {
  if (profile.role !== preset.role || profile.level !== preset.level) return false;
  if (profile.interests.length !== preset.interests.length) return false;
  const sorted = [...profile.interests].sort();
  const target = [...preset.interests].sort();
  return sorted.every((value, index) => value === target[index]);
}
