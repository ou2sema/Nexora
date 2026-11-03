/** A PDF the API renders and streams to the browser as a download. */
export interface RenderedDocument {
  pdf: Uint8Array;
  fileName: string;
}
