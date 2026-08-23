import React from 'react';

type Tone = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'neutral';

const tones: Record<Tone, string> = {
  default: 'bg-bg-subtle text-text-secondary',
  primary: 'bg-primary-soft text-text',
  success: 'bg-accent-soft text-accent',
  warning: 'bg-warning-soft text-warning-deep',
  danger: 'bg-danger-soft text-danger',
  neutral: 'bg-border/50 text-text-secondary',
};

export function Badge({ tone = 'default', children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium ${tones[tone]} ${className || ''}`}>
      {children}
    </span>
  );
}
