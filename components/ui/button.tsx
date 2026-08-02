import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  // Tailwind v4: CSS custom properties use () not [] syntax: bg-(--var) not bg-(--var)
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all duration-150 ease-out disabled:pointer-events-none disabled:opacity-40 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-(--accent-primary)/50 focus-visible:ring-offset-2",
  {
    variants: {
      variant: {
        // Accent fill + themed shadow via tokens (blue in light, glow in dark).
        // Text uses --on-accent (white in light, text-primary in dark per
        // design.md §Buttons) so the fill/ink contrast stays correct both ways.
        default:
          'bg-(--accent-primary) text-(--on-accent) font-[500] shadow-(--shadow-btn-primary) hover:bg-(--accent-primary-hover) hover:shadow-(--shadow-btn-primary-hover) hover:scale-[1.02] active:scale-[0.98]',
        destructive:
          'bg-(--accent-danger) text-white hover:opacity-90 active:scale-[0.98]',
        // Transparent at rest, --bg-subtle on hover
        outline:
          'border border-(--border-hairline-strong) bg-transparent text-(--ink-primary) hover:bg-(--bg-subtle) active:scale-[0.98]',
        secondary:
          'bg-(--bg-subtle) text-(--ink-primary) hover:opacity-80',
        ghost:
          'text-(--ink-primary) hover:bg-(--bg-subtle)',
        link:
          'text-(--accent-primary) underline-offset-4 hover:underline',
      },
      size: {
        // Radius-md (14px) on all button sizes — pills (9999px) are badges/chips only
        default: 'h-11 px-5 py-2 rounded-(--radius-md)',
        sm:      'h-9 gap-1.5 px-4 rounded-(--radius-md)',
        lg:      'h-14 px-8 rounded-(--radius-md)',
        icon:    'size-9 rounded-(--radius-sm)',
        'icon-sm': 'size-8 rounded-(--radius-sm)',
        'icon-lg': 'size-10 rounded-(--radius-sm)',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
