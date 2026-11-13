interface TabsProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  label: string;
}

/** Bölümlü seçici (ör. Giriş yap / Kayıt ol). Az sayıda, birbirini dışlayan seçenek için. */
export default function Tabs<T extends string>({ value, onChange, options, label }: TabsProps<T>) {
  return (
    <div role="tablist" aria-label={label} className="flex p-1 rounded-md bg-levha-koyu border border-levha-cizgi">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={`flex-1 h-8 rounded text-sm font-medium transition-colors ${
              active ? 'bg-levha-yuzey text-tebesir shadow-sm' : 'text-tebesir-silik hover:text-tebesir'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
