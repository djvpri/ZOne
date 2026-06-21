'use client'
import dynamic from 'next/dynamic'

const ManageContent = dynamic(() => import('./ManageContent'), {
  ssr: false,
  loading: () => (
    <div className="min-h-[100dvh] flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  ),
})

export default function ManagePage() {
  return <ManageContent />
}
