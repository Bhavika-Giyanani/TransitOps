import { prisma } from '../../db';

export async function findDriverForUser(userId: string, tenantId: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId, tenantId },
    select: { driverId: true },
  });
  return prisma.driver.findFirst({
    where: {
      tenantId,
      OR: [
        { identityUserId: userId },
        ...(user?.driverId ? [{ id: user.driverId }] : []),
      ],
    },
  });
}
