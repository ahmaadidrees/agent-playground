import React from 'react'
import { motion } from 'framer-motion'
import { AlertCircle } from 'lucide-react'

interface LayoutProps {
  sidebar: React.ReactNode
  children: React.ReactNode
  errorMessage: string | null
  noticeMessage?: string | null
  topbar?: React.ReactNode
}

export const Layout: React.FC<LayoutProps> = ({ sidebar, children, errorMessage, noticeMessage, topbar }) => {
  return (
    <div className="flex h-screen bg-[#fdfaf5] text-amber-950 overflow-hidden font-sans selection:bg-amber-500/30">
      {/* Sidebar */}
      {sidebar}

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 min-h-0 relative">
        {topbar && (
          <div className="px-8 pt-6 flex-shrink-0">
            {topbar}
          </div>
        )}
        <div className="flex-1 min-h-0 overflow-hidden px-8 pb-8 pt-6 custom-scrollbar relative z-0">
          <div className="max-w-[1600px] mx-auto h-full min-h-0 flex flex-col gap-8">
            {children}
          </div>
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-3 px-6 py-4 bg-rose-500 text-white rounded-2xl shadow-2xl z-[100]"
          >
            <AlertCircle className="w-5 h-5" />
            <span className="text-sm font-bold">{errorMessage}</span>
          </motion.div>
        )}

        {noticeMessage && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 flex items-center gap-3 px-6 py-4 bg-amber-500 text-white rounded-2xl shadow-2xl z-[100]"
          >
            <AlertCircle className="w-5 h-5" />
            <span className="text-sm font-bold">{noticeMessage}</span>
          </motion.div>
        )}
      </main>
    </div>
  )
}
