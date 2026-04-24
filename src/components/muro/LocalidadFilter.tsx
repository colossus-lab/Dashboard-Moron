import { LOCALIDADES, type Localidad } from '../../types/muro';

type Value = Localidad | 'all';

interface Props {
  value: Value;
  onChange: (value: Value) => void;
}

export function LocalidadFilter({ value, onChange }: Props) {
  const options: { id: Value; label: string }[] = [
    { id: 'all', label: 'Todas' },
    ...LOCALIDADES.map((l) => ({ id: l.id as Value, label: l.label })),
  ];

  return (
    <div className="muro-filter" role="tablist" aria-label="Filtrar por localidad">
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.id)}
            className={`muro-filter-chip${active ? ' is-active' : ''}`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
