import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';

export type NotificationType = 'friend_request' | 'friend_accepted' | 'game_invite' | 'achievement_earned' | 'match_found';

@Injectable()
export class NotificationService {
  private server!: Server;

  setServer(server: Server): void { this.server = server; }

  sendToUser(socketId: string, type: NotificationType, message: string, data?: Record<string, unknown>): void {
    this.server?.to(socketId).emit('notification:live', { type, message, data });
  }

  sendToRoom(roomId: string, type: NotificationType, message: string): void {
    this.server?.to(roomId).emit('notification:live', { type, message });
  }

  broadcastAchievement(socketId: string, achievementName: string): void {
    this.sendToUser(socketId, 'achievement_earned', `Achievement unlocked: "${achievementName}"`, { achievementName });
  }
}
