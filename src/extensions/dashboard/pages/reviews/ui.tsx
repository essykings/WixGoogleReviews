// Small components with the shadcn/ui look (styles in ui.css). Plain React, no component library.
import { useState, type FC, type ReactNode } from 'react';

export const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ');

export const Button: FC<{ variant?: 'default' | 'outline' | 'ghost'; small?: boolean; href?: string; onClick?: () => void; disabled?: boolean; children: ReactNode; title?: string }> = ({ variant = 'default', small, href, onClick, disabled, children, title }) => {
  const className = cx('btn', variant !== 'default' && variant, small && 'sm');
  if (href) {
    return (
      <a className={className} href={href} target="_blank" rel="noopener noreferrer" title={title}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" className={className} onClick={onClick} disabled={disabled} title={title}>
      {children}
    </button>
  );
};

export const Card: FC<{ title: ReactNode; description?: ReactNode; right?: ReactNode; children: ReactNode }> = ({ title, description, right, children }) => (
  <section className="card">
    <div className="card-h">
      <div>
        <h2 className="card-t">{title}</h2>
        {description ? <p className="card-d">{description}</p> : null}
      </div>
      {right}
    </div>
    <div className="card-c">{children}</div>
  </section>
);

export const Badge: FC<{ kind?: 'default' | 'dark' | 'success' | 'warn' | 'pro'; children: ReactNode }> = ({ kind = 'default', children }) => (
  <span className={cx('badge', kind !== 'default' && kind)}>{children}</span>
);

export const ProBadge: FC = () => <Badge kind="pro">Pro</Badge>;

export const Field: FC<{ label: string; hint?: ReactNode; pro?: boolean; children: ReactNode; error?: string }> = ({ label, hint, pro, children, error }) => (
  <div className="field">
    <div className="label">
      {label}
      {pro ? <ProBadge /> : null}
    </div>
    {children}
    {error ? <div className="err-t">{error}</div> : hint ? <div className="hint">{hint}</div> : null}
  </div>
);

export const Switch: FC<{ label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }> = ({ label, checked, onChange, disabled }) => (
  <div className="sw-row">
    <span>{label}</span>
    <button type="button" role="switch" aria-checked={checked} aria-label={label} className="sw" disabled={disabled} onClick={() => onChange(!checked)}>
      <span className="sw-thumb" />
    </button>
  </div>
);

export interface SegOption<T> {
  value: T;
  label: ReactNode;
  locked?: boolean;
}

export function Segmented<T extends string | number>({ value, options, onChange, label }: { value: T; options: SegOption<T>[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.value)} type="button" aria-pressed={o.value === value} disabled={o.locked} title={o.locked ? 'Available on Pro' : undefined} onClick={() => onChange(o.value)}>
          {o.label}
          {o.locked ? <span aria-hidden="true">{'\u{1F512}'}</span> : null}
        </button>
      ))}
    </div>
  );
}

export const Select: FC<{ value: string; options: SegOption<string>[]; onChange: (v: string) => void; disabled?: boolean; label: string }> = ({ value, options, onChange, disabled, label }) => (
  <select className="select" value={value} disabled={disabled} aria-label={label} onChange={(e) => onChange(e.target.value)}>
    {options.map((o) => (
      <option key={o.value} value={o.value}>
        {o.label}
      </option>
    ))}
  </select>
);

export const TextInput: FC<{ value: string; onChange: (v: string) => void; placeholder?: string; disabled?: boolean; error?: boolean; maxLength?: number; label: string; onEnter?: () => void }> = ({ value, onChange, placeholder, disabled, error, maxLength, label, onEnter }) => (
  <input
    className={cx('input', error && 'err')}
    value={value}
    placeholder={placeholder}
    disabled={disabled}
    maxLength={maxLength}
    aria-label={label}
    onChange={(e) => onChange(e.target.value)}
    onKeyDown={(e) => {
      if (e.key === 'Enter' && onEnter) onEnter();
    }}
  />
);

