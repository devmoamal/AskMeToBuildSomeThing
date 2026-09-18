import { useEffect, type RefObject } from 'react'

export function useClickOutside(
  ref: RefObject<HTMLElement | null>,
  handler: () => void,
  active = true
) {
  useEffect(() => {
    if (!active) return

    const listener = (event: MouseEvent | TouchEvent) => {
      if (!ref.current || ref.current.contains(event.target as Node)) {
        return
      }
      handler()
    }

    const keyListener = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handler()
      }
    }

    const scrollListener = () => {
      handler()
    }

    document.addEventListener('mousedown', listener)
    document.addEventListener('touchstart', listener)
    document.addEventListener('keydown', keyListener)
    window.addEventListener('scroll', scrollListener, true)

    return () => {
      document.removeEventListener('mousedown', listener)
      document.removeEventListener('touchstart', listener)
      document.removeEventListener('keydown', keyListener)
      window.removeEventListener('scroll', scrollListener, true)
    }
  }, [ref, handler, active])
}
