import { Module, forwardRef } from '@nestjs/common';
import { UserController } from './controller/user.controller';
import { UserService } from './service/user.service';
import { UserRepository } from './repository/user.repository';
import { AuthModule } from '../auth/auth.module';
import { RolesGuard } from '../../core/guard/roles.guard';

@Module({
  imports: [forwardRef(() => AuthModule)],
  controllers: [UserController],
  providers: [UserService, UserRepository, RolesGuard],
  exports: [UserService],
})
export class UserModule {}
