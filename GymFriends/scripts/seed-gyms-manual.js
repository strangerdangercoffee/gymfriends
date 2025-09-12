const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = 'https://yqqnpmhhemytzkeuuchv.supabase.co';
const supabaseKey = 'sb_publishable_MNc0NGCqI90hPBPyiBt1pQ_UYZvjCrp';
const supabase = createClient(supabaseUrl, supabaseKey);

// Manual gym data - major chains with sample locations
const GYM_DATA = [
  // Traditional Gyms
  {
    name: 'Planet Fitness - Times Square',
    address: '234 W 42nd St, New York, NY 10036',
    latitude: 40.7589,
    longitude: -73.9851,
    category: 'traditional'
  },
  {
    name: 'Planet Fitness - Downtown LA',
    address: '123 S Broadway, Los Angeles, CA 90012',
    latitude: 34.0522,
    longitude: -118.2437,
    category: 'traditional'
  },
  {
    name: 'Gold\'s Gym - Venice Beach',
    address: '360 Hampton Dr, Venice, CA 90291',
    latitude: 33.9850,
    longitude: -118.4695,
    category: 'traditional'
  },
  {
    name: 'LA Fitness - Manhattan',
    address: '200 E 23rd St, New York, NY 10010',
    latitude: 40.7389,
    longitude: -73.9857,
    category: 'traditional'
  },
  {
    name: '24 Hour Fitness - Chicago',
    address: '875 N Michigan Ave, Chicago, IL 60611',
    latitude: 41.8986,
    longitude: -87.6229,
    category: 'traditional'
  },
  {
    name: 'Crunch Fitness - Houston',
    address: '1200 Main St, Houston, TX 77002',
    latitude: 29.7604,
    longitude: -95.3698,
    category: 'traditional'
  },
  {
    name: 'Anytime Fitness - Phoenix',
    address: '123 N Central Ave, Phoenix, AZ 85004',
    latitude: 33.4484,
    longitude: -112.0740,
    category: 'traditional'
  },
  {
    name: 'Lifetime Fitness - Philadelphia',
    address: '456 Market St, Philadelphia, PA 19106',
    latitude: 39.9526,
    longitude: -75.1652,
    category: 'traditional'
  },
  {
    name: 'Equinox - San Francisco',
    address: '789 Mission St, San Francisco, CA 94103',
    latitude: 37.7749,
    longitude: -122.4194,
    category: 'traditional'
  },
  {
    name: 'YMCA - Dallas',
    address: '321 Elm St, Dallas, TX 75201',
    latitude: 32.7767,
    longitude: -96.7970,
    category: 'traditional'
  },

  // Climbing Gyms
  {
    name: 'Movement Climbing - Denver',
    address: '1234 W 32nd Ave, Denver, CO 80211',
    latitude: 39.7392,
    longitude: -104.9903,
    category: 'climbing'
  },
  {
    name: 'Earth Treks - Rockville',
    address: '456 Hungerford Dr, Rockville, MD 20850',
    latitude: 39.0840,
    longitude: -77.1528,
    category: 'climbing'
  },
  {
    name: 'The Spot Bouldering Gym - Boulder',
    address: '3240 28th St, Boulder, CO 80301',
    latitude: 40.0150,
    longitude: -105.2705,
    category: 'climbing'
  },
  {
    name: 'Bouldering Project - Seattle',
    address: '1234 12th Ave, Seattle, WA 98122',
    latitude: 47.6062,
    longitude: -122.3321,
    category: 'climbing'
  },
  {
    name: 'Mesa Rim Climbing - San Diego',
    address: '7890 Miramar Rd, San Diego, CA 92126',
    latitude: 32.8880,
    longitude: -117.1017,
    category: 'climbing'
  },
  {
    name: 'Vertical World - Seattle',
    address: '1234 15th Ave W, Seattle, WA 98119',
    latitude: 47.6205,
    longitude: -122.3493,
    category: 'climbing'
  },
  {
    name: 'Brooklyn Boulders - Brooklyn',
    address: '575 Degraw St, Brooklyn, NY 11217',
    latitude: 40.6782,
    longitude: -73.9442,
    category: 'climbing'
  },
  {
    name: 'Touchstone Climbing - San Francisco',
    address: '1234 Mission St, San Francisco, CA 94103',
    latitude: 37.7749,
    longitude: -122.4194,
    category: 'climbing'
  },
  {
    name: 'Central Rock Gym - Boston',
    address: '456 Massachusetts Ave, Cambridge, MA 02139',
    latitude: 42.3736,
    longitude: -71.1097,
    category: 'climbing'
  },
  {
    name: 'First Ascent - Chicago',
    address: '789 N Milwaukee Ave, Chicago, IL 60642',
    latitude: 41.8951,
    longitude: -87.6556,
    category: 'climbing'
  },

  // CrossFit Gyms
  {
    name: 'CrossFit Central - Austin',
    address: '1234 S Lamar Blvd, Austin, TX 78704',
    latitude: 30.2672,
    longitude: -97.7431,
    category: 'crossfit'
  },
  {
    name: 'CrossFit NYC - Manhattan',
    address: '456 W 19th St, New York, NY 10011',
    latitude: 40.7421,
    longitude: -74.0018,
    category: 'crossfit'
  },
  {
    name: 'F45 Training - Los Angeles',
    address: '789 Sunset Blvd, West Hollywood, CA 90069',
    latitude: 34.0900,
    longitude: -118.3617,
    category: 'crossfit'
  },
  {
    name: 'Barry\'s Bootcamp - Miami',
    address: '1234 Lincoln Rd, Miami Beach, FL 33139',
    latitude: 25.7907,
    longitude: -80.1300,
    category: 'crossfit'
  },
  {
    name: 'CrossFit Invictus - San Diego',
    address: '456 7th Ave, San Diego, CA 92101',
    latitude: 32.7157,
    longitude: -117.1611,
    category: 'crossfit'
  },

  // Martial Arts
  {
    name: 'UFC Gym - Las Vegas',
    address: '1234 Las Vegas Blvd, Las Vegas, NV 89101',
    latitude: 36.1699,
    longitude: -115.1398,
    category: 'martial_arts'
  },
  {
    name: 'Title Boxing Club - Chicago',
    address: '789 N State St, Chicago, IL 60610',
    latitude: 41.8994,
    longitude: -87.6283,
    category: 'martial_arts'
  },
  {
    name: '9Round - Atlanta',
    address: '456 Peachtree St, Atlanta, GA 30309',
    latitude: 33.7490,
    longitude: -84.3880,
    category: 'martial_arts'
  },
  {
    name: 'Gracie Barra - Los Angeles',
    address: '1234 Wilshire Blvd, Los Angeles, CA 90017',
    latitude: 34.0522,
    longitude: -118.2437,
    category: 'martial_arts'
  },
  {
    name: 'American Top Team - Miami',
    address: '789 Biscayne Blvd, Miami, FL 33132',
    latitude: 25.7743,
    longitude: -80.1937,
    category: 'martial_arts'
  },

  // Specialty Gyms
  {
    name: 'SoulCycle - New York',
    address: '1234 Broadway, New York, NY 10001',
    latitude: 40.7505,
    longitude: -73.9934,
    category: 'specialty'
  },
  {
    name: 'Pure Barre - Beverly Hills',
    address: '456 Rodeo Dr, Beverly Hills, CA 90210',
    latitude: 34.0736,
    longitude: -118.4004,
    category: 'specialty'
  },
  {
    name: 'CorePower Yoga - Denver',
    address: '789 16th St, Denver, CO 80202',
    latitude: 39.7392,
    longitude: -104.9903,
    category: 'specialty'
  },
  {
    name: 'Orange Theory Fitness - Austin',
    address: '1234 S Lamar Blvd, Austin, TX 78704',
    latitude: 30.2672,
    longitude: -97.7431,
    category: 'specialty'
  },
  {
    name: 'Club Pilates - San Francisco',
    address: '456 Market St, San Francisco, CA 94105',
    latitude: 37.7749,
    longitude: -122.4194,
    category: 'specialty'
  },
  {
    name: 'CycleBar - Boston',
    address: '789 Newbury St, Boston, MA 02116',
    latitude: 42.3503,
    longitude: -71.0809,
    category: 'specialty'
  },
  {
    name: 'Hot Yoga - Seattle',
    address: '1234 Pine St, Seattle, WA 98101',
    latitude: 47.6062,
    longitude: -122.3321,
    category: 'specialty'
  },
  {
    name: 'The Barre Code - Chicago',
    address: '456 N Wells St, Chicago, IL 60654',
    latitude: 41.8902,
    longitude: -87.6334,
    category: 'specialty'
  }
];

