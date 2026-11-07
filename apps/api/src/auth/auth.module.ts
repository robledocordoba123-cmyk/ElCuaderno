import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { config } from '../config';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { IntentosLogin } from './intentos';

@Module({
  imports: [JwtModule.register({ global: true, secret: config.jwtSecret, signOptions: { expiresIn: config.jwtDuracion } })],
  controllers: [AuthController],
  providers: [AuthService, IntentosLogin, { provide: APP_GUARD, useClass: AuthGuard }],
})
export class AuthModule {}
