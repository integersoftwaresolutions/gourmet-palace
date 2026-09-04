require('dotenv').config();

const { connectDB } = require('../config/db');
const env = require('../config/env');
const Organization = require('../models/Organization');
const User = require('../models/User');
const Location = require('../models/Location');
const { hashPassword } = require('../utils/password');

function configuredLocations(){try{const rows=JSON.parse(env.seed.locationsJson||'[]');return Array.isArray(rows)?rows:[]}catch{throw new Error('SEED_LOCATIONS_JSON must be a JSON array')}}

async function seedAdmin() {
  await connectDB();

  let org = await Organization.findOne({ slug: env.seed.orgSlug });
  if (!org) {
    org = await Organization.create({
      name: env.seed.orgName,
      slug: env.seed.orgSlug,
      status: 'active',
    });
    console.log(`Created organization: ${org.name} (${org.id})`);
  } else {
    console.log(`Organization exists: ${org.name} (${org.id})`);
  }

  if (env.nodeEnv === 'production' && (!process.env.SEED_ADMIN_PASSWORD || env.seed.adminPassword === 'Password1' || env.seed.adminPassword === 'change-before-production')) throw new Error('Set a strong SEED_ADMIN_PASSWORD before production bootstrap');

  for (const loc of configuredLocations()) {
    const existingLoc = await Location.findOne({
      organizationId: org._id,
      name: loc.name,
    });
    if (!existingLoc) {
      await Location.create({
        organizationId: org._id,
        ...loc,
        status: 'active',
      });
      console.log(`Created location: ${loc.name}`);
    } else {
      console.log(`Location exists: ${loc.name}`);
    }
  }

  const email = env.seed.adminEmail.toLowerCase();
  let user = await User.findOne({ email });
  if (!user) {
    const passwordHash = await hashPassword(env.seed.adminPassword);
    user = await User.create({
      organizationId: org._id,
      name: env.seed.adminName,
      email,
      passwordHash,
      role: 'owner',
      locationIds: [],
      isActive: true,
    });
    console.log('Seeded Owner/Admin account:');
  } else {
    console.log(`Admin user already exists: ${email}`);
  }

  console.log(`  name:  ${user.name}`);
  console.log(`  email: ${user.email}`);
  console.log(`  role:  ${user.role}`);
  console.log(`  org:   ${org.slug}`);
  process.exit(0);
}

seedAdmin().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
