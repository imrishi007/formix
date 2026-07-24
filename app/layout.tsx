import React from "react"
import type { Metadata } from 'next'
import { Instrument_Sans, Instrument_Serif, JetBrains_Mono, Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
<<<<<<< HEAD
=======
import { ThemeProvider } from '@/components/theme-provider'
import { AuthProvider } from '@/lib/auth-context'
import { Toaster } from '@/components/ui/sonner'
>>>>>>> f6620dd (Complete Formix updates)
import './globals.css'

const instrumentSans = Instrument_Sans({ 
  subsets: ["latin"],
  variable: '--font-instrument'
});

const instrumentSerif = Instrument_Serif({ 
  subsets: ["latin"],
  weight: "400",
  variable: '--font-instrument-serif'
});

const jetbrainsMono = JetBrains_Mono({ 
  subsets: ["latin"],
  variable: '--font-jetbrains'
});

const inter = Inter({
  subsets: ["latin"],
  variable: '--font-inter'
});

export const metadata: Metadata = {
  title: 'Formix — Forms as Code',
  description: 'Define forms in a custom DSL, version-control them in Git, and render live interactive UIs with an AI generation layer. No drag-and-drop. No JSON configs.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
<<<<<<< HEAD
    <html lang="en">
      <body className={`${instrumentSans.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable} ${inter.variable} font-sans antialiased`}>
        {children}
=======
    <html lang="en" suppressHydrationWarning>
      <body className={`${instrumentSans.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable} ${inter.variable} font-sans antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="dark" forcedTheme="dark" disableTransitionOnChange>
          <AuthProvider>
            {children}
            <Toaster />
          </AuthProvider>
        </ThemeProvider>
>>>>>>> f6620dd (Complete Formix updates)
        <Analytics />
      </body>
    </html>
  )
}
