import React from 'react';

interface Props extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({ label, error, className, ...rest }: Props) {
  return (
    <div className="w-full">
      {label && <label className="mb-1.5 block text-sm font-medium text-text">{label}</label>}
      <textarea
        className={`w-full rounded-lg border bg-white px-3 py-2 text-sm text-text placeholder:text-text-secondary/50 ${
          error ? 'border-danger' : 'border-border hover:border-text-secondary/40 focus:border-text-secondary'
        } ${className || ''}`}
        {...rest}
      />
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
