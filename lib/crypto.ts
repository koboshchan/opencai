import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;

function getEncryptionKey() {
  const value = process.env.APP_ENCRYPTION_KEY;

  if (!value) {
    throw new Error("Missing APP_ENCRYPTION_KEY environment variable.");
  }

  const key = Buffer.from(value, "base64");

  if (key.length !== 32) {
    throw new Error(
      "APP_ENCRYPTION_KEY must be a base64-encoded 32-byte key.",
    );
  }

  return key;
}

export function encryptSecret(plainText: string) {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plainText, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [iv, authTag, encrypted].map((value) => value.toString("base64")).join(":");
}

export function decryptSecret(cipherText: string) {
  const [ivValue, authTagValue, encryptedValue] = cipherText.split(":");

  if (!ivValue || !authTagValue || !encryptedValue) {
    throw new Error("Encrypted secret is malformed.");
  }

  const decipher = createDecipheriv(
    ALGORITHM,
    getEncryptionKey(),
    Buffer.from(ivValue, "base64"),
  );
  decipher.setAuthTag(Buffer.from(authTagValue, "base64"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}