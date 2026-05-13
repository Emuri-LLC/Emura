import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Emura — Manufacturing Cost Estimator',
  description: 'Manufacturing cost estimation for contract manufacturers',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  )
}
