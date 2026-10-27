'use client'
import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

/**
 * Halaman persetujuan device-code SSO untuk app Android.
 * User sudah login di Z One, membuka /link?code=XXXX-XXXX, lalu menyetujui
 * supaya kode itu ditukar jadi sesi di app.
 */
function LinkContent() {
  const searchParams = useSearchParams()
  const code = (searchParams.get('code') || '').toUpperCase().trim()
  const [state, setState] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (!code) {
      setState('error')
      setMsg('Kode tidak ada di tautan. Minta ulang dari aplikasi.')
    }
  }, [code])

  async function approve() {
    setState('loading')
    try {
      const res = await fetch('/api/sso/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.ok) {
        setState('ok')
      } else {
        setState('error')
        setMsg(data.error || 'Gagal menghubungkan perangkat.')
      }
    } catch {
      setState('error')
      setMsg('Tidak dapat menghubungi server.')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border p-6 text-center">
        {state === 'ok' ? (
          <>
            <div className="text-4xl mb-3">✅</div>
            <p className="font-semibold text-gray-900 mb-1">Perangkat terhubung</p>
            <p className="text-sm text-gray-500">
              Kembali ke aplikasi AcuMedis di HP kamu. Proses masuk selesai otomatis dalam beberapa detik.
            </p>
          </>
        ) : state === 'error' ? (
          <>
            <div className="text-4xl mb-3">⚠️</div>
            <p className="font-semibold text-gray-900 mb-1">Tidak bisa diproses</p>
            <p className="text-sm text-gray-500 mb-4">{msg}</p>
            <a href="/dashboard" className="text-teal-600 text-sm underline">
              Kembali ke Z One
            </a>
          </>
        ) : (
          <>
            <p className="text-xs font-semibold tracking-wide text-gray-400 uppercase mb-2">
              Masuk ke AcuMedis
            </p>
            <p className="text-2xl font-bold tracking-[0.2em] text-gray-900 mb-1">{code || '----'}</p>
            <p className="text-sm text-gray-500 mb-6">
              Pastikan kode ini sama dengan yang tampil di aplikasi AcuMedis, lalu setujui.
            </p>
            <button
              onClick={approve}
              disabled={!code || state === 'loading'}
              className="w-full h-12 rounded-xl bg-teal-700 text-white font-semibold disabled:opacity-50"
            >
              {state === 'loading' ? 'Menghubungkan…' : 'Hubungkan perangkat ini'}
            </button>
            <p className="text-[11px] text-gray-400 mt-4">
              Hanya lakukan ini kalau kamu sendiri yang meminta kode dari aplikasi.
            </p>
          </>
        )}
      </div>
    </div>
  )
}

export default function LinkPage() {
  return (
    <Suspense fallback={null}>
      <LinkContent />
    </Suspense>
  )
}