export const TagInput: FC<{ value: string[]; onChange: (v: string[]) => void; placeholder: string; disabled?: boolean; label: string }> = ({ value, onChange, placeholder, disabled, label }) => {
  const [text, setText] = useState('');
  const add = () => {
    const w = text.trim();
    if (w && !value.some((v) => v.toLowerCase() === w.toLowerCase()) && value.length < 20) onChange([...value, w.slice(0, 40)]);
    setText('');
  };
  return (
    <div className={cx('tags', disabled && 'disabled')}>
      {value.map((w) => (
        <span className="tag" key={w}>
          {w}
          <button type="button" aria-label={`Remove ${w}`} disabled={disabled} onClick={() => onChange(value.filter((v) => v !== w))}>
            {'×'}
          </button>
        </span>
      ))}
      <input
        value={text}
        disabled={disabled}
        placeholder={value.length ? '' : placeholder}
        aria-label={label}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            add();
          } else if (e.key === 'Backspace' && !text && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={add}
      />
    </div>
  );
};

export const ColorField: FC<{ label: string; value: string; fallback: string; onChange: (v: string) => void }> = ({ label, value, fallback, onChange }) => (
  <label className="color">
    {label}
    <span className="color-in">
      <input type="color" value={value || fallback} onChange={(e) => onChange(e.target.value)} aria-label={label} />
      <code>{value || fallback}</code>
      {value ? (
        <button type="button" className="btn ghost sm" style={{ marginLeft: 'auto', height: 24, padding: '0 6px' }} onClick={() => onChange('')} aria-label={`Reset ${label}`}>
          Reset
        </button>
      ) : null}
    </span>
  </label>
);

export const Slider: FC<{ value: number; min: number; max: number; step?: number; onChange: (v: number) => void; label: string; disabled?: boolean }> = ({ value, min, max, step = 10, onChange, label, disabled }) => (
  <div className="slider-row">
    <input type="range" className="range" min={min} max={max} step={step} value={value} aria-label={label} disabled={disabled} onChange={(e) => onChange(Number(e.target.value))} />
    <span className="range-v">{value}</span>
  </div>
);

export const Alert: FC<{ kind?: 'info' | 'success' | 'warning' | 'destructive'; title?: string; children?: ReactNode; action?: ReactNode }> = ({ kind = 'info', title, children, action }) => (
  <div className={cx('alert', kind)} role={kind === 'destructive' ? 'alert' : 'status'}>
    <div className="alert-b">
      {title ? <div className="alert-t">{title}</div> : null}
      {children ? <div className="alert-d">{children}</div> : null}
    </div>
    {action}
  </div>
);

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: Array<{ id: T; label: string }> }) {
  return (
    <div className="tabs" role="tablist">
      {items.map((t) => (
        <button key={t.id} type="button" role="tab" className="tab" aria-selected={t.id === value} onClick={() => onChange(t.id)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

const icons = {
  desktop: <><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></>,
  tablet: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M11 18h2" /></>,
  phone: <><rect x="8" y="2" width="8" height="20" rx="2" /><path d="M11 19h2" /></>,
} as const;

export const DeviceToggle: FC<{ value: 'desktop' | 'tablet' | 'phone'; onChange: (v: 'desktop' | 'tablet' | 'phone') => void }> = ({ value, onChange }) => (
  <div className="seg icons" role="group" aria-label="Preview device">
    {(['desktop', 'tablet', 'phone'] as const).map((d) => (
      <button key={d} type="button" aria-pressed={value === d} aria-label={d} title={d[0].toUpperCase() + d.slice(1)} onClick={() => onChange(d)}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icons[d]}</svg>
      </button>
    ))}
  </div>
);

export const Skeleton: FC<{ height?: number; width?: string }> = ({ height = 16, width = '100%' }) => <div className="sk" style={{ height, width }} />;

/** A visible "something is happening" line with a small spinner. */
export const Progress: FC<{ children: ReactNode }> = ({ children }) => (
  <div className="progress" role="status" aria-live="polite">
    <span className="spin" aria-hidden="true" />
    <span>{children}</span>
  </div>
);
