import QRCode from 'qrcode';

export interface QrModules {
  size: number;
  /** Row-major, `size * size` cells; true = dark module. */
  dark: boolean[];
}

/** Module matrix of the QR code of `value` (pure: no drawing, nothing stored or logged). */
export function qrModules(value: string): QrModules {
  const { modules } = QRCode.create(value, { errorCorrectionLevel: 'M' });
  const size = modules.size;
  const dark: boolean[] = [];
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) dark.push(modules.get(row, column) === 1);
  }
  return { size, dark };
}

/** One SVG path of 1x1 squares for the dark modules (a single element keeps big codes cheap to draw). */
export function qrPath({ size, dark }: QrModules): string {
  let path = '';
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      if (dark[row * size + column]) path += `M${column} ${row}h1v1h-1z`;
    }
  }
  return path;
}
