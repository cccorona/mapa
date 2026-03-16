import type { Metadata } from 'next'
import { Cormorant_Garamond, DM_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-cormorant',
})

const dmMono = DM_Mono({
  subsets: ['latin'],
  weight: ['300', '400'],
  variable: '--font-dm-mono',
})

const SITE_URL = 'https://cartografiaoculta.city'
const OG_IMAGE_URL = `${SITE_URL}/og.jpg`

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Mapa de Observaciones',
  description: 'Cartografía de momentos irreversibles',
  generator: 'v0.app',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'es_MX',
    url: SITE_URL,
    siteName: 'Mapa de Observaciones',
    title: 'Mapa de Observaciones',
    description: 'Cartografía de momentos irreversibles',
    images: [
      { url: OG_IMAGE_URL, width: 1200, height: 630, alt: 'Mapa de Observaciones - Cartografía oculta' },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Mapa de Observaciones',
    description: 'Cartografía de momentos irreversibles',
    images: [OG_IMAGE_URL],
  },
}

export const viewport = {
  themeColor: '#0d1117',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" className={`${cormorant.variable} ${dmMono.variable}`}>
      <body className="font-serif antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  )
}
