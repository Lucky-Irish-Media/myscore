declare module "pdfjs-dist/legacy/build/pdf.mjs" {
  import pdfjsLib from "pdfjs-dist"
  export = pdfjsLib
}

declare module "pdfjs-dist/legacy/build/pdf.worker.mjs" {
  const worker: any
  export = worker
}
