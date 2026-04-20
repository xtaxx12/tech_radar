export type EventFilters = {
  source: string;
  country: string;
  city: string;
};

type Props = {
  filters: EventFilters;
  onChange: (filters: EventFilters) => void;
  availableCountries: string[];
  availableCities: string[];
};

const SOURCES: Array<{ value: string; label: string }> = [
  { value: '', label: 'Todas' },
  { value: 'meetup', label: 'Meetup' },
  { value: 'eventbrite', label: 'Eventbrite' },
  { value: 'gdg', label: 'GDG' },
  { value: 'community', label: 'Comunidad' }
];

export function FilterBar({ filters, onChange, availableCountries, availableCities }: Props) {
  const hasFilters = Boolean(filters.source || filters.country || filters.city);
  const clear = () => onChange({ source: '', country: '', city: '' });

  return (
    <div className="filter-bar" role="region" aria-label="Filtros de eventos">
      <div className="filter-group">
        <div className="filter-label">Fuente</div>
        <div className="prompt-pills">
          {SOURCES.map((source) => {
            const active = filters.source === source.value;
            return (
              <button
                key={source.value || 'all'}
                type="button"
                className={active ? 'prompt-pill prompt-pill-active' : 'prompt-pill'}
                onClick={() => onChange({ ...filters, source: source.value })}
                aria-pressed={active}
              >
                {source.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="filter-selects">
        <label>
          <span>País</span>
          <select
            value={filters.country}
            onChange={(event) => onChange({ ...filters, country: event.target.value })}
          >
            <option value="">Todos</option>
            {availableCountries.map((country) => (
              <option key={country} value={country}>{country}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Ciudad</span>
          <select
            value={filters.city}
            onChange={(event) => onChange({ ...filters, city: event.target.value })}
          >
            <option value="">Todas</option>
            {availableCities.map((city) => (
              <option key={city} value={city}>{city}</option>
            ))}
          </select>
        </label>
        {hasFilters ? (
          <button type="button" className="text-link-button filter-clear" onClick={clear}>
            Limpiar filtros
          </button>
        ) : null}
      </div>
    </div>
  );
}
