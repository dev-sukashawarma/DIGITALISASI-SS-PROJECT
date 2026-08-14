import { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes } from 'react'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
}

export interface CardProps extends HTMLAttributes<HTMLDivElement> {}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'success' | 'warning' | 'error' | 'info'
}
