import { prisma } from '../../db';
import {
  licenceExpiryError,
  normalizeIndianPhoneNumber,
  normalizeLicence,
} from '../../../../shared/indianFormats';
import { getIndianDateString } from '../../utils/indianDate';

export interface DriverAccountDetails {
  id: string;
  tenantId: string;
  role: string;
  email: string;
  fullName: string;
  driverId: string | null;
  contactNumber: string | null;
  licenseNumber: string | null;
  licenseCategory: string | null;
  licenseExpiryDate: string | null;
}

export async function ensureDriverProfile(user: DriverAccountDetails): Promise<boolean> {
  if (user.role !== 'driver') return true;

  let driver = await prisma.driver.findFirst({
    where: {
      tenantId: user.tenantId,
      OR: [
        { identityUserId: user.id },
        ...(user.driverId ? [{ id: user.driverId }] : []),
      ],
    },
  });
  if (!driver && user.licenseNumber) {
    const licence = normalizeLicence(user.licenseNumber);
    if (licence.ok) {
      driver = await prisma.driver.findFirst({
        where: { tenantId: user.tenantId, licenseNumber: licence.value },
      });
    }
  }
  if (driver?.identityUserId && driver.identityUserId !== user.id) return false;

  if (driver?.identityUserId === user.id) {
    if (user.driverId !== driver.id) {
      await prisma.user.update({ where: { id: user.id }, data: { driverId: driver.id } });
    }
    return true;
  }

  const contactNumber = user.contactNumber ?? driver?.contactNumber;
  const licenseNumber = user.licenseNumber ?? driver?.licenseNumber;
  const licenseCategory = user.licenseCategory ?? driver?.licenseCategory;
  const licenseExpiryDate = user.licenseExpiryDate ?? driver?.licenseExpiryDate;
  const phone = contactNumber ? normalizeIndianPhoneNumber(contactNumber) : null;
  const licence = licenseNumber ? normalizeLicence(licenseNumber) : null;
  const expiryError = licence?.ok && licenseExpiryDate
    ? licenceExpiryError(licence.value, licenseExpiryDate)
    : 'Driver profile details are incomplete.';
  if (!phone?.ok || !licence?.ok || !licenseCategory || !licenseExpiryDate || expiryError) return false;

  const expired = licenseExpiryDate < getIndianDateString();
  await prisma.$transaction(async (transaction) => {
    const linkedDriver = driver
      ? await transaction.driver.update({
        where: { id: driver.id },
        data: {
          identityUserId: user.id,
          name: user.fullName,
          email: user.email,
          contactNumber: phone.value,
          licenseNumber: licence.value,
          licenseCategory,
          licenseExpiryDate,
          ...(expired ? { status: 'Suspended' } : {}),
        },
      })
      : await transaction.driver.create({
        data: {
          tenantId: user.tenantId,
          identityUserId: user.id,
          name: user.fullName,
          email: user.email,
          contactNumber: phone.value,
          licenseNumber: licence.value,
          licenseCategory,
          licenseExpiryDate,
          safetyScore: 100,
          status: expired ? 'Suspended' : 'Available',
        },
      });
    await transaction.user.update({
      where: { id: user.id },
      data: {
        driverId: linkedDriver.id,
        contactNumber: phone.value,
        licenseNumber: licence.value,
        licenseCategory,
        licenseExpiryDate,
      },
    });
  });
  return true;
}
