import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);
  private readonly storagePath: string;
  private readonly maxFileSize: number;

  constructor(private config: ConfigService) {
    this.storagePath = config.get('STORAGE_PATH', '/app/storage');
    this.maxFileSize = config.get('MAX_FILE_SIZE', 524288000); // 500MB
  }

  sanitizeFileName(name: string): string {
    // Keep only safe characters
    return name
      .replace(/[^a-zA-Z0-9а-яА-ЯёЁ._\- ]/g, '_')
      .replace(/\s+/g, '_')
      .substring(0, 200);
  }

  generateStoragePath(subdir: string, originalName: string): string {
    const ext = path.extname(originalName);
    const sanitized = this.sanitizeFileName(path.basename(originalName, ext));
    const uniqueName = `${uuidv4()}_${sanitized}${ext}`;
    return path.join(subdir, uniqueName);
  }

  getAbsolutePath(relativePath: string): string {
    // Prevent path traversal
    const resolved = path.resolve(this.storagePath, relativePath);
    if (!resolved.startsWith(path.resolve(this.storagePath))) {
      throw new BadRequestException('Недопустимый путь к файлу');
    }
    return resolved;
  }

  async saveFile(
    fileBuffer: Buffer,
    originalName: string,
    subdir: string,
  ): Promise<{ relativePath: string; fileSize: number; fileHash: string }> {
    const relativePath = this.generateStoragePath(subdir, originalName);
    const absolutePath = this.getAbsolutePath(relativePath);

    // Ensure directory exists
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });

    // Calculate hash
    const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    // Write file
    fs.writeFileSync(absolutePath, fileBuffer);

    return {
      relativePath,
      fileSize: fileBuffer.length,
      fileHash,
    };
  }

  getReadStream(relativePath: string): fs.ReadStream {
    const absolutePath = this.getAbsolutePath(relativePath);
    if (!fs.existsSync(absolutePath)) {
      throw new BadRequestException('Файл не найден');
    }
    return fs.createReadStream(absolutePath);
  }

  fileExists(relativePath: string): boolean {
    try {
      const absolutePath = this.getAbsolutePath(relativePath);
      return fs.existsSync(absolutePath);
    } catch {
      return false;
    }
  }

  deleteFile(relativePath: string): void {
    try {
      const absolutePath = this.getAbsolutePath(relativePath);
      if (fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
      }
    } catch (err) {
      this.logger.warn(`Failed to delete file: ${relativePath}`, err);
    }
  }

  getTotalSize(relativePaths: string[]): number {
    return relativePaths.reduce((total, p) => {
      try {
        const abs = this.getAbsolutePath(p);
        const stat = fs.statSync(abs);
        return total + stat.size;
      } catch {
        return total;
      }
    }, 0);
  }

  async createZipStream(
    files: Array<{ relativePath: string; fileName: string }>,
  ): Promise<NodeJS.ReadableStream> {
    const archiver = require('archiver');
    const archive = archiver('zip', { zlib: { level: 6 } });

    for (const file of files) {
      const absolutePath = this.getAbsolutePath(file.relativePath);
      if (fs.existsSync(absolutePath)) {
        archive.file(absolutePath, { name: file.fileName });
      }
    }

    archive.finalize();
    return archive;
  }
}
