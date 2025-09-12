# Database Seeding Scripts

This directory contains scripts to populate your Supabase database with gym data.

## Available Scripts

### 1. Manual Seeding (Recommended for testing)
```bash
npm run seed:gyms
```

This script adds 50+ pre-defined gyms from major chains across different categories:
- **Traditional Gyms**: Planet Fitness, Gold's Gym, LA Fitness, etc.
- **Climbing Gyms**: Movement Climbing, Earth Treks, Brooklyn Boulders, etc.
- **CrossFit**: CrossFit Central, F45 Training, Barry's Bootcamp, etc.
- **Martial Arts**: UFC Gym, Title Boxing Club, Gracie Barra, etc.
- **Specialty**: SoulCycle, Pure Barre, CorePower Yoga, etc.

### 2. Google Places API Seeding (For production)
```bash
npm run seed:gyms:google
```

This script uses the Google Places API to find real gyms in major US cities. **Requires Google Places API key.**

## Setup Instructions

### For Manual Seeding
No additional setup required. Just run:
```bash
npm run seed:gyms
```

### For Google Places API Seeding

1. **Get Google Places API Key**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing
   - Enable the Places API
   - Create credentials (API Key)
   - Restrict the key to Places API only

2. **Update the script**:
   ```javascript
   // In scripts/seed-gyms.js
   const GOOGLE_PLACES_API_KEY = 'YOUR_ACTUAL_API_KEY_HERE';
   ```

3. **Run the script**:
   ```bash
   npm run seed:gyms:google
   ```

## What the Scripts Do

### Manual Seeding
- Adds 50+ gyms across 5 categories
- Covers major US cities
- Includes popular gym chains
- No API calls required
- Fast execution

### Google Places API Seeding
- Searches 10 major US cities
- Finds gyms by type (gym, fitness_center, climbing_gym, etc.)
- Searches for specific gym chains
- Gets detailed information (address, coordinates, ratings)
- Categorizes gyms automatically
- Handles rate limiting and pagination

## Database Schema

The scripts populate the `gyms` table with:
- `name`: Gym name
- `address`: Full address
- `latitude`/`longitude`: GPS coordinates
- `category`: 'traditional', 'climbing', 'crossfit', 'martial_arts', 'specialty'
- `followers`: Array of user IDs (starts empty)
- `current_users`: Array of user IDs currently at gym (starts empty)

## Troubleshooting

### Common Issues

1. **"Gym already exists" messages**:
   - Normal behavior - script skips duplicates
   - Safe to run multiple times

2. **Google Places API errors**:
   - Check API key is correct
   - Ensure Places API is enabled
   - Check API quotas and billing

3. **Supabase connection errors**:
   - Verify URL and key in script
   - Check database permissions
   - Ensure tables exist

### Rate Limiting

The Google Places API script includes:
- 100ms delay between individual gyms
- 2 second delay between pages
- 2 second delay between cities
- Maximum 3 pages per gym type

## Customization

### Adding More Cities
Edit the `CITIES` array in `seed-gyms.js`:
```javascript
const CITIES = [
  { name: 'Your City', lat: 40.7128, lng: -74.0060, radius: 50000 },
  // ... existing cities
];
```

### Adding More Gym Types
Edit the `GYM_TYPES` array:
```javascript
const GYM_TYPES = [
  'gym',
  'fitness_center',
  'your_new_type',
  // ... existing types
];
```

### Adding More Chains
Edit the `MAJOR_GYM_CHAINS` array:
```javascript
const MAJOR_GYM_CHAINS = [
  'Your Gym Chain',
  // ... existing chains
];
```

## Output

Both scripts will show:
- Progress as gyms are added
- Final count of added gyms
- Summary by category
- Any errors encountered

Example output:
```
🚀 Starting gym database seeding...
📍 Will add 50 gyms

✅ Added: Planet Fitness - Times Square (traditional)
✅ Added: Movement Climbing - Denver (climbing)
⏭️  Skipped: Gold's Gym - Venice Beach (already exists)

🎉 Seeding complete!
✅ Added: 45 gyms
⏭️  Skipped: 5 gyms

📊 Summary by category:
  traditional: 20 gyms
  climbing: 15 gyms
  crossfit: 8 gyms
  martial_arts: 5 gyms
  specialty: 7 gyms
```

