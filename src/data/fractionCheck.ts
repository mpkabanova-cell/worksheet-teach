/** Точная проверка простых арифметических выражений с дробями. */

export interface Frac {
  n: bigint
  d: bigint
}

function gcd(a: bigint, b: bigint): bigint {
  a = a < 0n ? -a : a
  b = b < 0n ? -b : b
  while (b) [a, b] = [b, a % b]
  return a || 1n
}

export function frac(n: bigint, d: bigint = 1n): Frac {
  if (d === 0n) throw new Error('Деление на ноль')
  if (d < 0n) {
    n = -n
    d = -d
  }
  const g = gcd(n, d)
  return { n: n / g, d: d / g }
}

const add = (a: Frac, b: Frac) => frac(a.n * b.d + b.n * a.d, a.d * b.d)
const sub = (a: Frac, b: Frac) => frac(a.n * b.d - b.n * a.d, a.d * b.d)
const mul = (a: Frac, b: Frac) => frac(a.n * b.n, a.d * b.d)
const div = (a: Frac, b: Frac) => frac(a.n * b.d, a.d * b.n)

/** LaTeX \frac{a}{b} → a/b, × ÷ − → * / -. */
export function normalizeExpression(text: string): string {
  return text
    .replace(/\$/g, '')
    .replace(/\\d?frac\s*\{\s*(-?\d+)\s*\}\s*\{\s*(\d+)\s*\}/g, '($1/$2)')
    .replace(/\\cdot|\\times|×|·/g, '*')
    .replace(/\\div|÷|:/g, '/')
    .replace(/[−–—]/g, '-')
    .replace(/,/g, '.')
    .replace(/\s+/g, '')
}

/** Вычисляет выражение из чисел, дробей, + - * / и скобок. null — если не арифметика. */
export function evaluateExact(expr: string): Frac | null {
  const s = normalizeExpression(expr)
  if (!s || !/^[\d+\-*/().]+$/.test(s) || !/[+\-*/]/.test(s.replace(/^-/, ''))) return null
  let i = 0
  const peek = () => s[i]
  function number(): Frac {
    const m = /^\d+(\.\d+)?/.exec(s.slice(i))
    if (!m) throw new Error('bad')
    i += m[0].length
    const [whole, dec = ''] = m[0].split('.')
    return frac(BigInt(whole + dec), 10n ** BigInt(dec.length))
  }
  function factor(): Frac {
    if (peek() === '-') {
      i++
      const f = factor()
      return frac(-f.n, f.d)
    }
    if (peek() === '(') {
      i++
      const v = expression()
      if (peek() !== ')') throw new Error('bad')
      i++
      return v
    }
    return number()
  }
  function term(): Frac {
    let v = factor()
    while (peek() === '*' || peek() === '/') {
      const op = s[i++]
      const r = factor()
      v = op === '*' ? mul(v, r) : div(v, r)
    }
    return v
  }
  function expression(): Frac {
    let v = term()
    while (peek() === '+' || peek() === '-') {
      const op = s[i++]
      const r = term()
      v = op === '+' ? add(v, r) : sub(v, r)
    }
    return v
  }
  try {
    const v = expression()
    return i === s.length ? v : null
  } catch {
    return null
  }
}

/** Ответ (число, дробь, смешанное число «1 1/2», LaTeX) → дробь. */
export function parseAnswer(text: string): Frac | null {
  const raw = text.replace(/^Ответ\s*:\s*/i, '').replace(/\s*(кг|м|см|л|г|ч|мин|руб\.?|км)\.?$/i, '').trim()
  const mixed = /^(-?\d+)\s+(\d+)\s*\/\s*(\d+)$/.exec(raw)
  if (mixed) {
    const w = BigInt(mixed[1])
    const f = frac(BigInt(mixed[2]), BigInt(mixed[3]))
    return w < 0n ? sub(frac(w), f) : add(frac(w), f)
  }
  const s = normalizeExpression(raw)
  if (/^-?\d+(\.\d+)?$/.test(s)) return evaluateExact(`${s}+0`)
  return evaluateExact(s)
}

export function formatFrac(f: Frac): string {
  return f.d === 1n ? f.n.toString() : `${f.n}/${f.d}`
}

export function fracEquals(a: Frac, b: Frac): boolean {
  return a.n === b.n && a.d === b.d
}

/** Вынимает чистое выражение из условия вида «Вычислите: 1/3 + 1/4.» */
export function extractExpression(question: string): string | null {
  const m = /(?:вычисли(?:те)?|найди(?:те)? значение(?: выражения)?|упрости(?:те)?)[^:]*:\s*([^.?!\n]+)/i.exec(question)
  const candidate = m?.[1]?.trim()
  if (!candidate) return null
  return evaluateExact(candidate) ? candidate : null
}

/**
 * Проверяет и при необходимости исправляет ответ на «Вычислите: …».
 * Возвращает исправленный ответ или null, если менять ничего не нужно / нельзя проверить.
 */
export function verifiedAnswer(question: string, answer: string | undefined): string | null {
  const expr = extractExpression(question)
  if (!expr) return null
  const exact = evaluateExact(expr)
  if (!exact) return null
  const given = answer ? parseAnswer(answer) : null
  if (given && fracEquals(given, exact)) return null
  return formatFrac(exact)
}
