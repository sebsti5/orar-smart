import { useState } from 'react';
import { Chip } from './Badge';

export function TagInput({
  value,
  onChange,
  suggestions = [],
  placeholder = 'Adaugă…',
}: {
  value: string[];
  onChange: (v: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
}) {
  const [draft, setDraft] = useState('');
  const add = (t: string) => {
    const tag = t.trim().toLowerCase();
    if (tag && !value.includes(tag)) onChange([...value, tag]);
    setDraft('');
  };
  const listId = `tags-${suggestions.join('-').slice(0, 20)}`;
  return (
    <div className="flex min-h-9 flex-wrap items-center gap-1 rounded-lg px-1 py-1">
      {value.map((t) => (
        <Chip key={t} onRemove={() => onChange(value.filter((x) => x !== t))} className="bg-slate-50">
          #{t}
        </Chip>
      ))}
      <input
        list={listId}
        value={draft}
        placeholder={value.length === 0 ? placeholder : ''}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            add(draft);
          } else if (e.key === 'Backspace' && !draft && value.length > 0) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={() => draft && add(draft)}
        className="h-7 min-w-[80px] flex-1 bg-transparent px-1 text-sm focus:outline-none"
      />
      <datalist id={listId}>
        {suggestions.filter((s) => !value.includes(s)).map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </div>
  );
}
