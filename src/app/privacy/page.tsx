import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Kebijakan Privasi — ZShield',
  description: 'Kebijakan privasi aplikasi ZShield (pemeriksa keamanan tautan). Data apa yang diproses dan bagaimana dikirim.',
}

const noData: [string, string][] = [
  ['Akun pengguna', 'Tidak dibuat — app berjalan tanpa login'],
  ['Lokasi', 'Tidak diakses'],
  ['Kontak / media / foto', 'Tidak diakses'],
  ['Riwayat telepon / aplikasi lain', 'Tidak diakses'],
  ['Iklan / pelacak pihak ketiga', 'Tidak ada'],
  ['Data biometrik', 'Tidak digunakan'],
]

export default function PrivacyPage() {
  const yr = new Date().getFullYear()
  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/download"
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors text-slate-400 hover:text-white">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white">Kebijakan Privasi</h1>
            <p className="text-xs text-teal-400 mt-0.5">ZShield — Pemeriksa Keamanan Tautan</p>
          </div>
        </div>

        <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6 space-y-6 text-sm text-slate-300 leading-relaxed">
          <p className="text-xs text-slate-400">Terakhir diperbarui: 7 Agustus 2026</p>

          <section>
            <h2 className="text-base font-bold text-white mb-2">Ringkasan</h2>
            <p>ZShield tidak mengumpulkan data pribadi yang dapat mengidentifikasi Anda. Aplikasi dapat dipakai langsung tanpa membuat akun.</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-3">Data yang Tidak Dikumpulkan</h2>
            <div className="overflow-hidden rounded-xl border border-slate-700/40">
              {noData.map(([k, v], i) => (
                <div key={k} className={`flex justify-between gap-4 px-4 py-2.5 ${i % 2 ? 'bg-slate-800/40' : ''}`}>
                  <span className="font-medium text-slate-200">{k}</span>
                  <span className="text-right text-slate-400">{v}</span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">Data yang Diproses</h2>
            <p>Saat Anda memindai sebuah tautan, ZShield mengirimkan <strong className="text-slate-100">URL tersebut</strong> ke server backend
              (<code className="text-teal-300 break-all">zsafebackend-production.up.railway.app</code>) melalui koneksi HTTPS terenkripsi. Server
              meneruskan URL itu ke <strong className="text-slate-100">Google Safe Browsing</strong> dan pemeriksaan heuristik lokal untuk menentukan
              status keamanannya.</p>
            <ul className="mt-3 space-y-2 pl-1">
              <li className="flex gap-2"><span className="text-teal-400">•</span>URL yang Anda pindai hanya dipakai untuk pemeriksaan keamanan.</li>
              <li className="flex gap-2"><span className="text-teal-400">•</span>Kami tidak menyimpan riwayat URL yang dipindai.</li>
              <li className="flex gap-2"><span className="text-teal-400">•</span>Hasil pemeriksaan ditampilkan kepada Anda dan tidak dibagikan ke pihak lain.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">Penyimpanan Lokal</h2>
            <p>ZShield menyimpan preferensi di perangkat Anda (SharedPreferences), misalnya alamat server yang diatur di layar Setelan. Data ini tidak dikirim ke kami.</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">Berbagi Data</h2>
            <p>ZShield tidak menjual, menyewakan, atau membagikan data Anda dengan pihak ketiga, kecuali URL yang Anda pindai dikirim ke Google Safe Browsing untuk pemeriksaan keamanan (fungsi inti aplikasi).</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">Izin yang Digunakan</h2>
            <ul className="space-y-2 pl-1">
              <li className="flex gap-2"><span className="text-teal-400">•</span><code className="text-slate-200">INTERNET</code> — mengirim URL ke backend dan menerima hasil pemeriksaan.</li>
              <li className="flex gap-2"><span className="text-teal-400">•</span><code className="text-slate-200">ACCESS_NETWORK_STATE</code> — memeriksa koneksi jaringan sebelum memindai.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">Perubahan Kebijakan</h2>
            <p>Kebijakan ini dapat berubah sewaktu-waktu. Perubahan signifikan dicantumkan pada halaman ini dengan tanggal pembaruan baru.</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">Kontak</h2>
            <p>Untuk pertanyaan privasi, hubungi dukungan ekosistem Z melalui kanal resmi.</p>
          </section>
        </div>

        <p className="mt-6 text-center text-[11px] text-slate-600">
          © {yr} PT Zomet Teknologi Indonesia · ZShield
        </p>
      </div>
    </div>
  )
}
