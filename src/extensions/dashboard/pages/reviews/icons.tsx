import type { FC } from 'react';
import type { Template } from '../../../../shared/settings';

// Little line drawings of each template, for the template picker.
const box = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, rx: 2 } as const;

export const TemplateIcon: FC<{ template: Template }> = ({ template }) => (
  <svg viewBox="0 0 80 44" aria-hidden="true">
    {template === 'carousel' && (
      <>
        <rect x="2" y="8" width="20" height="28" {...box} />
        <rect x="30" y="8" width="20" height="28" {...box} />
        <rect x="58" y="8" width="20" height="28" {...box} strokeDasharray="3 2" />
      </>
    )}
    {template === 'slider' && (
      <>
        <rect x="14" y="6" width="52" height="32" {...box} />
        <path d="M6 22l-3 0M74 22l3 0" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="34" cy="42" r="1.2" fill="currentColor" />
        <circle cx="40" cy="42" r="1.2" fill="currentColor" opacity="0.4" />
        <circle cx="46" cy="42" r="1.2" fill="currentColor" opacity="0.4" />
      </>
    )}
    {template === 'grid' && (
      <>
        {[0, 1, 2].map((c) => [0, 1].map((r) => <rect key={`${c}${r}`} x={4 + c * 25} y={4 + r * 20} width="22" height="16" {...box} />))}
      </>
    )}
    {template === 'masonry' && (
      <>
        <rect x="4" y="4" width="22" height="20" {...box} />
        <rect x="4" y="28" width="22" height="12" {...box} />
        <rect x="29" y="4" width="22" height="12" {...box} />
        <rect x="29" y="20" width="22" height="20" {...box} />
        <rect x="54" y="4" width="22" height="16" {...box} />
        <rect x="54" y="24" width="22" height="16" {...box} />
      </>
    )}
    {template === 'list' && (
      <>
        <rect x="6" y="3" width="68" height="11" {...box} />
        <rect x="6" y="17" width="68" height="11" {...box} />
        <rect x="6" y="31" width="68" height="11" {...box} />
      </>
    )}
  </svg>
);
