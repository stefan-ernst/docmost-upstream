import {
  BadRequestException,
  Controller,
  HttpCode,
  HttpStatus,
  PayloadTooLargeException,
  Post,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { FileInterceptor } from '../../../common/interceptors/file.interceptor';
import { McpAuthGuard } from '../mcp-auth.guard';
import {
  McpContentUploadService,
  MCP_UPLOAD_MAX_BYTES,
} from './mcp-content-upload.service';

type McpRequest = FastifyRequest & {
  mcpAuth: {
    user: { id: string };
    workspace: { id: string };
  };
};

@Controller('mcp/uploads')
@UseGuards(McpAuthGuard)
export class McpUploadController {
  constructor(private readonly uploadService: McpContentUploadService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor)
  async upload(@Req() req: McpRequest) {
    const { user, workspace } = req.mcpAuth;

    let file: Awaited<ReturnType<FastifyRequest['file']>> | null = null;
    try {
      file = await req.file({
        limits: { fileSize: MCP_UPLOAD_MAX_BYTES, files: 1, fields: 0 },
      });
    } catch (err: any) {
      if (err?.statusCode === 413) {
        throw new PayloadTooLargeException(
          `Upload exceeds ${MCP_UPLOAD_MAX_BYTES} bytes`,
        );
      }
      throw new BadRequestException('Invalid multipart upload');
    }

    if (!file) {
      throw new BadRequestException('Missing file part');
    }

    const buffer = await file.toBuffer();

    if (buffer.byteLength > MCP_UPLOAD_MAX_BYTES) {
      throw new PayloadTooLargeException(
        `Upload exceeds ${MCP_UPLOAD_MAX_BYTES} bytes`,
      );
    }

    const content = buffer.toString('utf8');
    const handle = this.uploadService.store(workspace.id, user.id, content);

    return {
      uploadId: handle.uploadId,
      expiresAt: handle.expiresAt.toISOString(),
      bytes: buffer.byteLength,
    };
  }
}
