'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Halaman lama, diganti oleh /manage (lebih ringan & terbukti stabil).
// Redirect biar link/bookmark lama nggak 404.
export default function ControlPanelRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/manage') }, [router])
  return null
}
