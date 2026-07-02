'use client'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { CashCoin, ClipboardData, Briefcase, CashStack, XLg } from 'react-bootstrap-icons'

type AffiliatePartner = {
  id: string; name: string; type: 'MITRA_LAPANGAN' | 'CUSTOMER_REFERRAL'
  referralCode: string; commissionRate: string; balance: string
  bankAccount: string | null; bankName: string | null; status: string; createdAt: string
  user?: { name: string; email: string; phone: string | null }
  transactions?: CommissionTransaction[]
}

type CommissionTransaction = {
  id: string; type: 'EARNED' | 'PAYOUT'; amount: string
  notes: string | null; createdAt: string
}

export default function AffiliatePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [affiliates, setAffiliates] = useState<AffiliatePartner[]>([])
  const [myAffiliate, setMyAffiliate] = useState<AffiliatePartner | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showTxModal, setShowTxModal] = useState(false)
  const [selAff, setSelAff] = useState<AffiliatePartner | null>(null)
  const [users, setUsers] = useState<any[]>([])

  const [form, setForm] = useState({
    userId: '', name: '', type: 'MITRA_LAPANGAN' as any,
    referralCode: '', commissionRate: '15', bankAccount: '', bankName: '',
  })
  const [txForm, setTxForm] = useState({ type: 'EARNED' as any, amount: '', notes: '' })

  const user = session?.user as any
  const isAdmin = user?.role === 'ADMIN'

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => { if (session) fetchData() }, [session])

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/affiliate')
      const data = await res.json()
      if (isAdmin) setAffiliates(data.affiliates || [])
      else setMyAffiliate(data.affiliate || null)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const rp = (a: string | number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(Number(a))
  const dt = (s: string) => new Date(s).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch('/api/affiliate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) { const d = await res.json(); alert(d.error); return }
      setShowCreateModal(false)
      setForm({ userId: '', name: '', type: 'MITRA_LAPANGAN', referralCode: '', commissionRate: '15', bankAccount: '', bankName: '' })
      fetchData()
    } catch { alert('Gagal') }
  }

  const handleTx = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selAff) return
    try {
      const res = await fetch('/api/affiliate/transaction', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ affiliatePartnerId: selAff.id, ...txForm }),
      })
      if (!res.ok) { const d = await res.json(); alert(d.error); return }
      setShowTxModal(false); setSelAff(null)
      setTxForm({ type: 'EARNED', amount: '', notes: '' })
      fetchData()
    } catch { alert('Gagal') }
  }

  if (status === 'loading' || loading) {
    return <div className="min-h-[100dvh] flex items-center justify-center"><div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
  }
  if (!session) return null

  return (
    <div className="min-h-[100dvh] pb-20">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/dashboard" className="text-slate-400 hover:text-white text-lg">←</a>
            <div>
              <h1 className="font-bold text-lg leading-tight flex items-center gap-1.5"><CashCoin size={17} /> Affiliate</h1>
              <p className="text-[11px] text-slate-400">Program Kemitraan</p>
            </div>
          </div>
          {isAdmin && (
            <button onClick={async () => {
              const r = await fetch('/api/admin/users'); const d = await r.json(); setUsers(d.users || [])
              setShowCreateModal(true)
            }} className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2 rounded-lg">
              + Tambah Mitra
            </button>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* User view */}
        {!isAdmin && myAffiliate && (
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl p-6 text-white">
              <div className="text-sm opacity-80 mb-1">Saldo Komisi</div>
              <div className="text-3xl font-bold">{rp(myAffiliate.balance)}</div>
              <div className="mt-4 flex items-center justify-between text-sm">
                <div>
                  <div className="opacity-80">Kode Referral</div>
                  <div className="font-mono font-bold">{myAffiliate.referralCode}</div>
                </div>
                <div className="text-right">
                  <div className="opacity-80">Rate Komisi</div>
                  <div className="font-bold">{myAffiliate.commissionRate}%</div>
                </div>
              </div>
            </div>
            <a
              href={`https://wa.me/6282153533164?text=${encodeURIComponent(
                `DAFTAR USER BARU\nKode Referral saya: ${myAffiliate.referralCode}\nNama Usaha: \nNama Pemilik: \nNo HP: \nJenis Usaha (ZPOS/ZGold/ZResto/dll): \nKota: `
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-green-600 hover:bg-green-500 text-white text-sm font-semibold text-center px-4 py-3 rounded-xl transition-colors"
            >
              <ClipboardData size={14} className="inline mr-1.5" />Daftarkan User Baru via WhatsApp
            </a>
            {myAffiliate.bankAccount && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="text-sm text-slate-400 mb-2">Info Rekening</div>
                <div className="text-white font-medium">{myAffiliate.bankName}</div>
                <div className="text-slate-300 font-mono">{myAffiliate.bankAccount}</div>
              </div>
            )}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <h3 className="font-semibold mb-3">Riwayat Transaksi</h3>
              {myAffiliate.transactions?.length ? (
                <div className="space-y-2">
                  {myAffiliate.transactions.map(tx => (
                    <div key={tx.id} className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-semibold ${tx.type === 'EARNED' ? 'text-green-400' : 'text-red-400'}`}>
                            {tx.type === 'EARNED' ? '+ ' : '- '}{rp(tx.amount)}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                            {tx.type === 'EARNED' ? 'Komisi' : 'Penarikan'}
                          </span>
                        </div>
                        {tx.notes && <div className="text-xs text-slate-400 mt-1">{tx.notes}</div>}
                      </div>
                      <div className="text-xs text-slate-500">{dt(tx.createdAt)}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500 text-sm">Belum ada transaksi</div>
              )}
            </div>
          </div>
        )}
        {!isAdmin && !myAffiliate && (
          <div className="text-center py-12">
            <Briefcase size={44} className="mb-4 mx-auto text-slate-600" />
            <p className="text-slate-400">Anda belum terdaftar sebagai mitra affiliate</p>
          </div>
        )}

        {/* Admin view */}
        {isAdmin && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="text-sm text-slate-400 mb-1">Total Mitra</div>
                <div className="text-2xl font-bold text-blue-400">{affiliates.length}</div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="text-sm text-slate-400 mb-1">Mitra Lapangan</div>
                <div className="text-2xl font-bold text-green-400">{affiliates.filter(a => a.type === 'MITRA_LAPANGAN').length}</div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="text-sm text-slate-400 mb-1">Customer Referral</div>
                <div className="text-2xl font-bold text-purple-400">{affiliates.filter(a => a.type === 'CUSTOMER_REFERRAL').length}</div>
              </div>
            </div>

            <div className="space-y-3">
              {affiliates.map(a => (
                <div key={a.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-white">{a.name}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          a.type === 'MITRA_LAPANGAN' ? 'bg-green-900/30 text-green-400' : 'bg-purple-900/30 text-purple-400'
                        }`}>{a.type === 'MITRA_LAPANGAN' ? 'Mitra Lapangan' : 'Customer Referral'}</span>
                      </div>
                      <div className="text-sm text-slate-400">{a.user?.email}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-blue-400">{rp(a.balance)}</div>
                      <div className="text-xs text-slate-500">Saldo</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    <div><div className="text-slate-500 text-xs mb-1">Kode</div><div className="font-mono font-semibold text-slate-300">{a.referralCode}</div></div>
                    <div><div className="text-slate-500 text-xs mb-1">Rate</div><div className="font-semibold text-slate-300">{a.commissionRate}%</div></div>
                    <div><div className="text-slate-500 text-xs mb-1">Bank</div><div className="text-slate-300">{a.bankName || '-'}</div></div>
                    <div><div className="text-slate-500 text-xs mb-1">Rekening</div><div className="text-slate-300 font-mono text-xs">{a.bankAccount || '-'}</div></div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => { setSelAff(a); setTxForm({ type: 'EARNED', amount: '', notes: '' }); setShowTxModal(true) }}
                      className="flex-1 bg-green-600 hover:bg-green-500 text-white text-sm font-semibold px-3 py-2 rounded-lg">+ Komisi</button>
                    <button onClick={() => { setSelAff(a); setTxForm({ type: 'PAYOUT', amount: a.balance, notes: '' }); setShowTxModal(true) }}
                      disabled={Number(a.balance) <= 0}
                      className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold px-3 py-2 rounded-lg flex items-center justify-center gap-1.5"><CashStack size={14} /> Bayar</button>
                  </div>
                  {a.transactions?.length ? (
                    <div className="mt-3 pt-3 border-t border-slate-800">
                      <div className="text-xs text-slate-500 mb-2">Transaksi Terakhir</div>
                      <div className="space-y-1">
                        {a.transactions.slice(0, 3).map(tx => (
                          <div key={tx.id} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <span className={tx.type === 'EARNED' ? 'text-green-400' : 'text-red-400'}>
                                {tx.type === 'EARNED' ? '+' : '-'}{rp(tx.amount)}
                              </span>
                              {tx.notes && <span className="text-slate-500">{tx.notes}</span>}
                            </div>
                            <span className="text-slate-600">{dt(tx.createdAt)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
              {!affiliates.length && (
                <div className="text-center py-12">
                  <Briefcase size={44} className="mb-4 mx-auto text-slate-600" />
                  <p className="text-slate-400 mb-4">Belum ada mitra affiliate</p>
                  <button onClick={async () => { const r = await fetch('/api/admin/users'); const d = await r.json(); setUsers(d.users || []); setShowCreateModal(true) }}
                    className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-6 py-3 rounded-lg">+ Tambah Mitra Pertama</button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setShowCreateModal(false)}>
          <div onClick={e => e.stopPropagation()} className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <h3 className="font-bold text-white">Tambah Mitra Affiliate</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white"><XLg size={18} /></button>
            </div>
            <form onSubmit={handleCreate} className="p-4 space-y-3">
              <div>
                <label className="block text-sm text-slate-400 mb-1">User</label>
                <select value={form.userId} onChange={e => { const u = users.find(uu => uu.id === e.target.value); setForm({ ...form, userId: e.target.value, name: u?.name || '' }) }} required
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white">
                  <option value="">Pilih user...</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Nama Mitra</label>
                <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Tipe</label>
                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white">
                  <option value="MITRA_LAPANGAN">Mitra Lapangan</option>
                  <option value="CUSTOMER_REFERRAL">Customer Referral</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Kode Referral</label>
                <input type="text" value={form.referralCode} onChange={e => setForm({ ...form, referralCode: e.target.value.toUpperCase() })} required placeholder="MITRA123"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Rate Komisi (%)</label>
                <input type="number" step="0.01" value={form.commissionRate} onChange={e => setForm({ ...form, commissionRate: e.target.value })} required
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Bank</label>
                <input type="text" value={form.bankName} onChange={e => setForm({ ...form, bankName: e.target.value })} placeholder="BCA / Mandiri"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">No. Rekening</label>
                <input type="text" value={form.bankAccount} onChange={e => setForm({ ...form, bankAccount: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono" />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowCreateModal(false)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold px-4 py-2 rounded-lg">Batal</button>
                <button type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2 rounded-lg">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transaction Modal */}
      {showTxModal && selAff && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setShowTxModal(false)}>
          <div onClick={e => e.stopPropagation()} className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <h3 className="font-bold text-white">{txForm.type === 'EARNED' ? 'Tambah Komisi' : 'Bayar Saldo'}</h3>
              <button onClick={() => setShowTxModal(false)} className="text-slate-400 hover:text-white"><XLg size={18} /></button>
            </div>
            <form onSubmit={handleTx} className="p-4 space-y-3">
              <div className="bg-slate-800 rounded-lg p-3 mb-3">
                <div className="text-sm text-slate-400">Mitra</div>
                <div className="font-semibold text-white">{selAff.name}</div>
                <div className="text-sm text-slate-500">Saldo: {rp(selAff.balance)}</div>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Tipe</label>
                <select value={txForm.type} onChange={e => setTxForm({ ...txForm, type: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white">
                  <option value="EARNED">Komisi (Tambah Saldo)</option>
                  <option value="PAYOUT">Pembayaran (Kurangi Saldo)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Nominal</label>
                <input type="number" step="1" value={txForm.amount} onChange={e => setTxForm({ ...txForm, amount: e.target.value })} required
                  placeholder="500000"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Catatan</label>
                <textarea value={txForm.notes} onChange={e => setTxForm({ ...txForm, notes: e.target.value })} rows={3}
                  placeholder="ZGold - Toko Emas Jaya - Juni 2026"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white resize-none" />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowTxModal(false)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold px-4 py-2 rounded-lg">Batal</button>
                <button type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2 rounded-lg">{txForm.type === 'EARNED' ? 'Tambah' : 'Bayar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
