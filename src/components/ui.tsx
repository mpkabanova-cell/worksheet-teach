import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'
import chevronIcon from '@/assets/create/chevron.svg'
import './ui.css'

type Variant = 'brand' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'danger-soft'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: 'sm' | 'md' | 'lg'
  children: ReactNode
}

export function Button({
  variant = 'brand',
  size = 'md',
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button className={`btn btn-${variant} btn-${size} ${className}`} {...rest}>
      {children}
    </button>
  )
}

interface FieldProps {
  label: string
  required?: boolean
  children: ReactNode
  className?: string
}

export function Field({ label, required, children, className = '' }: FieldProps) {
  return (
    <label className={`field ${className}`}>
      <span className="field-label">
        {label}
        {required ? <span className="req">*</span> : null}
      </span>
      {children}
    </label>
  )
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options: string[]
  placeholder?: string
}

export function Select({ options, placeholder, className = '', ...rest }: SelectProps) {
  return (
    <div className={`select-wrap ${className}`}>
      <select className="input select" {...rest}>
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <span className="select-chevron" aria-hidden>
        <img src={chevronIcon} alt="" width={20} height={20} />
      </span>
    </div>
  )
}

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`input ${className}`} {...props} />
}

export function Textarea(
  props: TextareaHTMLAttributes<HTMLTextAreaElement> & { counter?: string },
) {
  const { counter, className = '', ...rest } = props
  return (
    <div className="textarea-wrap">
      <textarea className={`input textarea ${className}`} {...rest} />
      {counter ? <span className="counter">{counter}</span> : null}
    </div>
  )
}

interface ModalShellProps {
  open: boolean
  onClose?: () => void
  children: ReactNode
  width?: number
  className?: string
}

export function ModalShell({ open, onClose, children, width = 480, className = '' }: ModalShellProps) {
  if (!open) return null
  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className={`modal-card ${className}`}
        style={{ width }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {children}
      </div>
    </div>
  )
}

export function FigmaIcon({
  src,
  size = 20,
  className = '',
}: {
  src: string
  size?: number
  className?: string
}) {
  return (
    <span className={`figma-icon ${className}`} style={{ width: size, height: size }}>
      <img src={src} alt="" width={size} height={size} />
    </span>
  )
}

export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return (
    <span className={`icon icon-${name}`} style={{ width: size, height: size }} aria-hidden />
  )
}
