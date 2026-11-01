import * as React from 'react'

import { cn } from '@/lib/utils'

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
         'placeholder:text-(--ink-tertiary) selection:bg-(--accent-primary-tint) selection:text-(--accent-primary) border-(--border-hairline) h-10 w-full min-w-0 rounded-(--radius-md) border bg-(--bg-surface) px-3.5 py-1 text-base shadow-[inset_0_1px_2px_color-mix(in_oklch,var(--ink-primary)_5%,transparent)] transition-[border-color,box-shadow,background-color] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        'focus-visible:border-(--accent-primary)/55 focus-visible:ring-(--accent-primary)/15 focus-visible:ring-[3px]',
        'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
