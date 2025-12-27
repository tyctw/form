import React from 'react';

interface FormSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: string[];
  error?: string;
  placeholder?: string;
}

export const FormSelect: React.FC<FormSelectProps> = ({ label, options, error, placeholder, className, ...props }) => {
  return (
    <div className="flex flex-col gap-2 group">
      <label htmlFor={props.id} className="text-sm font-extrabold text-slate-600 ml-1 transition-colors group-focus-within:text-violet-600 uppercase tracking-wider text-[11px]">
        {label}
        {props.required && <span className="text-rose-400 ml-1 align-top">*</span>}
      </label>
      <div className="relative">
        <select
          {...props}
          className={`
            flex h-14 w-full rounded-2xl border border-transparent bg-slate-50/80 px-5 py-3 text-base appearance-none
            shadow-inner ring-1 ring-slate-200/50
            transition-all duration-300 ease-out
            hover:bg-white hover:ring-violet-200 hover:shadow-lg hover:shadow-violet-100/50
            focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-300
            disabled:cursor-not-allowed disabled:opacity-50 
            ${error ? 'ring-rose-200 bg-rose-50 focus:ring-rose-400/30' : ''}
            ${!props.value ? 'text-slate-400' : 'text-slate-800 font-medium'}
            ${className}
          `}
        >
          <option value="" disabled>{placeholder || "請選擇"}</option>
          {options.map((opt) => (
            <option key={opt} value={opt} className="text-slate-800 py-2 font-medium">
              {opt}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4">
          <div className="bg-white rounded-lg p-1.5 shadow-sm ring-1 ring-slate-100 group-hover:ring-violet-100 group-hover:text-violet-500 transition-all duration-300 text-slate-400">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>
      {error && <p className="text-xs font-bold text-rose-500 ml-1 animate-pulse">{error}</p>}
    </div>
  );
};