import { Injectable, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { randomUUID } from 'crypto';

export const MCP_UPLOAD_TTL_MS = 5 * 60 * 1000;
export const MCP_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;

interface StoredUpload {
  content: string;
  workspaceId: string;
  userId: string;
  expiresAt: number;
}

export interface StoredUploadHandle {
  uploadId: string;
  expiresAt: Date;
}

@Injectable()
export class McpContentUploadService implements OnModuleDestroy {
  private readonly entries = new Map<string, StoredUpload>();
  private readonly sweeper: NodeJS.Timeout;

  constructor() {
    this.sweeper = setInterval(() => this.sweepExpired(), 60_000);
    if (typeof this.sweeper.unref === 'function') {
      this.sweeper.unref();
    }
  }

  onModuleDestroy(): void {
    clearInterval(this.sweeper);
    this.entries.clear();
  }

  store(workspaceId: string, userId: string, content: string): StoredUploadHandle {
    const uploadId = randomUUID();
    const expiresAt = Date.now() + MCP_UPLOAD_TTL_MS;
    this.entries.set(uploadId, { content, workspaceId, userId, expiresAt });
    return { uploadId, expiresAt: new Date(expiresAt) };
  }

  consume(workspaceId: string, userId: string, uploadId: string): string {
    const entry = this.entries.get(uploadId);
    if (!entry) {
      throw new NotFoundException('Upload not found or expired');
    }

    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(uploadId);
      throw new NotFoundException('Upload not found or expired');
    }

    if (entry.workspaceId !== workspaceId || entry.userId !== userId) {
      throw new NotFoundException('Upload not found or expired');
    }

    this.entries.delete(uploadId);
    return entry.content;
  }

  private sweepExpired(): void {
    const now = Date.now();
    for (const [uploadId, entry] of this.entries) {
      if (entry.expiresAt <= now) {
        this.entries.delete(uploadId);
      }
    }
  }
}
