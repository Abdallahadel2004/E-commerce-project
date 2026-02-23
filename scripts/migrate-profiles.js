import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from root directory
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Debug: Check if env loaded
console.log(' Current directory:', process.cwd());
console.log(' MONGODB_URI:', process.env.MONGO_URI ? 'Found' : ' Not found');

import User from '../src/models/user.model.js';
import Profile from '../src/models/Profile.js';

async function migrateProfiles() {
  try {
    // Check if URI exists
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI is not defined in .env file');
    }

    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log(' Database connected');

    const users = await User.find();
    console.log(` Found ${users.length} users`);

    let created = 0;
    let skipped = 0;

    for (const user of users) {
      const existingProfile = await Profile.findOne({ userId: user._id });
      
      if (!existingProfile) {
        const nameParts = user.name.split(' ');
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(' ') || '';

        await Profile.create({
          userId: user._id,
          firstName,
          lastName,
          displayName: user.name,
          phone: user.phone || '',
          addresses: user.addresses || [],
          paymentMethods: user.paymentMethods || [],
          preferences: user.preferences || {
            newsletter: true,
            emailNotifications: true,
            language: 'en',
            currency: 'USD',
            theme: 'system'
          }
        });
        created++;
        console.log(` Created profile for ${user.email}`);
      } else {
        skipped++;
      }
    }

    console.log('\n Migration Complete:');
    console.log(`   Created: ${created} profiles`);
    console.log(`    Skipped: ${skipped} profiles`);

  } catch (error) {
    console.error(' Migration error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log(' Disconnected from database');
  }
}

migrateProfiles();
