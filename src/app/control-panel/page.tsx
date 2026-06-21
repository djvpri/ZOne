'use client'
import dynamic from 'next/dynamic'

// Konten panel admin di-load HANYA di browser (ssr: false), bukan di-stream dari
// server. Halaman ini lumayan berat (banyak data, banyak komponen) — beberapa
// jaringan/ISP punya proxy kompresi yang kadang merusak respons HTML besar/streaming.
// Dengan ssr:false, server cuma kirim shell kosong + JS, sisanya dirender di HP.
const ControlPanelContent = dynamic(() => import('./ControlPanelContent'), {
  ssr: false,
  loading: () => (
    <div className="min-h-[100dvh] flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  ),
})

export default function ControlPanelPage() {
  return <ControlPanelContent />
}
