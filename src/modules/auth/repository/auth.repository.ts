import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { User } from '@prisma/client';

/**
 * AuthRepository
 * 
 * Data access layer for authentication-related operations
 * 
 * Responsibilities:
 * - User lookup operations (by email, by ID)
 * - Refresh token management
 * - OTP storage and cleanup
 * - Password updates
 * 
 * Separation of Concerns:
 * - Isolates database operations from business logic
 * - Provides clean interface for auth services
 * - Encapsulates Prisma client usage
 */
@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ─── User Lookup ─────────────────────────────────────────────────────────

  /**
   * Find user by email address
   * 
   * @param email - User's email address
   * @returns User object or null if not found
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  /**
   * Find user by unique identifier
   * 
   * @param id - User's unique identifier
   * @returns User object or null if not found
   */
  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  // ─── Refresh Token Management ────────────────────────────────────────────

  /**
   * Store hashed refresh token for user
   * 
   * Note: Refresh token is stored as hash for security
   * 
   * @param userId - User's unique identifier
   * @param hash - Hashed refresh token
   */
  async setRefreshTokenHash(userId: string, hash: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: hash },
    });
  }

  /**
   * Remove refresh token (logout)
   * 
   * Invalidates user's refresh token by setting it to null
   * 
   * @param userId - User's unique identifier
   */
  async removeRefreshToken(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });
  }

  // ─── OTP Management ──────────────────────────────────────────────────────

  /**
   * Store OTP and expiry for password reset
   * 
   * @param userId - User's unique identifier
   * @param otp - Generated OTP code
   * @param expiryDate - When the OTP expires
   */
  async setOtp(userId: string, otp: string, expiryDate: Date): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { otp, otpExpiry: expiryDate },
    });
  }

  /**
   * Clear OTP data after use or expiration
   * 
   * @param userId - User's unique identifier
   */
  async clearOtp(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { otp: null, otpExpiry: null },
    });
  }

  // ─── Password Management ─────────────────────────────────────────────────

  /**
   * Update user's password
   * 
   * Note: Password should be hashed before calling this method
   * 
   * @param userId - User's unique identifier
   * @param hashedPassword - New hashed password
   */
  async updatePassword(userId: string, hashedPassword: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });
  }
}
