import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FallbackError } from './FallbackError'

describe('FallbackError — Critical-2 leak guard (Pitfall 4)', () => {
  it('renders error.message but does NOT expose error.cause', () => {
    const err = Object.assign(new Error('user-visible message'), {
      cause: { secret: 'leakedVm', vms: [{ name: 'sensitive-vm-007' }] },
    }) as Error & { cause: unknown }

    const { container } = render(
      <FallbackError error={err} resetErrorBoundary={() => undefined} />,
    )

    expect(screen.queryByText(/user-visible message/)).not.toBeNull()
    expect(screen.queryByText(/leakedVm/)).toBeNull()
    expect(screen.queryByText(/sensitive-vm-007/)).toBeNull()
    // Belt-and-suspenders: raw HTML must not include the cause payload.
    expect(container.innerHTML).not.toContain('leakedVm')
    expect(container.innerHTML).not.toContain('sensitive-vm-007')
  })

  it('renders error.name when present', () => {
    const err = new Error('parse failed')
    err.name = 'ParseError'
    render(<FallbackError error={err} resetErrorBoundary={() => undefined} />)
    expect(screen.queryByText(/ParseError/)).not.toBeNull()
  })

  it('handles non-Error values gracefully (string)', () => {
    render(
      <FallbackError
        error={'literal string' as unknown as Error}
        resetErrorBoundary={() => undefined}
      />,
    )
    expect(screen.queryByText(/unknown error/)).not.toBeNull()
  })
})
