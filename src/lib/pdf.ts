// Polyfill for pdf.js running in Node.js
if (typeof global !== 'undefined' && !(global as any).DOMMatrix) {
  (global as any).DOMMatrix = class DOMMatrix {};
}

const pdfParse = require('pdf-parse/lib/pdf-parse.js');

export default pdfParse;
