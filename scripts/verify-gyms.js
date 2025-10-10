const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = 'https://yqqnpmhhemytzkeuuchv.supabase.co';
const supabaseKey = 'sb_publishable_MNc0NGCqI90hPBPyiBt1pQ_UYZvjCrp';
const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyGyms() {
  console.log('🔍 Verifying gym data in database...\n');

  try {
    // Get all gyms
    const { data: gyms, error } = await supabase
      .from('gyms')
      .select('*')
      .order('category', { ascending: true });

    if (error) {
      console.error('❌ Error fetching gyms:', error);
      return;
    }

    if (!gyms || gyms.length === 0) {
      console.log('❌ No gyms found in database');
      return;
    }

    console.log(`✅ Found ${gyms.length} gyms in database\n`);

    // Group by category
    const categories = {};
    gyms.forEach(gym => {
      if (!categories[gym.category]) {
        categories[gym.category] = [];
      }
      categories[gym.category].push(gym);
    });

    // Display summary
    Object.entries(categories).forEach(([category, gymsInCategory]) => {
      console.log(`📊 ${category.toUpperCase()} (${gymsInCategory.length} gyms):`);
      gymsInCategory.forEach(gym => {
        console.log(`  • ${gym.name} - ${gym.address}`);
      });
      console.log('');
    });

    // Check for any missing required fields
    const issues = [];
    gyms.forEach(gym => {
      if (!gym.name) issues.push(`Gym ${gym.id}: Missing name`);
      if (!gym.address) issues.push(`Gym ${gym.id}: Missing address`);
      if (!gym.latitude || !gym.longitude) issues.push(`Gym ${gym.id}: Missing coordinates`);
      if (!gym.category) issues.push(`Gym ${gym.id}: Missing category`);
    });

    if (issues.length > 0) {
      console.log('⚠️  Data quality issues found:');
      issues.forEach(issue => console.log(`  • ${issue}`));
    } else {
      console.log('✅ All gyms have complete data');
    }

    // Show some sample data
    console.log('\n📋 Sample gym data:');
    const sampleGym = gyms[0];
    console.log(`  Name: ${sampleGym.name}`);
    console.log(`  Address: ${sampleGym.address}`);
    console.log(`  Coordinates: ${sampleGym.latitude}, ${sampleGym.longitude}`);
    console.log(`  Category: ${sampleGym.category}`);
    console.log(`  Followers: ${sampleGym.followers.length}`);
    console.log(`  Current Users: ${sampleGym.current_users.length}`);

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the verification
if (require.main === module) {
  verifyGyms().catch(console.error);
}

module.exports = { verifyGyms };

