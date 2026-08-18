import React from 'react'

interface SparklineSvgProps {
  data: number[]
  width?: number
  height?: number
  className?: string
}

export function SparklineSvg({
  data = [],
  width = 90,
  height = 26,
  className = ''
}: SparklineSvgProps) {
  if (!data || data.length === 0) {
    return (
      <div 
        style={{ width, height }} 
        className={`flex items-center justify-center text-[10px] text-suka-brown/30 font-medium italic ${className}`}
      >
        —
      </div>
    )
  }

  if (data.length === 1) {
    return (
      <div 
        style={{ width, height }} 
        className={`flex items-center justify-center ${className}`}
      >
        <span className="w-2 h-2 rounded-full bg-suka-brown/40" />
      </div>
    )
  }

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min === 0 ? 1 : max - min

  const paddingX = 4
  const paddingY = 4
  const innerWidth = width - paddingX * 2
  const innerHeight = height - paddingY * 2

  const points = data.map((val, idx) => {
    const x = paddingX + (idx / (data.length - 1)) * innerWidth
    const y = height - paddingY - ((val - min) / range) * innerHeight
    return { x, y, val }
  })

  const pathD = points.reduce((acc, pt, idx) => {
    return idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`
  }, '')

  const firstVal = data[0]
  const lastVal = data[data.length - 1]
  const isUp = lastVal > firstVal
  const isDown = lastVal < firstVal

  const strokeColor = isUp ? '#dc2626' : isDown ? '#16a34a' : '#877365'

  // Area under path
  const areaD = `${pathD} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`

  return (
    <svg 
      width={width} 
      height={height} 
      className={`overflow-visible ${className}`}
      viewBox={`0 0 ${width} ${height}`}
    >
      <defs>
        <linearGradient id={`grad-${firstVal}-${lastVal}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity="0.25" />
          <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      
      {/* Fill Area */}
      <path d={areaD} fill={`url(#grad-${firstVal}-${lastVal})`} />

      {/* Main Line */}
      <path
        d={pathD}
        fill="none"
        stroke={strokeColor}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Start and End Dots */}
      <circle cx={points[0].x} cy={points[0].y} r="2" fill={strokeColor} opacity="0.6" />
      <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="3" fill={strokeColor} />
    </svg>
  )
}
