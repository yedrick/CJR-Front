import QRCode from 'qrcode';

export async function generateQrDataUrl(text: string, colorDark = '#1B4332'): Promise<string> {
  try {
    const dataUrl = await QRCode.toDataURL(text, {
      width: 320,
      margin: 1.5,
      color: {
        dark: colorDark,
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'H',
    });
    return dataUrl;
  } catch (err) {
    console.error('Error generating QR code:', err);
    return '';
  }
}

export function buildCamperQrPayload(camperId: string, name: string, tribeId: string): string {
  return JSON.stringify({
    app: 'CAMPFLOW',
    id: camperId,
    name: name,
    tribe: tribeId,
    v: 1,
  });
}

export function parseCamperQrPayload(raw: string): { id: string; name?: string; tribe?: string } | null {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && parsed.id) {
      return { id: parsed.id, name: parsed.name, tribe: parsed.tribe };
    }
  } catch {
    // If raw text is just the ID (e.g., 'CMP-2026-7841')
    if (raw && raw.trim().startsWith('CMP-')) {
      return { id: raw.trim() };
    }
  }
  return null;
}
