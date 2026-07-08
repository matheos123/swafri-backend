import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './controller/auth.controller';
import { AuthService } from './service/auth.service';
import { TokenService } from './service/token.service';
import { PasswordService } from './service/password.service';
import { AuthRepository } from './repository/auth.repository';
import { JwtStrategy } from './strategy/jwt.strategy';
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
 * Strategy:
 * - JwtStrategy: Passport strategy for JWT authentication (from cookies or header)
 * 
 * Repository:
 * - AuthRepository: Data access layer for auth-related operations
 * 
 * Dependencies:
 * - UserModule: User management operations
 * - EmailModule: Email notifications (OTP, password changes)
 * - PassportModule: Authentication framework
 * - JwtModule: JWT token operations
 */
@Module({
  imports: [
    PassportModule,
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
    
    // Passport strategy
    JwtStrategy,
  ],
  exports: [AuthService],
})
export class AuthModule {}
