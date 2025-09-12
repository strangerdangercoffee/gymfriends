const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

// Supabase configuration
const supabaseUrl = 'https://yqqnpmhhemytzkeuuchv.supabase.co';
const supabaseKey = 'sb_publishable_MNc0NGCqI90hPBPyiBt1pQ_UYZvjCrp';
const supabase = createClient(supabaseUrl, supabaseKey);

// Google Places API configuration
const GOOGLE_PLACES_API_KEY = 'YOUR_GOOGLE_PLACES_API_KEY'; // Replace with your actual API key
const GOOGLE_PLACES_BASE_URL = 'https://maps.googleapis.com/maps/api/place';

// Major cities to search for gyms
const CITIES = [
  { name: 'New York', lat: 40.7128, lng: -74.0060, radius: 50000 },
  { name: 'Los Angeles', lat: 34.0522, lng: -118.2437, radius: 50000 },
  { name: 'Chicago', lat: 41.8781, lng: -87.6298, radius: 50000 },
  { name: 'Houston', lat: 29.7604, lng: -95.3698, radius: 50000 },
  { name: 'Phoenix', lat: 33.4484, lng: -112.0740, radius: 50000 },
  { name: 'Philadelphia', lat: 39.9526, lng: -75.1652, radius: 50000 },
  { name: 'San Antonio', lat: 29.4241, lng: -98.4936, radius: 50000 },
  { name: 'San Diego', lat: 32.7157, lng: -117.1611, radius: 50000 },
  { name: 'Dallas', lat: 32.7767, lng: -96.7970, radius: 50000 },
  { name: 'San Jose', lat: 37.3382, lng: -121.8863, radius: 50000 },
];

// Gym-related place types to search for
const GYM_TYPES = [
  'gym',
  'fitness_center',
  'health',
  'sports_complex',
  'climbing_gym',
  'martial_arts',
  'yoga_studio',
  'pilates_studio',
  'crossfit',
  'boxing_gym',
];

// Major gym chains to prioritize
const MAJOR_GYM_CHAINS = [
  'Planet Fitness',
  'Gold\'s Gym',
  'LA Fitness',
  '24 Hour Fitness',
  'Crunch Fitness',
  'Anytime Fitness',
  'Lifetime Fitness',
  'Equinox',
  'YMCA',
  'Orange Theory Fitness',
  'F45 Training',
  'Pure Barre',
  'SoulCycle',
  'Barry\'s Bootcamp',
  'CorePower Yoga',
  'Movement Climbing',
  'Earth Treks',
  'The Spot Bouldering Gym',
  'Bouldering Project',
  'Mesa Rim Climbing',
  'Vertical World',
  'Brooklyn Boulders',
  'Touchstone Climbing',
  'Planet Granite',
  'Cliffs LIC',
  'Central Rock Gym',
  'First Ascent',
  'Stone Summit',
  'Momentum Indoor Climbing',
  'Sender One Climbing',
  'Upper Limits',
  'Rocks and Ropes',
  'Climb Zone',
  'Rock Spot Climbing',
  'Summit Climbing',
  'Hangar 18',
  'Vertical Adventures',
  'Rocky Top Climbing Gym',
  'Inner Peaks',
  'Rock\'n & Jam\'n',
  'The Phoenix Rock Gym',
  'Hoosier Heights',
  'Vertical Endeavors',
  'Quest Fitness',
  'UFC Gym',
  'Title Boxing Club',
  '9Round',
  'Hot Yoga',
  'Bikram Yoga',
  'Club Pilates',
  'The Barre Code',
  'CycleBar',
  'Flywheel Sports',
];

// Function to categorize gym based on name and types
function categorizeGym(name, types = []) {
  const nameLower = name.toLowerCase();
  
  // Climbing gyms
  if (nameLower.includes('climbing') || 
      nameLower.includes('boulder') || 
      nameLower.includes('rock') ||
      nameLower.includes('summit') ||
      nameLower.includes('vertical') ||
      nameLower.includes('cliff') ||
      nameLower.includes('ascent') ||
      nameLower.includes('momentum') ||
      nameLower.includes('sender') ||
      nameLower.includes('hangar') ||
      nameLower.includes('peaks') ||
      nameLower.includes('phoenix') ||
      nameLower.includes('quest') ||
      types.includes('climbing_gym')) {
    return 'climbing';
  }
  
  // CrossFit
  if (nameLower.includes('crossfit') || 
      nameLower.includes('cross fit') ||
      nameLower.includes('f45') ||
      nameLower.includes('barry\'s') ||
      nameLower.includes('barrys') ||
      types.includes('crossfit')) {
    return 'crossfit';
  }
  
  // Martial Arts
  if (nameLower.includes('martial') || 
      nameLower.includes('karate') ||
      nameLower.includes('taekwondo') ||
      nameLower.includes('judo') ||
      nameLower.includes('boxing') ||
      nameLower.includes('ufc') ||
      nameLower.includes('title boxing') ||
      nameLower.includes('9round') ||
      nameLower.includes('jiu jitsu') ||
      nameLower.includes('jiujitsu') ||
      nameLower.includes('muay thai') ||
      nameLower.includes('kickboxing') ||
      types.includes('martial_arts')) {
    return 'martial_arts';
  }
  
  // Specialty (Yoga, Pilates, etc.)
  if (nameLower.includes('yoga') || 
      nameLower.includes('pilates') ||
      nameLower.includes('barre') ||
      nameLower.includes('soulcycle') ||
      nameLower.includes('cyclebar') ||
      nameLower.includes('flywheel') ||
      nameLower.includes('hot yoga') ||
      nameLower.includes('bikram') ||
      nameLower.includes('club pilates') ||
      nameLower.includes('pure barre') ||
      nameLower.includes('the barre code') ||
      types.includes('yoga_studio') ||
      types.includes('pilates_studio')) {
    return 'specialty';
  }
  
  // Default to traditional
  return 'traditional';
}

