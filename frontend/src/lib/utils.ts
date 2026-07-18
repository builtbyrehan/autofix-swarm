import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`
  }
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}m ${remainingSeconds.toFixed(0)}s`
}

export function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp)
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function getStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'succeeded':
    case 'completed':
      return 'text-green-400'
    case 'failed':
    case 'rejected':
      return 'text-red-400'
    case 'running':
    case 'scanning':
    case 'fixing':
    case 'verifying':
      return 'text-cyan-400'
    case 'pending':
      return 'text-amber-400'
    default:
      return 'text-slate-400'
  }
}

export function getSeverityColor(severity: string): string {
  switch (severity.toLowerCase()) {
    case 'critical':
      return 'text-red-400 bg-red-500/10 border-red-500/30'
    case 'high':
      return 'text-orange-400 bg-orange-500/10 border-orange-500/30'
    case 'medium':
      return 'text-amber-400 bg-amber-500/10 border-amber-500/30'
    case 'low':
      return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30'
    default:
      return 'text-slate-400 bg-slate-500/10 border-slate-500/30'
  }
}
