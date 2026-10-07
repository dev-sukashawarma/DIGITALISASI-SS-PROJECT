'use client'

import { Fragment, useMemo } from 'react'
import { uraiInline, uraiMarkdown, uraiPesan, type BlokMd } from '@/lib/botHrd/uraiPesan'
import { TabelBot } from './blokUi/TabelBot'
import { KartuBot } from './blokUi/KartuBot'
import { GrafikBatangBot } from './blokUi/GrafikBatangBot'
import { BlokRusak } from './blokUi/BlokRusak'

function Inline({ s }: { s: string }) {
  return (
    <>
      {uraiInline(s).map((p, i) => {
        if (p.t === 'b') return <strong key={i}>{p.isi}</strong>
        if (p.t === 'i') return <em key={i}>{p.isi}</em>
        if (p.t === 'code')
          return (
            <code key={i} className="rounded bg-[#FDF9F3] px-1 py-0.5 font-mono text-[0.85em] text-[#4A1713]">
              {p.isi}
            </code>
          )
        return <Fragment key={i}>{p.isi}</Fragment>
      })}
    </>
  )
}

const H = ['', 'text-base', 'text-sm', 'text-sm'] as const

function Md({ b }: { b: BlokMd }) {
  switch (b.t) {
    case 'h':
      return (
        <p className={`${H[b.level]} font-bold text-[#4A1713]`}>
          <Inline s={b.isi} />
        </p>
      )
    case 'ul':
      return (
        <ul className="list-disc space-y-0.5 pl-5">
          {b.items.map((it, i) => (
            <li key={i}>
              <Inline s={it} />
            </li>
          ))}
        </ul>
      )
    case 'ol':
      return (
        <ol className="list-decimal space-y-0.5 pl-5">
          {b.items.map((it, i) => (
            <li key={i}>
              <Inline s={it} />
            </li>
          ))}
        </ol>
      )
    case 'tabel':
      return <TabelBot kolom={b.kolom} baris={b.baris} />
    default:
      return (
        <p>
          {b.baris.map((l, i) => (
            <Fragment key={i}>
              {i > 0 && <br />}
              <Inline s={l} />
            </Fragment>
          ))}
        </p>
      )
  }
}

export function IsiPesan({ teks }: { teks: string }) {
  const bagian = useMemo(() => uraiPesan(teks), [teks])
  return (
    <div className="w-full min-w-0 space-y-2">
      {bagian.map((p, i) => {
        if (p.jenis === 'teks')
          return (
            <div key={i} className="space-y-1.5">
              {uraiMarkdown(p.isi).map((b, j) => (
                <Md key={j} b={b} />
              ))}
            </div>
          )
        if (p.jenis === 'ui_rusak') return <BlokRusak key={i} mentah={p.mentah} />
        const k = p.blok
        if (k.jenis === 'tabel') return <TabelBot key={i} judul={k.judul} kolom={k.kolom} baris={k.baris} catatan={k.catatan} />
        if (k.jenis === 'kartu') return <KartuBot key={i} judul={k.judul} item={k.item} />
        return <GrafikBatangBot key={i} judul={k.judul} satuan={k.satuan} data={k.data} />
      })}
    </div>
  )
}
