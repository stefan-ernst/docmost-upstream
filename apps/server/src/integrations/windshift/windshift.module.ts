import { Injectable, Logger, Module, OnModuleInit } from '@nestjs/common';
import { IntegrationOAuthRegistry } from '../integration-oauth/manifest.registry';
import { WINDSHIFT_MANIFEST } from './windshift.manifest';

/**
 * Registers the manifest at boot only when WINDSHIFT_BASE_URL is set —
 * unset means windshift won't show up in /api/integrations/oauth, so the
 * frontend's slash-menu entries hide automatically.
 */
@Injectable()
class WindshiftRegistration implements OnModuleInit {
  private readonly logger = new Logger(WindshiftRegistration.name);

  constructor(private readonly registry: IntegrationOAuthRegistry) {}

  onModuleInit(): void {
    if (!process.env.WINDSHIFT_BASE_URL) {
      this.logger.log(
        'WINDSHIFT_BASE_URL not set — skipping windshift integration registration',
      );
      return;
    }
    this.registry.register(WINDSHIFT_MANIFEST);
  }
}

@Module({
  providers: [WindshiftRegistration],
})
export class WindshiftModule {}
