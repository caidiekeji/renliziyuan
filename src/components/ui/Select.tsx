import React from 'react';

interface Props extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options?: { value: string; label: string }[];
  children?: React.ReactNode;
}

export function Select({ label, error, options, children, className, ...rest }: Props) {
  return (
    <div className="w-full">
      {label && <label className="mb-1.5 block text-sm font-medium text-text">{label}</label>}
      <select
        className={`w-full rounded-lg border bg-white px-3 text-sm text-text h-11 transition-colors duration-200 ${
          error ? 'border-danger' : 'border-border hover:border-text-secondary/40'
        } ${className || ''}`}
        {...rest}
      >
        {options?.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
        {children}
      </select>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
