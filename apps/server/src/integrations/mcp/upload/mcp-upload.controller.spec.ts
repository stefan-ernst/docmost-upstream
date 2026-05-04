// Mock mcp-auth.guard at the module boundary so resolving the spec does not
// pull in transitive ESM-only deps (nanoid via UserRepo) that ts-jest cannot
// transform. The guard is overridden in the testing module below anyway.
jest.mock('../mcp-auth.guard', () => ({
  McpAuthGuard: class McpAuthGuard {},
}));

import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { McpUploadController } from './mcp-upload.controller';
import {
  McpContentUploadService,
  MCP_UPLOAD_MAX_BYTES,
} from './mcp-content-upload.service';
import { McpAuthGuard } from '../mcp-auth.guard';

describe('McpUploadController', () => {
  let controller: McpUploadController;
  let uploadService: McpContentUploadService;

  beforeEach(async () => {
    const moduleBuilder = Test.createTestingModule({
      controllers: [McpUploadController],
      providers: [McpContentUploadService],
    });

    moduleBuilder.overrideGuard(McpAuthGuard).useValue({
      canActivate: jest.fn().mockReturnValue(true),
    });

    const module: TestingModule = await moduleBuilder.compile();
    controller = module.get(McpUploadController);
    uploadService = module.get(McpContentUploadService);
  });

  afterEach(() => {
    uploadService.onModuleDestroy();
  });

  function makeRequest(filePromise: any): any {
    return {
      mcpAuth: {
        user: { id: 'user-1' },
        workspace: { id: 'ws-1' },
      },
      file: jest.fn().mockImplementation(() => filePromise),
    };
  }

  it('stores the upload and returns uploadId + expiresAt + bytes on success', async () => {
    const buffer = Buffer.from('# hello\n', 'utf8');
    const req = makeRequest(
      Promise.resolve({
        toBuffer: jest.fn().mockResolvedValue(buffer),
      }),
    );

    const result = await controller.upload(req);

    expect(result.uploadId).toMatch(/^[0-9a-f-]{36}$/);
    expect(result.bytes).toBe(buffer.byteLength);
    expect(typeof result.expiresAt).toBe('string');
    expect(new Date(result.expiresAt).getTime()).toBeGreaterThan(Date.now());

    // The stored upload should round-trip through the service for the same tenant + user.
    expect(
      uploadService.consume('ws-1', 'user-1', result.uploadId),
    ).toBe('# hello\n');
  });

  it('rejects when no file is present', async () => {
    const req = makeRequest(Promise.resolve(undefined));

    await expect(controller.upload(req)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('translates a 413 from req.file() into PayloadTooLargeException', async () => {
    const err: any = new Error('Request file too large');
    err.statusCode = 413;
    const req = makeRequest(Promise.reject(err));

    await expect(controller.upload(req)).rejects.toBeInstanceOf(
      PayloadTooLargeException,
    );
  });

  it('translates a non-413 multipart error into BadRequestException', async () => {
    const err: any = new Error('multipart parse failed');
    const req = makeRequest(Promise.reject(err));

    await expect(controller.upload(req)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects when the buffered file exceeds MCP_UPLOAD_MAX_BYTES', async () => {
    const oversized = Buffer.alloc(MCP_UPLOAD_MAX_BYTES + 1, 0x61);
    const req = makeRequest(
      Promise.resolve({
        toBuffer: jest.fn().mockResolvedValue(oversized),
      }),
    );

    await expect(controller.upload(req)).rejects.toBeInstanceOf(
      PayloadTooLargeException,
    );
  });

  it('scopes the stored upload to the calling user + workspace', async () => {
    const buffer = Buffer.from('payload', 'utf8');
    const req = makeRequest(
      Promise.resolve({
        toBuffer: jest.fn().mockResolvedValue(buffer),
      }),
    );

    const { uploadId } = await controller.upload(req);

    // Other tenants cannot consume.
    expect(() => uploadService.consume('ws-2', 'user-1', uploadId)).toThrow();
    expect(() => uploadService.consume('ws-1', 'user-2', uploadId)).toThrow();
  });
});
