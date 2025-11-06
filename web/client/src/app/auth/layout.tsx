import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Authentication - TaskFlow',
  description: 'Login or create an account to get started',
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      {children}
    </div>
  )
}