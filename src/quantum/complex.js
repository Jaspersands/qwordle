/**
 * @typedef {{ re: number, im: number }} Complex
 */

/**
 * @param {number} re
 * @param {number} im
 * @returns {Complex}
 */
export function complex(re = 0, im = 0) {
  return { re, im };
}

/**
 * @param {Complex} value
 * @returns {Complex}
 */
export function clone(value) {
  return { re: value.re, im: value.im };
}

/**
 * @param {Complex} a
 * @param {Complex} b
 * @returns {Complex}
 */
export function add(a, b) {
  return complex(a.re + b.re, a.im + b.im);
}

/**
 * @param {Complex} a
 * @param {Complex} b
 * @returns {Complex}
 */
export function multiply(a, b) {
  return complex(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
}

/**
 * @param {Complex} value
 * @returns {Complex}
 */
export function conjugate(value) {
  return complex(value.re, -value.im);
}

/**
 * @param {Complex} value
 * @param {number} scalar
 * @returns {Complex}
 */
export function scale(value, scalar) {
  return complex(value.re * scalar, value.im * scalar);
}

/**
 * @param {Complex} value
 * @returns {number}
 */
export function absSquared(value) {
  return value.re * value.re + value.im * value.im;
}

/**
 * @param {number} value
 * @param {number} digits
 */
function trimFixed(value, digits = 3) {
  const text = value.toFixed(digits);
  return text.replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1");
}

/**
 * @param {Complex} value
 * @param {number} digits
 */
export function formatComplex(value, digits = 3) {
  const re = Math.abs(value.re) < 1e-12 ? 0 : value.re;
  const im = Math.abs(value.im) < 1e-12 ? 0 : value.im;

  if (im === 0) {
    return trimFixed(re, digits);
  }
  if (re === 0) {
    return `${trimFixed(im, digits)}i`;
  }

  const sign = im > 0 ? "+" : "-";
  return `${trimFixed(re, digits)}${sign}${trimFixed(Math.abs(im), digits)}i`;
}
