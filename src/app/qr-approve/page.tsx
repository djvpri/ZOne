'use client'
import { Suspense } from 'react'
import QrApproveClient from './QrApproveClient'

export default function QrApprovePage() {
  return (
    <Suspense fallback={
      <div className="min-h-dvh flex items-center justify-center bg-slate-900">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <QrApproveClient />
    </Suspense>
  )
}
