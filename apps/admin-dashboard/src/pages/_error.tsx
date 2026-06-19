import type { NextPage } from 'next'
import type { ErrorProps } from 'next/error'

const Error: NextPage<ErrorProps> = ({ statusCode }) => {
  return (
    <div style={{ textAlign: 'center', padding: '2rem' }}>
      <h1>{statusCode}</h1>
      <p>Error occurred</p>
    </div>
  )
}

Error.getInitialProps = ({ res, err }) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404
  return { statusCode }
}

export default Error
