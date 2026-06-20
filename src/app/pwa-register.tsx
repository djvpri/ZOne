'use client'

import { useEffect, useState } from 'react'

export function PWARegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
  }, [])

  return null
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<any>(null)
  const [show, setShow] = useState(false)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault()
      setDeferred(e)
      setShow(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    
    window.addEventListener('appinstalled', () => {
      setInstalled(true)
      setShow(false)
    })

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [])

  if (installed) return null

  const handleInstall = async () => {
    if (!deferred) return
    deferred.prompt()
    const { outcome } = await deferred.userChoice
    if (outcome === 'accepted') {
      setInstalled(true)
      setShow(false)
    }
    setDeferred(null)
  }

  if (!show) return null

  return (
    <div className="fixed bottom-24 left-4 right-4 z-50 sm:hidden">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
            <span className="text-xl font-bold">Z</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm">Install Z One</div>
            <div className="text-xs text-slate-400">Akses cepat dari homescreen</div>
          </div>
          <button onClick={handleInstall}
            className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors">
            Install
          </button>
          <button onClick={() => setShow(false)}
            className="text-slate-400 hover:text-white p-1">
            ✕
          </button>
        </div>
      </div>
    </div>
  )
}
