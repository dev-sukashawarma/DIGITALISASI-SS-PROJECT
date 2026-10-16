import { spawn } from 'node:child_process'

const next = spawn('npx', ['next', 'start', '-p', process.env.PORT || '3000'], { stdio: 'inherit' })
const children = [next]

if (process.env.TELEGRAM_STOKIST_BOT_TOKEN) {
  const poller = spawn(process.execPath, ['scripts/telegram/poll-updates.mjs'], { stdio: 'inherit' })
  children.push(poller)
}

let stopping = false
function stop(signal) {
  if (stopping) return
  stopping = true
  for (const child of children) {
    if (!child.killed) child.kill(signal)
  }
}

process.on('SIGTERM', () => stop('SIGTERM'))
process.on('SIGINT', () => stop('SIGINT'))

for (const child of children) {
  child.on('exit', (code, signal) => {
    if (!stopping) {
      process.exitCode = code ?? (signal ? 1 : 0)
      stop('SIGTERM')
    }
  })
}
