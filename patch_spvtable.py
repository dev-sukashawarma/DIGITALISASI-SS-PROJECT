import re

with open('apps/stok/src/components/monitoring/SPVTable.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    '<div className="overflow-x-auto border border-suka-brown/10 rounded-xl shadow-sm bg-white">',
    '<div className="hidden md:block overflow-x-auto border border-suka-brown/10 rounded-xl shadow-sm bg-white">',
    2
)

content = content.replace(
    '<th className="p-4 text-right">Stok Saat Ini</th>',
    '<th className="p-4 text-right">Sat. Besar</th>\\n              <th className="p-4 text-right">Sat. Kecil</th>'
)

target_alerts_cell = \"\"\"                            <td className={p-4 font-bold text-sm text-right }>
                              {large} <span className="text-[10px] font-normal opacity-70">{item.satuan || 'kg'}</span>
                              {item.satuan_kecil && small > 0 && (
                                <> <span className="opacity-50">•</span> {small} <span className="text-[10px] font-normal opacity-70">{item.satuan_kecil}</span></>
                              )}
                            </td>\"\"\"

replacement_alerts_cell = \"\"\"                            <td className={p-4 font-bold text-sm text-right }>
                              {large} <span className="text-[10px] font-normal opacity-70">{item.satuan || 'kg'}</span>
                            </td>
                            <td className={p-4 font-bold text-sm text-right }>
                              {item.satuan_kecil ? (
                                <>{small} <span className="text-[10px] font-normal opacity-70">{item.satuan_kecil}</span></>
                              ) : '-'}
                            </td>\"\"\"
content = content.replace(target_alerts_cell, replacement_alerts_cell)

target_overview_cell = \"\"\"                    <td className={p-4 font-bold text-sm text-right }>
                      {large} <span className="text-[10px] font-normal opacity-70">{item.satuan || 'kg'}</span>
                      {item.satuan_kecil && small > 0 && (
                        <> <span className="opacity-50">•</span> {small} <span className="text-[10px] font-normal opacity-70">{item.satuan_kecil}</span></>
                      )}
                    </td>\"\"\"

replacement_overview_cell = \"\"\"                    <td className={p-4 font-bold text-sm text-right }>
                      {large} <span className="text-[10px] font-normal opacity-70">{item.satuan || 'kg'}</span>
                    </td>
                    <td className={p-4 font-bold text-sm text-right }>
                      {item.satuan_kecil ? (
                        <>{small} <span className="text-[10px] font-normal opacity-70">{item.satuan_kecil}</span></>
                      ) : '-'}
                    </td>\"\"\"
content = content.replace(target_overview_cell, replacement_overview_cell)

mobile_view = \"\"\"      {/* Mobile Card View (< md) */}
      <div className="md:hidden space-y-3 mt-4">
        {filteredItems.length === 0 ? (
          <div className="text-center py-8 text-suka-brown/50 text-sm bg-white rounded-xl border border-suka-brown/10">
            Tidak ada data bahan baku ditemukan
          </div>
        ) : (
          (() => {
            const renderCard = (item: MonitoringItem) => {
              const editKey = ${item.outlet_id}-;
              const isEditing = editingId === editKey;
              const { large, small } = (() => {
                if (!item.faktor_tampilan || !item.satuan_kecil) return { large: item.current_qty, small: 0 };
                let whole = Math.trunc(item.current_qty);
                const remainderRaw = (item.current_qty - whole) * item.faktor_tampilan;
                let remainder = Math.round(remainderRaw * 100) / 100;
                if (Math.abs(remainder) >= item.faktor_tampilan) {
                  whole += Math.sign(remainder);
                  remainder = 0;
                }
                return { large: whole, small: Math.abs(remainder) };
              })();
              const statusColor = item.status === 'below' ? 'text-red-600' : item.status === 'warning' ? 'text-orange-600' : 'text-green-700';

              return (
                <div key={editKey} className="p-4 rounded-xl border flex flex-col min-h-[135px] transition-all duration-200 border-[#d9c2b2]/45 bg-white shadow-[0px_4px_12px_rgba(144,77,0,0.03)] hover:border-[#f29744]/45" onClick={() => onRowClick(item)}>
                  <div className="flex justify-between items-start gap-3">
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-1">
                        <span className="text-[8px] font-bold uppercase tracking-wider text-[#701604]/60 bg-[#faf2e9] px-1.5 py-0.5 rounded border border-[#d9c2b2]/30">
                          {getKategoriLabel(item.kategori)}
                        </span>
                        {item.status !== 'ok' && (
                          <span className={	ext-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded }>
                            {item.status === 'below' ? 'Kritis' : 'Menipis'}
                          </span>
                        )}
                      </div>
                      <h3 className="font-bold text-[#1e1b15] text-xs uppercase tracking-wide mt-1.5 leading-tight truncate">
                        {item.item_name}
                      </h3>
                    </div>
                  </div>
                  
                  <div className="mt-3 flex items-center justify-between bg-suka-cream/10 p-2.5 rounded-lg border border-suka-brown/5">
                    <div>
                      <p className="text-[9px] text-[#544437]/60 font-semibold mb-0.5 uppercase tracking-wider">Sat. Besar</p>
                      <p className={ont-black text-sm }>{large} <span className="text-[10px] font-normal opacity-70">{item.satuan || 'kg'}</span></p>
                    </div>
                    {item.satuan_kecil && (
                      <div className="text-right">
                        <p className="text-[9px] text-[#544437]/60 font-semibold mb-0.5 uppercase tracking-wider">Sat. Kecil</p>
                        <p className={ont-black text-sm }>{small} <span className="text-[10px] font-normal opacity-70">{item.satuan_kecil}</span></p>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 flex items-center justify-between pt-3 border-t border-suka-brown/10">
                    <div className="text-[10px] font-medium text-suka-brown/60">
                      Upd: {getRelativeTimeString(item.last_opname_date)}
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <button onClick={(e) => saveEditing(item, e)} className="p-1 text-green-600 bg-green-50 rounded">✓</button>
                          <button onClick={cancelEditing} className="p-1 text-red-600 bg-red-50 rounded">✕</button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 cursor-pointer" onClick={(e) => startEditing(item, e)}>
                          <span className="text-[10px] text-suka-brown/60 uppercase tracking-wider font-semibold">Thresh:</span>
                          <span className="font-bold text-suka-ink text-xs">{item.threshold}</span>
                          <span className="text-suka-brown/40 text-xs hover:text-suka-orange transition-colors">✎</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            };

            if (tab === 'alerts') {
              const grouped = filteredItems.reduce((acc, item) => {
                if (!acc[item.outlet_name]) acc[item.outlet_name] = [];
                acc[item.outlet_name].push(item);
                return acc;
              }, {} as Record<string, MonitoringItem[]>);
              return Object.keys(grouped).sort().map(outletName => (
                <div key={outletName} className="space-y-3 mb-6">
                  <h4 className="font-black text-suka-brown text-sm uppercase px-2 flex items-center gap-2">
                    <span>🏢</span> {outletName}
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {grouped[outletName].map(item => renderCard(item))}
                  </div>
                </div>
              ));
            }

            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {filteredItems.map(item => renderCard(item))}
              </div>
            );
          })()
        )}
      </div>

      <div className="text-xs text-suka-brown/50 font-medium">\"\"\"

content = content.replace('      <div className="text-xs text-suka-brown/50 font-medium">', mobile_view)

with open('apps/stok/src/components/monitoring/SPVTable.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
