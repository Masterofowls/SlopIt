import React from 'react';

const Input = ({
  type = 'text',
  placeholder = '',
  value,
  onChange,
  label = '',
  error = '',
  required = false,
  name = '',
  disabled = false
}) => {
  const isControlled = value !== undefined;
  const inputValue = isControlled ? value : undefined;
  
  return (
    <div className="input-group">
      {label && (
        <label htmlFor={name} className="input-label">
          {label} {required && <span className="required">*</span>}
        </label>
      )}
      <input
        type={type}
        id={name}
        name={name}
        placeholder={placeholder}
        {...(isControlled ? { value: inputValue, onChange } : { defaultValue: '' })}
        disabled={disabled}
        className={`input-field ${error ? 'input-error' : ''}`}
        required={required}
      />
      {error && <span className="input-error-message">{error}</span>}
    </div>
  );
};

export default Input;