import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';

interface EncryptedSecret {
  iv: string;
  tag: string;
  ciphertext: string;
}

@Injectable()
export class WordPressSecretService {
  encrypt(value: string): EncryptedSecret {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key(), iv);
    const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    return {
      iv: iv.toString('base64url'),
      tag: tag.toString('base64url'),
      ciphertext: ciphertext.toString('base64url'),
    };
  }

  decrypt(secret: EncryptedSecret): string {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.key(),
      Buffer.from(secret.iv, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(secret.tag, 'base64url'));

    return Buffer.concat([
      decipher.update(Buffer.from(secret.ciphertext, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }

  private key(): Buffer {
    const source =
      process.env.WORDPRESS_APPLICATION_PASSWORD_ENCRYPTION_KEY ??
      process.env.JWT_ACCESS_SECRET ??
      'local-wordpress-development-key';

    return createHash('sha256').update(source).digest();
  }
}
