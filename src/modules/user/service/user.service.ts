import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { UserRepository } from '../repository/user.repository';
import { UpdateUserDto } from '../dto/update-user.dto';
import { UserResponseDto } from '../dto/user-response.dto';

@Injectable()
export class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  private strip(user: any): UserResponseDto {
    const { password, refreshToken, ...rest } = user;
    return rest as UserResponseDto;
  }

  create(data: Prisma.UserCreateInput) {
    return this.userRepository.create(data);
  }

  async findById(id: string): Promise<UserResponseDto> {
    const user = await this.userRepository.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return this.strip(user);
  }

  findByEmail(email: string) {
    return this.userRepository.findByEmail(email);
  }

  findByUsername(username: string) {
    return this.userRepository.findByUsername(username);
  }

  async findAll(): Promise<UserResponseDto[]> {
    const users = await this.userRepository.findAll();
    return users.map(this.strip);
  }

  async update(id: string, dto: UpdateUserDto): Promise<UserResponseDto> {
    const user = await this.userRepository.update(id, dto as Prisma.UserUpdateInput);
    return this.strip(user);
  }
}
