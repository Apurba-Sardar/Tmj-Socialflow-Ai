import { config } from 'dotenv';

config({ path: new URL('../../../.env', import.meta.url) });

const { PrismaClient, Role } = await import('@prisma/client');
const prisma = new PrismaClient();

const roleLabels = {
  [Role.SUPER_ADMIN]: 'Super Admin',
  [Role.ADMIN]: 'Admin',
  [Role.MANAGER]: 'Manager',
  [Role.CONTENT_WRITER]: 'Content Writer',
  [Role.DESIGNER]: 'Designer',
  [Role.REVIEWER]: 'Reviewer',
  [Role.PUBLISHER]: 'Publisher',
  [Role.VIEWER]: 'Viewer',
};

const permissions = [
  'dashboard.read',
  'wordpress.read',
  'wordpress.connect',
  'wordpress.sync',
  'campaign.read',
  'campaign.generate',
  'campaign.approve',
  'campaign.publish',
  'media.read',
  'media.write',
  'settings.read',
  'settings.write',
  'users.read',
  'users.write',
  'audit.read',
  'queue.read',
  'queue.manage',
];

const grants = {
  [Role.SUPER_ADMIN]: permissions,
  [Role.ADMIN]: permissions.filter((permission) => permission !== 'users.write'),
  [Role.MANAGER]: [
    'dashboard.read',
    'wordpress.read',
    'campaign.read',
    'campaign.generate',
    'campaign.approve',
    'media.read',
    'settings.read',
    'queue.read',
  ],
  [Role.CONTENT_WRITER]: ['dashboard.read', 'wordpress.read', 'campaign.read', 'campaign.generate', 'media.read'],
  [Role.DESIGNER]: ['dashboard.read', 'campaign.read', 'media.read', 'media.write'],
  [Role.REVIEWER]: ['dashboard.read', 'campaign.read', 'campaign.approve', 'media.read'],
  [Role.PUBLISHER]: ['dashboard.read', 'campaign.read', 'campaign.publish', 'queue.read'],
  [Role.VIEWER]: ['dashboard.read', 'wordpress.read', 'campaign.read', 'media.read'],
};

async function main() {
  console.log('Seeding enterprise organization...');
  const existingOrganization = await prisma.organization.findFirst({
    where: { slug: { in: ['tmj-socialflow-ai', 'socialflow-ai'] } },
  });
  const organization = existingOrganization
    ? await prisma.organization.update({
        where: { id: existingOrganization.id },
        data: {
          name: 'TMJ SocialFlow AI',
          slug: 'tmj-socialflow-ai',
        },
      })
    : await prisma.organization.create({
        data: {
          name: 'TMJ SocialFlow AI',
          slug: 'tmj-socialflow-ai',
        },
      });

  const permissionRecords = new Map();
  console.log('Seeding permissions...');
  await prisma.permission.createMany({
    data: permissions.map((key) => ({ key })),
    skipDuplicates: true,
  });
  const persistedPermissions = await prisma.permission.findMany({
    where: { key: { in: permissions } },
  });
  for (const permission of persistedPermissions) {
    permissionRecords.set(permission.key, permission);
  }

  const roleRecords = new Map();
  console.log('Seeding roles and permission grants...');
  for (const [key, name] of Object.entries(roleLabels)) {
    const role = await prisma.roleDefinition.upsert({
      where: {
        organizationId_key: {
          organizationId: organization.id,
          key,
        },
      },
      create: {
        organizationId: organization.id,
        key,
        name,
        system: true,
      },
      update: {
        name,
        system: true,
      },
    });
    roleRecords.set(key, role);
  }

  const rolePermissionRows = [];
  for (const [roleKey, permissionKeys] of Object.entries(grants)) {
    const role = roleRecords.get(roleKey);
    if (!role) {
      continue;
    }

    for (const permissionKey of permissionKeys) {
      const permission = permissionRecords.get(permissionKey);
      if (permission) {
        rolePermissionRows.push({
          roleId: role.id,
          permissionId: permission.id,
        });
      }
    }
  }

  if (rolePermissionRows.length) {
    await prisma.rolePermission.createMany({
      data: rolePermissionRows,
      skipDuplicates: true,
    });
  }

  console.log('Linking existing users to organization...');
  const users = await prisma.user.findMany();
  const adminRole = roleRecords.get(Role.ADMIN);
  const viewerRole = roleRecords.get(Role.VIEWER);

  for (const user of users) {
    const role = user.role === Role.ADMIN ? adminRole : viewerRole;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        defaultOrganizationId: user.defaultOrganizationId ?? organization.id,
      },
    });

    if (role) {
      await prisma.organizationMember.upsert({
        where: {
          organizationId_userId: {
            organizationId: organization.id,
            userId: user.id,
          },
        },
        create: {
          organizationId: organization.id,
          userId: user.id,
          roleId: role.id,
        },
        update: {
          roleId: role.id,
        },
      });
    }
  }

  console.log('Assigning WordPress sites to organization...');
  await prisma.wordPressConnection.updateMany({
    where: { organizationId: null },
    data: { organizationId: organization.id },
  });

  console.log('Enterprise seed complete.');
}

await main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
