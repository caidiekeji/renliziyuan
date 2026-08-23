import React from 'react';

interface Props extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  action?: React.ReactNode;
}

export function Card({ title, action, children, className, ...rest }: Props) {
  return (
    <div className={`card ${className || ''}`} {...rest}>
      {(title || action) && (
        <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-5">
          {title && <h3 className="text-sm font-semibold text-text">{title}</h3>}
          {action}
        </div>
      )}
      <div className="p-4 sm:p-5">{children}</div>
    </div>
  );
}
