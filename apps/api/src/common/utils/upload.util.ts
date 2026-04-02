import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { diskStorage, Options } from 'multer';

export function normalizeUploadedOriginalName(fileName: string) {
  if (!fileName) {
    return fileName;
  }

  const normalized = Buffer.from(fileName, 'latin1').toString('utf8');
  const sourceLooksBroken = /[ÐÑ]/.test(fileName);
  const normalizedLooksCyrillic = /[А-Яа-яЁё]/.test(normalized);

  if (sourceLooksBroken && normalizedLooksCyrillic && !normalized.includes('\uFFFD')) {
    return normalized;
  }

  return fileName;
}

function sanitizeUploadFileName(name: string) {
  return name
    .replace(/[^a-zA-Z0-9а-яА-ЯёЁ._\- ]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 200);
}

export function createDiskUploadOptions(maxFileSize: number, maxCount?: number): Options {
  const uploadTempDir = process.env.UPLOAD_TMP_DIR || path.join(os.tmpdir(), 'normbase-uploads');
  fs.mkdirSync(uploadTempDir, { recursive: true });

  return {
    storage: diskStorage({
      destination: (_req, _file, cb) => cb(null, uploadTempDir),
      filename: (_req, file, cb) => {
        const normalizedOriginalName = normalizeUploadedOriginalName(file.originalname);
        file.originalname = normalizedOriginalName;
        const ext = path.extname(normalizedOriginalName);
        const baseName = sanitizeUploadFileName(path.basename(normalizedOriginalName, ext));
        cb(null, `${randomUUID()}_${baseName}${ext}`);
      },
    }),
    limits: {
      fileSize: maxFileSize,
      files: maxCount,
    },
  };
}
