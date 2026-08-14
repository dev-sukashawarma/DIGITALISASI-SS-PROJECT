const fs = require('fs');
const path = require('path');

const filePath = path.resolve('d:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT/apps/admin-dashboard/src/hooks/useBahanBakuHargaMutations.ts');
let content = fs.readFileSync(filePath, 'utf-8');

const targetStr = '  const setSatuan = useMutation({';
const insertStr = `  const setMerek = useMutation({
    mutationFn: async (vars: { bahan_baku_id: string; merek: string | null }) => {
      const { error } = await supabase.from('bahan_baku').update({
        merek: vars.merek
      }).eq('id', vars.bahan_baku_id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bahan_baku_harga'] }),
  })

  const setNama = useMutation({
    mutationFn: async (vars: { bahan_baku_id: string; nama: string }) => {
      const { error } = await supabase.from('bahan_baku').update({
        nama: vars.nama
      }).eq('id', vars.bahan_baku_id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bahan_baku_harga'] }),
  })

`;

content = content.replace(targetStr, insertStr + targetStr);

// Also update the return statement
content = content.replace(
  'return { setHarga, setSatuan',
  'return { setHarga, setMerek, setNama, setSatuan'
);

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Hook updated successfully');
