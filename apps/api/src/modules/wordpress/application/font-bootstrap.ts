import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { createLogger } from '@socialflow/logger';

const logger = createLogger('font-bootstrap');

let fontBootstrapped = false;

/**
 * Ensures that a usable font is available to Pango / librsvg on the
 * current machine.  On a typical developer workstation the system already
 * has fonts, so this is a no-op.  On a minimal Linux container (Vercel
 * Lambda / Amazon Linux 2) the fontconfig configuration and/or font
 * directory may be missing, which causes sharp's Pango text renderer to
 * output square placeholder boxes.
 *
 * This function:
 *   1. Downloads a free Inter TTF font to /tmp/fonts (cached across warm
 *      Lambda invocations).
 *   2. Writes a minimal fontconfig.conf to /tmp that references the
 *      downloaded font directory.
 *   3. Sets the FONTCONFIG_FILE environment variable so that libfontconfig
 *      picks up the custom configuration.
 *
 * It is safe to call multiple times – only the first call does any work.
 */
export async function ensureFontAvailability(): Promise<void> {
  if (fontBootstrapped) return;

  // On Windows / macOS, system fonts are always available.
  if (process.platform !== 'linux') {
    fontBootstrapped = true;
    return;
  }

  const tmpFontsDir = '/tmp/sf-fonts';
  const fontConfigPath = '/tmp/sf-fonts.conf';

  // If we already wrote the config in a previous warm invocation, just
  // make sure the env var is still set.
  if (existsSync(fontConfigPath)) {
    process.env.FONTCONFIG_FILE = fontConfigPath;
    fontBootstrapped = true;
    return;
  }

  try {
    mkdirSync(tmpFontsDir, { recursive: true });

    // Download Inter font (variable weight, Latin subset – ~300 KB).
    const fontPath = join(tmpFontsDir, 'Inter.ttf');
    if (!existsSync(fontPath)) {
      logger.info('Downloading Inter font for text rendering…');
      const urls = [
        // Google Fonts GitHub mirror (variable TTF, all weights)
        'https://github.com/google/fonts/raw/main/ofl/inter/Inter%5Bopsz%2Cwght%5D.ttf',
        // Official Inter release (v4.1 regular static)
        'https://github.com/rsms/inter/releases/download/v4.1/Inter-Regular.ttf',
      ];

      let downloaded = false;
      for (const url of urls) {
        try {
          const response = await fetch(url, { signal: AbortSignal.timeout(8_000) });
          if (response.ok) {
            const buffer = Buffer.from(await response.arrayBuffer());
            if (buffer.length > 10_000) {
              writeFileSync(fontPath, buffer);
              logger.info(`Font downloaded (${String(buffer.length)} bytes) from ${url}`);
              downloaded = true;
              break;
            }
          }
        } catch {
          // Try next URL
        }
      }

      if (!downloaded) {
        logger.warn('Could not download font – text rendering may show placeholder boxes.');
        fontBootstrapped = true;
        return;
      }
    }

    // Write fontconfig configuration.
    const config = `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>${tmpFontsDir}</dir>
  <dir>/usr/share/fonts</dir>
  <dir>/usr/share/fonts/dejavu</dir>
  <dir>/usr/local/share/fonts</dir>
  <cachedir>/tmp/fontconfig-cache</cachedir>
  <match target="pattern">
    <test name="family"><string>sans-serif</string></test>
    <edit name="family" mode="prepend_first"><string>Inter</string></edit>
  </match>
  <match target="pattern">
    <test name="family"><string>sans</string></test>
    <edit name="family" mode="prepend_first"><string>Inter</string></edit>
  </match>
</fontconfig>`;

    writeFileSync(fontConfigPath, config, 'utf-8');
    mkdirSync('/tmp/fontconfig-cache', { recursive: true });

    process.env.FONTCONFIG_FILE = fontConfigPath;
    logger.info('Fontconfig configured for text rendering.');
  } catch (error) {
    logger.warn(
      `Font bootstrap failed – text rendering may degrade. ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  fontBootstrapped = true;
}
