import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, RoleEnum } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error('DATABASE_URL no está definida');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg(url),
});

const INVITATION_CODE_CHARACTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function createRandomInvitationCode(length = 6): string {
  return Array.from(
    { length },
    () =>
      INVITATION_CODE_CHARACTERS[
        Math.floor(Math.random() * INVITATION_CODE_CHARACTERS.length)
      ],
  ).join('');
}

async function generateInvitationCode(): Promise<string> {
  let invitationCode: string;

  do {
    invitationCode = createRandomInvitationCode();
  } while (await prisma.group.findFirst({ where: { invitationCode } }));

  return invitationCode;
}

async function main() {
  const usersData = [
    {
      name: 'Thomas',
      email: 'musicmanzana@gmail.com',
      password: 'password123',
    },
    { name: 'prueba', email: 'prueba@gmail.com', password: 'prueba123' },
    { name: 'prueba 2', email: 'prueba2@gmail.com', password: 'prueba123' },
    {
      name: 'prueba sin grupos',
      email: 'singrupos@gmail.com',
      password: 'prueba123',
    },
  ];

  const users: Record<string, { id: number }> = {};

  for (const u of usersData) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { emailVerifiedAt: new Date() },
      create: {
        name: u.name,
        email: u.email,
        passwordHash,
        emailVerifiedAt: new Date(),
      },
    });
    users[u.email] = user;
  }

  const thomas = users['musicmanzana@gmail.com'];
  const prueba = users['prueba@gmail.com'];
  const prueba2 = users['prueba2@gmail.com'];

  const groupsData = [
    {
      name: 'grupo1',
      description: null,
      shareLocationMandatorily: false,
      creatorId: thomas.id,
    },
    {
      name: 'grupo2',
      description: null,
      shareLocationMandatorily: true,
      creatorId: thomas.id,
    },
    {
      name: 'prueba grupo 1',
      description: null,
      shareLocationMandatorily: true,
      creatorId: prueba.id,
    },
  ];

  for (const g of groupsData) {
    const invitationCode = await generateInvitationCode();

    const group = await prisma.group.create({
      data: {
        name: g.name,
        description: g.description,
        shareLocationMandatorily: g.shareLocationMandatorily,
        invitationCode,
      },
    });

    await prisma.member.create({
      data: {
        userId: g.creatorId,
        groupId: group.id,
        role: RoleEnum.ADMIN,
      },
    });

    if (g.creatorId === prueba.id) {
      await prisma.member.create({
        data: {
          userId: prueba2.id,
          groupId: group.id,
          role: RoleEnum.MEMBER,
        },
      });
    }
  }

  console.log('Seed completado');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

// npx prisma db seed

// Para ver la BD: docker exec -it bond-back npx prisma studio --port 5555 --browser none
