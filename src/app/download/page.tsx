'use client'
import { useState } from 'react'
import Link from 'next/link'
import {
  Windows, Apple, Android, Phone,
  Download, ArrowLeft, CheckCircle, Clock,
} from 'react-bootstrap-icons'

type Platform = 'windows' | 'macos' | 'android' | 'ios'

interface AppDownload {
  id: string
  name: string
  description: string
  version: string
  size: string
  color: string
  driveUrl: string | null
}

const downloads: Record<Platform, AppDownload[]> = {
  windows: [
    { id: 'zone',     name: 'ZOne Desktop',   description: 'Hub SSO — kelola semua akses dari satu tempat',     version: '1.0.0', size: '85 MB',  color: 'from-blue-500 to-purple-600',   driveUrl: null },
    { id: 'zpos',     name: 'ZPos',            description: 'Point of Sale serba guna untuk retail & toko',      version: '1.0.0', size: '92 MB',  color: 'from-orange-500 to-red-500',     driveUrl: null },
    { id: 'zgold',    name: 'ZGold',           description: 'POS perhiasan multi-logam emas, perak & berlian',   version: '1.0.0', size: '88 MB',  color: 'from-yellow-500 to-orange-500',  driveUrl: null },
    { id: 'zbengkel', name: 'ZBengkel',        description: 'Manajemen bengkel: work order, stok & kasir',       version: '1.0.0', size: '90 MB',  color: 'from-slate-500 to-slate-700',    driveUrl: null },
    { id: 'zbilliar', name: 'ZBilliar',        description: 'POS billiard: meja, timer & laporan harian',        version: '1.0.0', size: '78 MB',  color: 'from-green-600 to-emerald-700',  driveUrl: null },
    { id: 'zresto',   name: 'ZResto',          description: 'POS restoran lengkap: meja, shift & laporan',       version: '1.0.0', size: '95 MB',  color: 'from-red-500 to-rose-600',       driveUrl: null },
    { id: 'zface',    name: 'ZFace Desktop',   description: 'Server face recognition multi-tenant',              version: '1.0.0', size: '210 MB', color: 'from-cyan-500 to-blue-600',      driveUrl: null },
  ],
  macos: [
    { id: 'zone',   name: 'ZOne Desktop', description: 'Hub SSO — kelola semua akses dari satu tempat',   version: '1.0.0', size: '88 MB',  color: 'from-blue-500 to-purple-600',  driveUrl: null },
    { id: 'zpos',   name: 'ZPos',         description: 'Point of Sale serba guna untuk retail & toko',    version: '1.0.0', size: '95 MB',  color: 'from-orange-500 to-red-500',   driveUrl: null },
    { id: 'zgold',  name: 'ZGold',        description: 'POS perhiasan multi-logam emas, perak & berlian', version: '1.0.0', size: '91 MB',  color: 'from-yellow-500 to-orange-500',driveUrl: null },
    { id: 'zresto', name: 'ZResto',       description: 'POS restoran lengkap: meja, shift & laporan',     version: '1.0.0', size: '98 MB',  color: 'from-red-500 to-rose-600',     driveUrl: null },
    { id: 'zface',  name: 'ZFace Desktop','description': 'Server face recognition multi-tenant',          version: '1.0.0', size: '215 MB', color: 'from-cyan-500 to-blue-600',    driveUrl: null },
  ],
  android: [
    { id: 'zone',      name: 'ZOne Mobile',  description: 'SSO hub: login QR, Face ID & kelola akun',         version: '1.0.0', size: '24 MB', color: 'from-blue-500 to-purple-600',  driveUrl: null },
    { id: 'zabsen',    name: 'ZAbsen',       description: 'Absensi & HR management karyawan',                  version: '1.0.0', size: '18 MB', color: 'from-teal-500 to-cyan-600',    driveUrl: null },
    { id: 'zresto',    name: 'ZResto',       description: 'Aplikasi order menu & kasir mobile',                version: '1.0.0', size: '22 MB', color: 'from-red-500 to-rose-600',     driveUrl: null },
    { id: 'zrooms',    name: 'ZRooms',       description: 'Booking workspace & penginapan',                    version: '1.0.0', size: '16 MB', color: 'from-violet-500 to-purple-600',driveUrl: null },
    { id: 'zwisata',   name: 'ZWisata',      description: 'Manajemen wisata & laporan pendapatan',             version: '1.0.0', size: '19 MB', color: 'from-emerald-500 to-green-600',driveUrl: null },
    { id: 'ztransport',name: 'ZTransport',   description: 'POS tiket bus & travel, QR boarding',              version: '1.0.0', size: '21 MB', color: 'from-sky-500 to-blue-600',     driveUrl: null },
  ],
  ios: [
    { id: 'zone',   name: 'ZOne Mobile', description: 'SSO hub: login QR, Face ID & kelola akun',  version: '1.0.0', size: '28 MB', color: 'from-blue-500 to-purple-600',  driveUrl: null },
    { id: 'zabsen', name: 'ZAbsen',      description: 'Absensi & HR management karyawan',           version: '1.0.0', size: '22 MB', color: 'from-teal-500 to-cyan-600',    driveUrl: null },
    { id: 'zresto', name: 'ZResto',      description: 'Aplikasi order menu & kasir mobile',         version: '1.0.0', size: '26 MB', color: 'from-red-500 to-rose-600',     driveUrl: null },
    { id: 'zrooms', name: 'ZRooms',      description: 'Booking workspace & penginapan',             version: '1.0.0', size: '20 MB', color: 'from-violet-500 to-purple-600',driveUrl: null },
  ],
}

