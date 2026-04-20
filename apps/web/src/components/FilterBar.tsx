import { useEffect, useMemo, useState } from 'react';
import type { RankedEvent } from '../types';

export type EventFilters = {
  source: string;
  country: string;
  city: string;
  q: string;
};

type Props = {
  filters: EventFilters;
  onChange: (filters: EventFilters) => void;
  events: RankedEvent[];
  profileCountry?: string;
};

const SOURCES: Array<{ value: string; label: string }> = [
  { value: '', label: 'Todas' },
  { value: 'meetup', label: 'Meetup' },
  { value: 'eventbrite', label: 'Eventbrite' },
  { value: 'gdg', label: 'GDG' },
  { value: 'community', label: 'Comunidad' }
];

export function FilterBar({ filters, onChange, events, profileCountry }: Props) {
  const countryOptions = useMemo(() => buildCountryOptions(events, profileCountry), [events, profileCountry]);
  const cityOptions = useMemo(() => buildCityOptions(events, filters.country), [events, filters.country]);

  // Debounce de la búsqueda: escribir "react" no dispara 5 requests.
  const [searchDraft, setSearchDraft] = useState(filters.q);
  useEffect(() => {
    setSearchDraft(filters.q);
  }, [filters.q]);
  useEffect(() => {
    if (searchDraft === filters.q) return;
    const handle = setTimeout(() => onChange({ ...filters, q: searchDraft }), 250);
    return () => clearTimeout(handle);
  }, [searchDraft, filters, onChange]);

  const hasFilters = Boolean(filters.source || filters.country || filters.city || filters.q);
  const clear = () => {
    setSearchDraft('');
    onChange({ source: '', country: '', city: '', q: '' });
  };

  const handleCountryChange = (nextCountry: string) => {
    const nextCity = nextCountry === filters.country ? filters.city : '';
    onChange({ ...filters, country: nextCountry, city: nextCity });
  };

  return (
    <div className="filter-bar" role="region" aria-label="Filtros de eventos">
      <div className="filter-search">
        <span className="filter-search-icon" aria-hidden="true">⌕</span>
        <input
          type="search"
          value={searchDraft}
          onChange={(event) => setSearchDraft(event.target.value)}
          placeholder="Buscar por título, tecnología, ciudad…"
          aria-label="Buscar eventos"
          autoComplete="off"
        />
        {searchDraft ? (
          <button
            type="button"
            className="filter-search-clear"
            onClick={() => setSearchDraft('')}
            aria-label="Limpiar búsqueda"
          >
            ✕
          </button>
        ) : null}
      </div>

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
            onChange={(event) => handleCountryChange(event.target.value)}
          >
            <option value="">Todos</option>
            {countryOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.count > 0 ? `${option.value} (${option.count})` : `${option.value} · sin eventos`}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Ciudad</span>
          <select
            value={filters.city}
            onChange={(event) => onChange({ ...filters, city: event.target.value })}
            disabled={cityOptions.length === 0}
          >
            <option value="">
              {filters.country
                ? (cityOptions.length > 0 ? 'Todas' : 'Sin ciudades disponibles')
                : 'Selecciona un país'}
            </option>
            {cityOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.value} ({option.count})
              </option>
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

type Option = { value: string; count: number };

function buildCountryOptions(events: RankedEvent[], profileCountry: string | undefined): Option[] {
  const counts = new Map<string, number>();

  for (const event of events) {
    const country = event.country?.trim();
    if (!country || country.toLowerCase() === 'latam') continue;
    counts.set(country, (counts.get(country) ?? 0) + 1);
  }

  if (profileCountry && !counts.has(profileCountry)) {
    counts.set(profileCountry, 0);
  }

  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => {
      if (a.count !== b.count) return b.count - a.count;
      return a.value.localeCompare(b.value);
    });
}

function buildCityOptions(events: RankedEvent[], selectedCountry: string): Option[] {
  if (!selectedCountry) return [];

  const counts = new Map<string, number>();
  const normalizedSelected = selectedCountry.toLowerCase();

  for (const event of events) {
    if ((event.country ?? '').toLowerCase() !== normalizedSelected) continue;
    const city = event.city?.trim();
    if (!city || city.toLowerCase() === 'latam') continue;
    counts.set(city, (counts.get(city) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => {
      if (a.count !== b.count) return b.count - a.count;
      return a.value.localeCompare(b.value);
    });
}
