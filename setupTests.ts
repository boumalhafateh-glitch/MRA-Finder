process.env.NODE_ENV = 'test'
import '@testing-library/jest-dom'
import { TextDecoder, TextEncoder } from 'util'

if (typeof globalThis.TextEncoder === 'undefined') {
  globalThis.TextEncoder = TextEncoder
}
if (typeof globalThis.TextDecoder === 'undefined') {
  globalThis.TextDecoder = TextDecoder as typeof globalThis.TextDecoder
}
