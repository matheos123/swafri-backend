import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Clean existing data (optional - comment out if you want to keep data)
  await prisma.chatMessage.deleteMany();
  await prisma.userAchievement.deleteMany();
  await prisma.friendship.deleteMany();
  await prisma.matchMove.deleteMany();
  await prisma.match.deleteMany();
  await prisma.achievement.deleteMany();
  await prisma.user.deleteMany();

  // Create test users
  const password = await bcrypt.hash('password123', 10);

  const alice = await prisma.user.create({
    data: {
      email: 'alice@arena.com',
      username: 'AliceWarrior',
      password,
      walletAddress: '0x1234567890123456789012345678901234567890',
      wins: 15,
      losses: 5,
      totalMatches: 20,
      currentStreak: 3,
      longestStreak: 7,
      points: 150,
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alice',
    },
  });

  const bob = await prisma.user.create({
    data: {
      email: 'bob@arena.com',
      username: 'BobTheBrave',
      password,
      walletAddress: '0x2345678901234567890123456789012345678901',
      wins: 12,
      losses: 8,
      totalMatches: 20,
      currentStreak: 2,
      longestStreak: 5,
      points: 120,
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Bob',
    },
  });

  const charlie = await prisma.user.create({
    data: {
      email: 'charlie@arena.com',
      username: 'CharlieChamp',
      password,
      walletAddress: '0x3456789012345678901234567890123456789012',
      wins: 8,
      losses: 12,
      totalMatches: 20,
      currentStreak: 1,
      longestStreak: 3,
      points: 80,
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Charlie',
    },
  });

  const diana = await prisma.user.create({
    data: {
      email: 'diana@arena.com',
      username: 'DianaDestroyer',
      password,
      wins: 25,
      losses: 5,
      totalMatches: 30,
      currentStreak: 10,
      longestStreak: 10,
      points: 250,
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Diana',
    },
  });

  console.log('✅ Created test users:', {
    alice: alice.username,
    bob: bob.username,
    charlie: charlie.username,
    diana: diana.username,
  });

  // Create achievements
  const achievements = await Promise.all([
    prisma.achievement.create({
      data: {
        name: 'First Victory',
        description: 'Win your first match',
        iconUrl: 'https://api.dicebear.com/7.x/icons/svg?seed=trophy',
        criteria: 'wins >= 1',
      },
    }),
    prisma.achievement.create({
      data: {
        name: 'Five Streak',
        description: 'Win 5 matches in a row',
        iconUrl: 'https://api.dicebear.com/7.x/icons/svg?seed=fire',
        criteria: 'currentStreak >= 5',
      },
    }),
    prisma.achievement.create({
      data: {
        name: 'Ten Victories',
        description: 'Win a total of 10 matches',
        iconUrl: 'https://api.dicebear.com/7.x/icons/svg?seed=medal',
        criteria: 'wins >= 10',
      },
    }),
    prisma.achievement.create({
      data: {
        name: 'Legendary',
        description: 'Win 10 matches in a row',
        iconUrl: 'https://api.dicebear.com/7.x/icons/svg?seed=crown',
        criteria: 'currentStreak >= 10',
      },
    }),
    prisma.achievement.create({
      data: {
        name: 'Champion',
        description: 'Win 50 total matches',
        iconUrl: 'https://api.dicebear.com/7.x/icons/svg?seed=star',
        criteria: 'wins >= 50',
      },
    }),
  ]);

  console.log(`✅ Created ${achievements.length} achievements`);

  // Award some achievements
  await prisma.userAchievement.createMany({
    data: [
      { userId: alice.id, achievementId: achievements[0].id }, // First Victory
      { userId: alice.id, achievementId: achievements[2].id }, // Ten Victories
      { userId: bob.id, achievementId: achievements[0].id },
      { userId: bob.id, achievementId: achievements[2].id },
      { userId: diana.id, achievementId: achievements[0].id },
      { userId: diana.id, achievementId: achievements[1].id }, // Five Streak
      { userId: diana.id, achievementId: achievements[2].id },
      { userId: diana.id, achievementId: achievements[3].id }, // Legendary
    ],
  });

  console.log('✅ Awarded achievements to users');

  // Create friendships
  await prisma.friendship.createMany({
    data: [
      { requesterId: alice.id, addresseeId: bob.id, status: 'ACCEPTED' },
      { requesterId: alice.id, addresseeId: diana.id, status: 'ACCEPTED' },
      { requesterId: bob.id, addresseeId: charlie.id, status: 'ACCEPTED' },
      { requesterId: charlie.id, addresseeId: diana.id, status: 'PENDING' },
    ],
  });

  console.log('✅ Created friendships');

  // Create sample matches
  const match1 = await prisma.match.create({
    data: {
      roomId: 'room-sample-001',
      player1Id: alice.id,
      player2Id: bob.id,
      winnerId: alice.id,
      status: 'COMPLETED',
      onChainHash: '0xabcd1234567890abcd1234567890abcd1234567890abcd1234567890abcd1234',
      endedAt: new Date(),
    },
  });

  await prisma.matchMove.createMany({
    data: [
      {
        matchId: match1.id,
        roundNumber: 1,
        player1Move: 'rock',
        player2Move: 'scissors',
        roundWinnerId: alice.id,
      },
      {
        matchId: match1.id,
        roundNumber: 2,
        player1Move: 'paper',
        player2Move: 'rock',
        roundWinnerId: alice.id,
      },
    ],
  });

  const match2 = await prisma.match.create({
    data: {
      roomId: 'room-sample-002',
      player1Id: diana.id,
      player2Id: charlie.id,
      winnerId: diana.id,
      status: 'COMPLETED',
      onChainHash: '0xdef4567890abcdef4567890abcdef4567890abcdef4567890abcdef4567890ab',
      endedAt: new Date(),
    },
  });

  await prisma.matchMove.createMany({
    data: [
      {
        matchId: match2.id,
        roundNumber: 1,
        player1Move: 'scissors',
        player2Move: 'paper',
        roundWinnerId: diana.id,
      },
      {
        matchId: match2.id,
        roundNumber: 2,
        player1Move: 'rock',
        player2Move: 'rock',
        roundWinnerId: null, // Draw
      },
      {
        matchId: match2.id,
        roundNumber: 3,
        player1Move: 'paper',
        player2Move: 'rock',
        roundWinnerId: diana.id,
      },
    ],
  });

  console.log('✅ Created sample matches with move history');

  console.log('🎉 Database seeding completed successfully!');
  console.log('\n📋 Test Credentials:');
  console.log('   Email: alice@arena.com | Password: password123');
  console.log('   Email: bob@arena.com   | Password: password123');
  console.log('   Email: charlie@arena.com | Password: password123');
  console.log('   Email: diana@arena.com | Password: password123\n');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
