// src/components/AuthLayout.tsx
import React from 'react'
import heroBg from '../../assets/bg-1.jpg'

const BRAND = 'Spurs'

type Props = {
  children: React.ReactNode
  heroTitle?: React.ReactNode
  heroText?: string
  image?:string
}

const AuthLayout = ({
  children,
  image = heroBg,
  heroTitle = (
    <>
      One account.<br />Every {BRAND} app.
    </>
  ),
  heroText = 'Sign in once and move between your apps securely, without juggling passwords.',
}: Props) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 min-h-screen bg-primary">
      {/* Left: hero */}
      <div
        className="relative hidden md:block overflow-hidden shadow-lg bg-cover bg-center"
        style={{ backgroundImage: `url(${image})` }}
      >
        <div
          className="absolute inset-0 backdrop-blur-xl"
          style={{
            WebkitMaskImage: 'linear-gradient(to bottom, transparent 20%, black 80%)',
            maskImage: 'linear-gradient(to bottom, transparent 20%, black 80%)',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

        <div className="relative z-10 flex h-full flex-col justify-end gap-3 p-10 text-white">
          <span className="text-sm font-medium uppercase tracking-widest opacity-80">
            {BRAND} Account
          </span>
          <h1 className="text-4xl font-semibold leading-tight">{heroTitle}</h1>
          <p className="max-w-sm text-base opacity-90">{heroText}</p>
        </div>
      </div>

      {/* Right: page content */}
      <div className="mx-auto flex w-full max-w-md flex-col justify-center px-6 py-10">
        {children}
      </div>
    </div>
  )
}

export default AuthLayout