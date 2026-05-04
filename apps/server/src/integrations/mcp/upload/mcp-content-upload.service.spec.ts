import { NotFoundException } from '@nestjs/common';
import {
  McpContentUploadService,
  MCP_UPLOAD_TTL_MS,
} from './mcp-content-upload.service';

describe('McpContentUploadService', () => {
  let service: McpContentUploadService;

  beforeEach(() => {
    jest.useFakeTimers();
    service = new McpContentUploadService();
  });

  afterEach(() => {
    service.onModuleDestroy();
    jest.useRealTimers();
  });

  it('store returns a uploadId and matching expiresAt', () => {
    const handle = service.store('ws-1', 'user-1', '# hi');

    expect(handle.uploadId).toMatch(/^[0-9a-f-]{36}$/);
    expect(handle.expiresAt.getTime()).toBe(Date.now() + MCP_UPLOAD_TTL_MS);
  });

  it('consume returns the stored content for the original tenant + user', () => {
    const { uploadId } = service.store('ws-1', 'user-1', '# hello');

    expect(service.consume('ws-1', 'user-1', uploadId)).toBe('# hello');
  });

  it('consume is single-use', () => {
    const { uploadId } = service.store('ws-1', 'user-1', 'content');

    expect(service.consume('ws-1', 'user-1', uploadId)).toBe('content');
    expect(() =>
      service.consume('ws-1', 'user-1', uploadId),
    ).toThrow(NotFoundException);
  });

  it('consume rejects unknown uploadId', () => {
    expect(() =>
      service.consume('ws-1', 'user-1', 'no-such-id'),
    ).toThrow(NotFoundException);
  });

  it('consume rejects mismatched workspace', () => {
    const { uploadId } = service.store('ws-1', 'user-1', 'content');

    expect(() =>
      service.consume('ws-2', 'user-1', uploadId),
    ).toThrow(NotFoundException);
  });

  it('consume rejects mismatched user (same workspace)', () => {
    const { uploadId } = service.store('ws-1', 'user-1', 'content');

    expect(() =>
      service.consume('ws-1', 'user-2', uploadId),
    ).toThrow(NotFoundException);
  });

  it('consume rejects an expired upload', () => {
    const { uploadId } = service.store('ws-1', 'user-1', 'content');

    jest.advanceTimersByTime(MCP_UPLOAD_TTL_MS + 1);

    expect(() =>
      service.consume('ws-1', 'user-1', uploadId),
    ).toThrow(NotFoundException);
  });

  it('sweeper drops expired entries on its tick', () => {
    const { uploadId } = service.store('ws-1', 'user-1', 'content');

    jest.advanceTimersByTime(MCP_UPLOAD_TTL_MS + 60_001);

    // After sweeper has run, the entry is gone — consume still rejects with NotFound
    expect(() =>
      service.consume('ws-1', 'user-1', uploadId),
    ).toThrow(NotFoundException);
  });

  it('rejected mismatched workspace does not delete the entry (so it can still be consumed correctly)', () => {
    const { uploadId } = service.store('ws-1', 'user-1', 'content');

    expect(() =>
      service.consume('ws-2', 'user-1', uploadId),
    ).toThrow(NotFoundException);

    // Original tenant can still consume — leak resistance through obscurity, not denial
    expect(service.consume('ws-1', 'user-1', uploadId)).toBe('content');
  });
});
