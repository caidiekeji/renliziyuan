import React from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type Size = 'sm' | 'md' | 'lg';

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const base =
  'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-[color,background-color,box-shadow,transform] duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap active:enabled:scale-[0.97]';
const variants: Record<Variant, string> = {
  primary: 'bg-primary text-white shadow-sm shadow-primary/25 hover:bg-primary-hover',
  secondary: 'border border-border bg-white text-text hover:bg-bg-subtle',
  ghost: 'bg-transparent text-text-secondary hover:bg-bg-subtle hover:text-text',
  danger: 'bg-danger text-white shadow-sm shadow-danger/20 hover:bg-danger-hover',
  success: 'bg-accent text-white shadow-sm shadow-accent/20 hover:bg-accent-hover',
};
const sizes: Record<Size, string> = {
  sm: 'text-xs h-9 px-3',
  md: 'text-sm h-11 px-4',
  lg: 'text-base h-12 px-6',
};

export function Button({ variant = 'primary', size = 'md', loading, className, children, disabled, ...rest }: Props) {
  return (
    <button className={`${base} ${variants[variant]} ${sizes[size]} ${className || ''}`} disabled={disabled || loading} {...rest}>
      {loading && (
        <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  );
}
