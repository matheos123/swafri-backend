import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './controller/auth.controller';
import { AuthService } from './service/auth.service';
import { TokenService } from './service/token.service';
import { PasswordService } from './service/password.service';
import { AuthRepository } from './repository/auth.repository';
import { JwtAuthGuard } from '../../core/guard/jwt-auth.guard';
import { UserModule } from '../user/user.module';
import { EmailModule } from '../email/email.module';

/**
 * AuthModule
 *
 * Manages authentication and authorization with separation of concerns:
 *
 * Services:
 * - AuthService: Orchestrates authentication flows (register, login, logout)
 * - TokenService: Handles JWT token generation and validation
 * - PasswordService: Manages password operations and OTP-based reset
 *
 * Guard:
 * - JwtAuthGuard: Custom guard that handles token extraction, blacklist checks,
 *   and transparent token refresh (replaces PassportModule + JwtStrategy)
 *
 * Repository:
 * - AuthRepository: Data access layer for auth-related operations
 *
 * Dependencies:
 * - UserModule: User management operations
 * - EmailModule: Email notifications (OTP, password changes)
 * - JwtModule: JWT token operations
 * - RedisModule: Token blacklisting (imported globally in AppModule)
 */
@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.secret'),
        signOptions: { expiresIn: '15m' },
      }),
    }),
    UserModule,
    EmailModule,
  ],
  controllers: [AuthController],
  providers: [
    // Core authentication service
    AuthService,

    // Specialized services (separation of concerns)
    TokenService,
    PasswordService,

    // Data access
    AuthRepository,

    // Custom guard (replaces PassportModule)
    JwtAuthGuard,
  ],
  exports: [
    // Exported so the guard can inject them
    AuthService,
    TokenService,
    PasswordService,
    AuthRepository,
    JwtAuthGuard,
  ],
})
export class AuthModule {}
