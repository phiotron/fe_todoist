import { render, screen } from '@testing-library/react-native';
import QRCode from 'qrcode';
import '../../../i18n';
import { OtpQrCode } from '../OtpQrCode';
import { qrModules } from '../qrModules';

const URI = 'otpauth://totp/Taskly:an%40example.com?secret=FIXTURESECRET&issuer=Taskly';

describe('qrModules', () => {
  it('returns a square matrix of the size the qrcode library computes', () => {
    const { size, dark } = qrModules(URI);
    expect(size).toBe(QRCode.create(URI, { errorCorrectionLevel: 'M' }).modules.size);
    expect(dark).toHaveLength(size * size);
    expect(dark.some(Boolean)).toBe(true);
    expect(dark.some((cell) => !cell)).toBe(true);
  });

  it('is deterministic and keeps the three finder squares (top-left module is dark)', () => {
    expect(qrModules(URI)).toEqual(qrModules(URI));
    expect(qrModules(URI).dark[0]).toBe(true);
  });
});

describe('OtpQrCode', () => {
  it('renders the code with a label that does not leak the secret', async () => {
    await render(<OtpQrCode value={URI} />);
    const frame = screen.getByTestId('qr-code');
    expect(frame.props.accessibilityRole).toBe('image');
    expect(String(frame.props.accessibilityLabel)).not.toContain('FIXTURESECRET');
  });
});
