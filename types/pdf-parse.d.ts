declare module 'pdf-parse' {
  const pdfParse: (dataBuffer: Buffer) => Promise<{ text: string; numpages?: number; info?: unknown; metadata?: unknown }>;
  export default pdfParse;
}