// Function to check if gym already exists
async function gymExists(name, address) {
  const { data, error } = await supabase
    .from('gyms')
    .select('id')
    .eq('name', name)
    .eq('address', address)
    .single();

  return !error && data;
}

// Function to insert gym into database
async function insertGym(gymData) {
  const { data, error } = await supabase
    .from('gyms')
    .insert([{
      ...gymData,
      followers: [],
      current_users: [],
    }])
    .select();

  if (error) {
    console.error('Error inserting gym:', error);
    return null;
  }

  return data[0];
}

// Main function to seed the database
async function seedGyms() {
  console.log('🚀 Starting manual gym database seeding...');
  console.log(`📍 Will add ${GYM_DATA.length} gyms\n`);

  let addedCount = 0;
  let skippedCount = 0;

  for (const gymData of GYM_DATA) {
    try {
      // Check if gym already exists
      if (await gymExists(gymData.name, gymData.address)) {
        console.log(`⏭️  Skipped: ${gymData.name} (already exists)`);
        skippedCount++;
        continue;
      }

      // Insert gym
      const insertedGym = await insertGym(gymData);
      if (insertedGym) {
        console.log(`✅ Added: ${gymData.name} (${gymData.category})`);
        addedCount++;
      } else {
        console.log(`❌ Failed: ${gymData.name}`);
      }

      // Add small delay to avoid overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      console.error(`Error processing ${gymData.name}:`, error);
    }
  }

  console.log(`\n🎉 Seeding complete!`);
  console.log(`✅ Added: ${addedCount} gyms`);
  console.log(`⏭️  Skipped: ${skippedCount} gyms`);
  
  // Show summary by category
  const { data: summary } = await supabase
    .from('gyms')
    .select('category')
    .then(result => {
      const categories = {};
      result.data?.forEach(gym => {
        categories[gym.category] = (categories[gym.category] || 0) + 1;
      });
      return { data: categories };
    });

  console.log('\n📊 Summary by category:');
  Object.entries(summary || {}).forEach(([category, count]) => {
    console.log(`  ${category}: ${count} gyms`);
  });
}

// Run the seeding script
if (require.main === module) {
  seedGyms().catch(console.error);
}

module.exports = { seedGyms, GYM_DATA };

