import React from 'react';

interface Props extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className, id, ...rest }: Props) {
  const inputId = id || (label ? `input-${label}` : undefined);
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-text">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`w-full rounded-lg border bg-white px-3 text-sm text-text placeholder:text-text-secondary/50 transition-colors h-10 ${
          error ? 'border-danger focus:border-danger' : 'border-border hover:border-text-secondary/40 focus:border-text-secondary'
        } ${className || ''}`}
        {...rest}
      />
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
