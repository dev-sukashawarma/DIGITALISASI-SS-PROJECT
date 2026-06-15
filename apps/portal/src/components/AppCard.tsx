interface Props {
  label: string
  url:   string
  desc:  string
}

export default function AppCard({ label, url, desc }: Props) {
  return (
    <a
      href={url}
      className="block rounded-xl border border-gray-200 bg-white p-5 shadow-sm
                 transition hover:border-orange-400 hover:shadow-md"
    >
      <p className="font-semibold text-gray-900">{label}</p>
      <p className="mt-1 text-sm text-gray-500">{desc}</p>
    </a>
  )
}