// Function to search for places using Google Places API
async function searchPlaces(city, type, nextPageToken = null) {
  const url = `${GOOGLE_PLACES_BASE_URL}/nearbysearch/json`;
  const params = {
    key: GOOGLE_PLACES_API_KEY,
    location: `${city.lat},${city.lng}`,
    radius: city.radius,
    type: type,
    ...(nextPageToken && { pagetoken: nextPageToken }),
  };

  try {
    const response = await axios.get(url, { params });
    return response.data;
  } catch (error) {
    console.error(`Error searching for ${type} in ${city.name}:`, error.message);
    return null;
  }
}

// Function to get detailed place information
async function getPlaceDetails(placeId) {
  const url = `${GOOGLE_PLACES_BASE_URL}/details/json`;
  const params = {
    key: GOOGLE_PLACES_API_KEY,
    place_id: placeId,
    fields: 'name,formatted_address,geometry,types,rating,user_ratings_total,opening_hours,website,formatted_phone_number',
  };

  try {
    const response = await axios.get(url, { params });
    return response.data.result;
  } catch (error) {
    console.error(`Error getting details for place ${placeId}:`, error.message);
    return null;
  }
}

// Function to check if gym already exists in database
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
    .insert([gymData])
    .select();

  if (error) {
    console.error('Error inserting gym:', error);
    return null;
  }

  return data[0];
}

// Function to process and save gym data
async function processGym(place, city) {
  const details = await getPlaceDetails(place.place_id);
  if (!details) return null;

  const name = details.name;
  const address = details.formatted_address;
  
  // Check if gym already exists
  if (await gymExists(name, address)) {
    console.log(`Gym already exists: ${name}`);
    return null;
  }

  const category = categorizeGym(name, details.types);
  
  const gymData = {
    name,
    address,
    latitude: details.geometry.location.lat,
    longitude: details.geometry.location.lng,
    category,
    followers: [],
    current_users: [],
  };

  const insertedGym = await insertGym(gymData);
  if (insertedGym) {
    console.log(`✅ Added gym: ${name} (${category}) in ${city.name}`);
    return insertedGym;
  }

  return null;
}

// Function to search for gyms in a specific city
async function searchGymsInCity(city) {
  console.log(`\n🔍 Searching for gyms in ${city.name}...`);
  const allGyms = [];

  for (const type of GYM_TYPES) {
    console.log(`  Searching for ${type}...`);
    let nextPageToken = null;
    let pageCount = 0;
    const maxPages = 3; // Limit to 3 pages per type to avoid API limits

    do {
      const results = await searchPlaces(city, type, nextPageToken);
      if (!results || results.status !== 'OK') {
        console.log(`    No results for ${type}`);
        break;
      }

      console.log(`    Found ${results.results.length} places for ${type}`);
      
      // Process each place
      for (const place of results.results) {
        const gym = await processGym(place, city);
        if (gym) {
          allGyms.push(gym);
        }
        
        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      nextPageToken = results.next_page_token;
      pageCount++;
      
      // Wait for next page token to become valid
      if (nextPageToken) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } while (nextPageToken && pageCount < maxPages);
  }

  return allGyms;
}

// Function to search for specific gym chains
async function searchGymChains(city) {
  console.log(`\n🏢 Searching for major gym chains in ${city.name}...`);
  const chainGyms = [];

  for (const chainName of MAJOR_GYM_CHAINS) {
    const url = `${GOOGLE_PLACES_BASE_URL}/textsearch/json`;
    const params = {
      key: GOOGLE_PLACES_API_KEY,
      query: `${chainName} ${city.name}`,
      location: `${city.lat},${city.lng}`,
      radius: city.radius,
    };

    try {
      const response = await axios.get(url, { params });
      const results = response.data;

      if (results.status === 'OK' && results.results.length > 0) {
        console.log(`  Found ${results.results.length} ${chainName} locations`);
        
        for (const place of results.results) {
          const gym = await processGym(place, city);
          if (gym) {
            chainGyms.push(gym);
          }
          
          // Add delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    } catch (error) {
      console.error(`Error searching for ${chainName}:`, error.message);
    }
  }

  return chainGyms;
}

// Main function to seed the database
async function seedGyms() {
  console.log('🚀 Starting gym database seeding...');
  console.log(`📍 Will search in ${CITIES.length} cities`);
  console.log(`🏋️ Looking for ${GYM_TYPES.length} gym types`);
  console.log(`🏢 Searching for ${MAJOR_GYM_CHAINS.length} major chains\n`);

  if (GOOGLE_PLACES_API_KEY === 'YOUR_GOOGLE_PLACES_API_KEY') {
    console.error('❌ Please set your Google Places API key in the script');
    return;
  }

  let totalGyms = 0;

  for (const city of CITIES) {
    try {
      // Search for gyms by type
      const typeGyms = await searchGymsInCity(city);
      
      // Search for major gym chains
      const chainGyms = await searchGymChains(city);
      
      const cityTotal = typeGyms.length + chainGyms.length;
      totalGyms += cityTotal;
      
      console.log(`\n✅ ${city.name}: Added ${cityTotal} gyms`);
      
      // Add delay between cities to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.error(`Error processing ${city.name}:`, error);
    }
  }

  console.log(`\n🎉 Seeding complete! Added ${totalGyms} gyms total`);
  
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

module.exports = { seedGyms, searchGymsInCity, searchGymChains };

