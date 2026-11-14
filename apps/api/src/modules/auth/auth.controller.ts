import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';
import { AuthService } from './auth.service';
import { Public } from './jwt-auth.guard';

class DemoLoginDto {
  @IsEmail()
  email!: string;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('demo-login')
  demoLogin(@Body() dto: DemoLoginDto) {
    return this.auth.demoLogin(dto.email);
  }
}
