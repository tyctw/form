import React from 'react';

interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export const FormInput: React.FC<FormInputProps> = ({ label, error, className, ...props }) => {
  return (
    <div className="flex flex-col gap-2 group">
      <label htmlFor={props.id} className="text-sm font-extrabold text-slate-600 ml-1 transition-colors group-focus-within:text-violet-600 uppercase tracking-wider text-[11px]">
        {label}
        {props.required && <span className="text-rose-400 ml-1 align-top">*</span>}
      </label>
      <input
        {...props}
        className={`
          flex h-14 w-full rounded-2xl border border-transparent bg-slate-50/80 px-5 py-3 text-base text-slate-800 placeholder:text-slate-400 
          shadow-inner ring-1 ring-slate-200/50
          transition-all duration-300 ease-out
          hover:bg-white hover:ring-violet-200 hover:shadow-lg hover:shadow-violet-100/50
          focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-300
          disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400
          ${error ? 'ring-rose-200 bg-rose-50 focus:ring-rose-400/30' : ''}
          ${className}
        `}
      />
      {error && <p className="text-xs font-bold text-rose-500 ml-1 animate-pulse">{error}</p>}
    </div>
  );
};