const platformMeta: { id: Platform; label: string; icon: React.ReactNode; sub: string }[] = [
  { id: 'windows', label: 'Windows',  icon: <Windows size={18} />,  sub: 'Windows 10 / 11' },
  { id: 'macos',   label: 'macOS',    icon: <Apple size={18} />,    sub: 'macOS 12+' },
  { id: 'android', label: 'Android',  icon: <Android size={18} />,  sub: 'Android 9+' },
  { id: 'ios',     label: 'iOS',      icon: <Phone size={18} />,    sub: 'iOS 15+' },
]

export default function DownloadPage() {
  const [active, setActive] = useState<Platform>('windows')
  const apps = downloads[active]

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4 py-8 pt-safe pb-safe">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Link href="/login"
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors text-slate-400 hover:text-white">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-xl font-bold">Unduh Aplikasi</h1>
            <p className="text-xs text-slate-400 mt-0.5">Ekosistem Zomet — semua platform</p>
          </div>
        </div>

        {/* Platform tabs */}
        <div className="grid grid-cols-4 gap-1.5 mb-8 bg-slate-800/50 p-1.5 rounded-2xl">
          {platformMeta.map(p => (
            <button key={p.id} onClick={() => setActive(p.id)}
              className={`flex flex-col items-center gap-1 py-3 rounded-xl text-xs font-medium transition-all ${
                active === p.id
                  ? 'bg-slate-700 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}>
              {p.icon}
              <span>{p.label}</span>
              <span className={`text-[10px] ${active === p.id ? 'text-slate-400' : 'text-slate-600'}`}>{p.sub}</span>
            </button>
          ))}
        </div>

        {/* Notice: semua coming soon */}
        <div className="flex items-center gap-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 mb-6 text-amber-300 text-xs">
          <Clock size={15} className="shrink-0" />
          <span>Aplikasi native sedang dalam pengembangan. Link unduhan akan aktif saat rilis.</span>
        </div>

        {/* App list */}
        <div className="space-y-3">
          {apps.map(app => (
            <div key={app.id}
              className="flex items-center gap-4 bg-slate-800/60 border border-slate-700/50 rounded-2xl px-4 py-4 hover:border-slate-600 transition-colors">
              {/* Icon */}
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${app.color} flex items-center justify-center shrink-0`}>
                <span className="text-white font-bold text-sm">{app.name.replace('Z', '').replace(' Desktop', '').replace(' Mobile', '').slice(0, 2) || 'Z'}</span>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{app.name}</p>
                <p className="text-xs text-slate-400 truncate mt-0.5">{app.description}</p>
                <p className="text-[11px] text-slate-600 mt-1">v{app.version} · {app.size}</p>
              </div>

              {/* Download button */}
              {app.driveUrl ? (
                <a href={app.driveUrl} target="_blank" rel="noopener noreferrer"
                  className="shrink-0 flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-colors">
                  <Download size={13} />
                  Unduh
                </a>
              ) : (
                <div className="shrink-0 flex items-center gap-1.5 bg-slate-700/50 text-slate-500 text-xs font-medium px-4 py-2.5 rounded-xl cursor-not-allowed select-none border border-slate-600/30">
                  <Clock size={13} />
                  Segera
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer info */}
        <div className="mt-8 p-4 bg-slate-800/30 rounded-2xl border border-slate-700/30">
          <p className="text-xs text-slate-400 text-center leading-relaxed">
            Semua aplikasi Zomet juga tersedia sebagai <strong className="text-slate-300">Web App</strong> — dapat diakses langsung dari browser tanpa perlu install.
            Kunjungi <Link href="/dashboard" className="text-blue-400 underline underline-offset-2">dashboard</Link> untuk mengakses semua app.
          </p>
        </div>

        <p className="mt-6 text-center text-[11px] text-slate-700">
          © {new Date().getFullYear()} PT Zomet Teknologi Indonesia · v1.0
        </p>

      </div>
    </div>
  )
}
