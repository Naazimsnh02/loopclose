import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { CommonModule } from './common/common.module';
import { HealthController } from './health.controller';
import { AuthModule } from './modules/auth/auth.module';
import { CasesModule } from './modules/cases/cases.module';
import { SlaModule } from './modules/sla/sla.module';
import { EscalationsModule } from './modules/escalations/escalations.module';
import { ReferralsModule } from './modules/referrals/referrals.module';
import { ConsultsModule } from './modules/consults/consults.module';
import { MessagingModule } from './modules/messaging/messaging.module';
import { AiModule } from './modules/ai/ai.module';
import { MetricsModule } from './modules/metrics/metrics.module';
import { AuditModule } from './modules/audit/audit.module';
import { IntegrationModule } from './modules/integration/integration.module';
import { AdminModule } from './modules/admin/admin.module';
import { DemoModule } from './modules/demo/demo.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        // Never log request bodies: they may contain (synthetic) PHI-shaped data.
        redact: ['req.headers.authorization', 'req.body', 'res.body'],
        transport: process.env.NODE_ENV !== 'production' ? { target: 'pino-pretty', options: { singleLine: true } } : undefined,
      },
    }),
    CommonModule,
    AuthModule,
    CasesModule,
    SlaModule,
    EscalationsModule,
    ReferralsModule,
    ConsultsModule,
    MessagingModule,
    AiModule,
    MetricsModule,
    AuditModule,
    IntegrationModule,
    AdminModule,
    DemoModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
