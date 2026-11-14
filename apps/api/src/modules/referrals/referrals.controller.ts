import { Body, Controller, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import type { Actor } from '@loopclose/shared';
import { CurrentActor, Roles } from '../../common/actor';
import { ReferralsService } from './referrals.service';

class OwnerDto {
  @IsString() id!: string;
  @IsString() role!: string;
  @IsOptional() @IsString() organizationId?: string;
}
class OfferDto {
  @IsString() caseId!: string;
  @IsString() recipientOrgId!: string;
  @ValidateNested() @Type(() => OwnerDto) recipientOwner!: OwnerDto;
  @IsString() procedureCode!: string;
  @IsString() reason!: string;
}
class AcceptDto {
  @ValidateNested() @Type(() => OwnerDto) schedulerOwner!: OwnerDto;
}
class DeclineDto {
  @IsString() reason!: string;
}
class RedirectDto {
  @IsString() recipientOrgId!: string;
  @ValidateNested() @Type(() => OwnerDto) recipientOwner!: OwnerDto;
}

@ApiTags('referrals')
@ApiBearerAuth()
@Controller('referrals')
export class ReferralsController {
  constructor(private readonly referrals: ReferralsService) {}

  @Post()
  @Roles('phc_clinician', 'phc_lead', 'breast_radiologist', 'coordinator')
  offer(@Body() dto: OfferDto, @CurrentActor() actor: Actor) {
    return this.referrals.offer(dto, actor);
  }

  @Post(':id/accept')
  @Roles('specialist', 'specialist_lead', 'breast_clinic')
  accept(@Param('id') id: string, @Body() dto: AcceptDto, @CurrentActor() actor: Actor) {
    return this.referrals.accept(id, dto.schedulerOwner, actor);
  }

  @Post(':id/decline')
  @Roles('specialist', 'specialist_lead', 'breast_clinic')
  decline(@Param('id') id: string, @Body() dto: DeclineDto, @CurrentActor() actor: Actor) {
    return this.referrals.decline(id, dto.reason, actor);
  }

  @Post(':id/redirect')
  @Roles('coordinator', 'coordinator_lead')
  redirect(@Param('id') id: string, @Body() dto: RedirectDto, @CurrentActor() actor: Actor) {
    return this.referrals.redirect(id, dto, actor);
  }
}
