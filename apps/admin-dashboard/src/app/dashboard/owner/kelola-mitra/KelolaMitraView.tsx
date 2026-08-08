'use client'

import { useState } from 'react'
import { MitraFormDialog } from './MitraFormDialog'
import { TransferUploadDialog } from './TransferUploadDialog'
import { SaranInbox } from './SaranInbox'
import { Users, Upload, MessageSquare } from 'lucide-react'

export function KelolaMitraView({ mitraProfiles, suggestions, allUsers, allOutlets }: any) {
  const [activeTab, setActiveTab] = useState<'daftar' | 'saran'>('daftar')
  const [isMitraFormOpen, setIsMitraFormOpen] = useState(false)
  const [isTransferFormOpen, setIsTransferFormOpen] = useState(false)
  const [editMitraData, setEditMitraData] = useState<any>(null)

  const handleEdit = (mitra: any) => {
    setEditMitraData(mitra)
    setIsMitraFormOpen(true)
  }

  const handleAdd = () => {
    setEditMitraData(null)
    setIsMitraFormOpen(true)
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Kelola Mitra</h1>
          <p className="text-gray-500">Manajemen akses outlet mitra, investasi, dan transfer bulanan.</p>
        </div>
        
        <div className="flex space-x-3">
          <button 
            onClick={() => setIsTransferFormOpen(true)}
            className="flex items-center px-4 py-2 bg-white border text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload Transfer
          </button>
          <button 
            onClick={handleAdd}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
          >
            <Users className="w-4 h-4 mr-2" />
            Tambah Mitra
          </button>
        </div>
      </div>

      <div className="bg-white border rounded-xl overflow-hidden mb-6">
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('daftar')}
            className={`flex-1 py-3 px-4 text-center font-medium transition-colors ${
              activeTab === 'daftar' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            Daftar Mitra
          </button>
          <button
            onClick={() => setActiveTab('saran')}
            className={`flex-1 py-3 px-4 text-center font-medium transition-colors flex items-center justify-center ${
              activeTab === 'saran' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <MessageSquare className="w-4 h-4 mr-2" />
            Kotak Saran
            {suggestions.filter((s: any) => s.status === 'baru').length > 0 && (
              <span className="ml-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                {suggestions.filter((s: any) => s.status === 'baru').length}
              </span>
            )}
          </button>
        </div>
      </div>

      {activeTab === 'daftar' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {mitraProfiles.map((mitra: any) => {
            const staffUser = allUsers.find((u: any) => u.id === mitra.user_id)
            return (
              <div key={mitra.id || mitra.user_id} className="bg-white border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-lg">{mitra.nama_mitra}</h3>
                    <div className="text-sm text-gray-500 mt-1">
                      User Akun: {staffUser ? `${staffUser.name} (@${staffUser.username})` : `ID: ${mitra.user_id?.substring(0, 8)}...`}
                    </div>
                  </div>
                </div>
              
              <div className="mb-4">
                <div className="text-xs font-semibold text-gray-500 mb-2 uppercase">Akses Outlet ({mitra.outlet_ids?.length || 0})</div>
                <div className="flex flex-wrap gap-2">
                  {mitra.outlet_ids?.map((oid: string) => {
                    const outlet = allOutlets.find((o: any) => o.id === oid)
                    return (
                      <span key={oid} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded border">
                        {outlet?.name || 'Unknown Outlet'}
                      </span>
                    )
                  })}
                </div>
              </div>
              
              <button 
                onClick={() => handleEdit(mitra)}
                className="w-full py-2 bg-gray-50 text-gray-700 border hover:bg-gray-100 font-medium rounded-lg transition-colors text-sm"
              >
                Edit Akses & Info
              </button>
            </div>
          )
        })}
          {mitraProfiles.length === 0 && (
            <div className="col-span-full text-center p-12 bg-white border rounded-xl text-gray-500">
              Belum ada profil mitra terdaftar.
            </div>
          )}
        </div>
      )}

      {activeTab === 'saran' && (
        <SaranInbox suggestions={suggestions} />
      )}

      <MitraFormDialog 
        isOpen={isMitraFormOpen} 
        onClose={() => setIsMitraFormOpen(false)} 
        users={allUsers}
        outlets={allOutlets}
        initialData={editMitraData}
      />
      
      <TransferUploadDialog 
        isOpen={isTransferFormOpen} 
        onClose={() => setIsTransferFormOpen(false)}
        outlets={allOutlets}
      />
    </div>
  )
}
