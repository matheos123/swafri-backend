import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcrypt';
import { Prisma } from '@prisma/client';
import { AuthRepository } from '../repository/auth.repository';
import { UserService } from '../../user/service/user.service';
import { LoginDto } from '../dto/login.dto';
import { RegisterDto } from '../dto/register.dto';
import { AuthResponseDto } from '../dto/auth-response.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
  ) {}

  private strip(user: any) {
    const { password, refreshToken, ...rest } = user;
    return rest;
  }

  private tokens(userId: string, email: string) {
    const payload = { sub: userId, email };
    return {
      accessToken: this.jwtService.sign(payload, { expiresIn: '15m' }),
      refreshToken: this.jwtService.sign(payload, { expiresIn: '7d' }),
    };
  }

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    if (await this.userService.findByEmail(dto.email)) {
      throw new ConflictException('Email already in use');
    }
    if (await this.userService.findByUsername(dto.username)) {
      throw new ConflictException('Username already in use');
    }

    try {
      const user = await this.userService.create({
        email: dto.email,
        username: dto.username,
        password: await hash(dto.password, 10),
      });
      const tokens = this.tokens(user.id, user.email);
      await this.authRepository.setRefreshTokenHash(user.id, await hash(tokens.refreshToken, 10));
      return { user: this.strip(user), ...tokens };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Duplicate field value entered');
      }
      throw err;
    }
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.userService.findByEmail(dto.email);
    if (!user || !(await compare(dto.password, user.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const tokens = this.tokens(user.id, user.email);
    await this.authRepository.setRefreshTokenHash(user.id, await hash(tokens.refreshToken, 10));
    return { user: this.strip(user), ...tokens };
  }

  async refresh(token: string): Promise<AuthResponseDto> {
    let payload: any;
    try {
      payload = this.jwtService.verify(token);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.authRepository.findById(payload.sub);
    if (!user?.refreshToken || !(await compare(token, user.refreshToken))) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokens = this.tokens(user.id, user.email);
    await this.authRepository.setRefreshTokenHash(user.id, await hash(tokens.refreshToken, 10));
    return { user: this.strip(user), ...tokens };
  }

  async logout(userId: string): Promise<void> {
    await this.authRepository.removeRefreshToken(userId);
  }

  async getProfile(userId: string) {
    const user = await this.userService.findById(userId);
    if (!user) throw new UnauthorizedException('User not found');
    return user;
  }
}
