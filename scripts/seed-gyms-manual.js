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

  // Climbing Gyms - United States (West Coast)
  {
    name: 'Movement Climbing - Denver',
    address: '1234 W 32nd Ave, Denver, CO 80211',
    latitude: 39.7392,
    longitude: -104.9903,
    category: 'climbing'
  },
  {
    name: 'Movement Climbing - Boulder',
    address: '3285 30th St, Boulder, CO 80301',
    latitude: 40.0276,
    longitude: -105.2519,
    category: 'climbing'
  },
  {
    name: 'Movement Climbing - Portland',
    address: '520 NE 17th Ave, Portland, OR 97232',
    latitude: 45.5231,
    longitude: -122.6481,
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
    address: '804 NW 96th St, Seattle, WA 98117',
    latitude: 47.6980,
    longitude: -122.3644,
    category: 'climbing'
  },
  {
    name: 'Bouldering Project - Portland',
    address: '3946 N Mississippi Ave, Portland, OR 97227',
    latitude: 45.5520,
    longitude: -122.6750,
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
    name: 'Mesa Rim Climbing - Reno',
    address: '1000 E 2nd St, Reno, NV 89512',
    latitude: 39.5296,
    longitude: -119.8108,
    category: 'climbing'
  },
  {
    name: 'Vertical World - Seattle',
    address: '2123 W Elmore St, Seattle, WA 98199',
    latitude: 47.6365,
    longitude: -122.3953,
    category: 'climbing'
  },
  {
    name: 'Stone Gardens - Seattle',
    address: '2839 NW Market St, Seattle, WA 98107',
    latitude: 47.6686,
    longitude: -122.3985,
    category: 'climbing'
  },
  {
    name: 'Touchstone Climbing - Mission Cliffs',
    address: '2295 Harrison St, San Francisco, CA 94110',
    latitude: 37.7599,
    longitude: -122.4148,
    category: 'climbing'
  },
  {
    name: 'Touchstone Climbing - Dog Patch Boulders',
    address: '2573 3rd St, San Francisco, CA 94107',
    latitude: 37.7576,
    longitude: -122.3891,
    category: 'climbing'
  },
  {
    name: 'Touchstone Climbing - Berkeley Ironworks',
    address: '800 Potter St, Berkeley, CA 94710',
    latitude: 37.8560,
    longitude: -122.3005,
    category: 'climbing'
  },
  {
    name: 'Planet Granite - San Francisco',
    address: '924 Mason St, San Francisco, CA 94129',
    latitude: 37.8049,
    longitude: -122.4396,
    category: 'climbing'
  },
  {
    name: 'Sender One - Los Angeles',
    address: '11414 Penrose St, Los Angeles, CA 91352',
    latitude: 34.2637,
    longitude: -118.4850,
    category: 'climbing'
  },
  {
    name: 'Hangar 18 - Riverside',
    address: '4904 Durahart St, Riverside, CA 92509',
    latitude: 33.9533,
    longitude: -117.4419,
    category: 'climbing'
  },
  {
    name: 'Rock n Road - San Diego',
    address: '2950 Kurtz St, San Diego, CA 92110',
    latitude: 32.7550,
    longitude: -117.2135,
    category: 'climbing'
  },
  {
    name: 'Rocknasium - Davis',
    address: '720 Olive Dr, Davis, CA 95616',
    latitude: 38.5449,
    longitude: -121.7405,
    category: 'climbing'
  },
  {
    name: 'The Circuit - Portland',
    address: '6050 SE 92nd Ave, Portland, OR 97266',
    latitude: 45.4780,
    longitude: -122.5712,
    category: 'climbing'
  },
  {
    name: 'PRG - Phoenix Rock Gym',
    address: '1353 E University Dr, Tempe, AZ 85281',
    latitude: 33.4220,
    longitude: -111.9212,
    category: 'climbing'
  },

  // Climbing Gyms - United States (East Coast)
  {
    name: 'Brooklyn Boulders - Brooklyn',
    address: '575 Degraw St, Brooklyn, NY 11217',
    latitude: 40.6782,
    longitude: -73.9442,
    category: 'climbing'
  },
  {
    name: 'Brooklyn Boulders - Queens',
    address: '23-10 41st Ave, Queens, NY 11101',
    latitude: 40.7512,
    longitude: -73.9395,
    category: 'climbing'
  },
  {
    name: 'The Cliffs - Long Island City',
    address: '11-11 44th Dr, Queens, NY 11101',
    latitude: 40.7467,
    longitude: -73.9503,
    category: 'climbing'
  },
  {
    name: 'The Cliffs - Harlem',
    address: '2637 Broadway, New York, NY 10025',
    latitude: 40.7955,
    longitude: -73.9725,
    category: 'climbing'
  },
  {
    name: 'Brooklyn Boulders - Somerville',
    address: '12A Tyler St, Somerville, MA 02143',
    latitude: 42.3875,
    longitude: -71.0995,
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
    name: 'Central Rock Gym - Cambridge',
    address: '74 Fawcett St, Cambridge, MA 02138',
    latitude: 42.3910,
    longitude: -71.1439,
    category: 'climbing'
  },
  {
    name: 'Rock Spot Climbing - Providence',
    address: '101 Gladstone St, Providence, RI 02907',
    latitude: 41.8165,
    longitude: -71.4131,
    category: 'climbing'
  },
  {
    name: 'Earth Treks - Rockville',
    address: '725 Rockville Pike, Rockville, MD 20852',
    latitude: 39.0840,
    longitude: -77.1528,
    category: 'climbing'
  },
  {
    name: 'Earth Treks - Crystal City',
    address: '2001 Jefferson Davis Hwy, Arlington, VA 22202',
    latitude: 38.8575,
    longitude: -77.0503,
    category: 'climbing'
  },
  {
    name: 'Movement Climbing - DC',
    address: '3070 Wilson Blvd, Arlington, VA 22201',
    latitude: 38.8896,
    longitude: -77.0953,
    category: 'climbing'
  },
  {
    name: 'Philadelphia Rock Gyms - Oaks',
    address: '416 Kimberton Rd, Phoenixville, PA 19460',
    latitude: 40.1478,
    longitude: -75.4555,
    category: 'climbing'
  },
  {
    name: 'Climb So iLL - St. Louis',
    address: '3000 Chouteau Ave, St. Louis, MO 63103',
    latitude: 38.6270,
    longitude: -90.2143,
    category: 'climbing'
  },
  {
    name: 'Triangle Rock Club - Raleigh',
    address: '101 Rock Quarry Rd, Raleigh, NC 27610',
    latitude: 35.7796,
    longitude: -78.6382,
    category: 'climbing'
  },
  {
    name: 'Climb Nashville',
    address: '1200 4th Ave S, Nashville, TN 37210',
    latitude: 36.1477,
    longitude: -86.7730,
    category: 'climbing'
  },

  // Climbing Gyms - United States (Midwest)
  {
    name: 'First Ascent - Chicago',
    address: '1000 N Wolcott Ave, Chicago, IL 60622',
    latitude: 41.8987,
    longitude: -87.6748,
    category: 'climbing'
  },
  {
    name: 'Brooklyn Boulders - Chicago',
    address: '100 S Morgan St, Chicago, IL 60607',
    latitude: 41.8792,
    longitude: -87.6509,
    category: 'climbing'
  },
  {
    name: 'Vertical Endeavors - Minneapolis',
    address: '2540 Nicollet Ave, Minneapolis, MN 55404',
    latitude: 44.9537,
    longitude: -93.2776,
    category: 'climbing'
  },
  {
    name: 'Momentum Indoor Climbing - Sandy',
    address: '1300 E 9400 S, Sandy, UT 84094',
    latitude: 40.5774,
    longitude: -111.8608,
    category: 'climbing'
  },
  {
    name: 'The Crag - Indianapolis',
    address: '8146 Brookville Rd, Indianapolis, IN 46239',
    latitude: 39.7684,
    longitude: -86.0175,
    category: 'climbing'
  },
  {
    name: 'Climb Kalamazoo',
    address: '520 Lake St, Kalamazoo, MI 49001',
    latitude: 42.2917,
    longitude: -85.5872,
    category: 'climbing'
  },

  // Climbing Gyms - United States (South)
  {
    name: 'Stone Summit - Atlanta',
    address: '3701 Presidential Pkwy, Atlanta, GA 30340',
    latitude: 33.8868,
    longitude: -84.2686,
    category: 'climbing'
  },
  {
    name: 'Movement Climbing - Austin',
    address: '6701 Metropolis Dr, Austin, TX 78744',
    latitude: 30.2108,
    longitude: -97.7745,
    category: 'climbing'
  },
  {
    name: 'Ascension Rock Gym - San Antonio',
    address: '13246 George Rd, San Antonio, TX 78230',
    latitude: 29.5993,
    longitude: -98.5382,
    category: 'climbing'
  },
  {
    name: 'Summit Climbing - Dallas',
    address: '3929 N Interstate 35, Carrollton, TX 75007',
    latitude: 32.9923,
    longitude: -96.8899,
    category: 'climbing'
  },
  {
    name: 'Texas Rock Gym - Houston',
    address: '1526 Campbell Rd, Houston, TX 77055',
    latitude: 29.7945,
    longitude: -95.4891,
    category: 'climbing'
  },
  
  // Additional Texas Climbing Gyms (from Mountain Project)
  {
    name: 'arch',
    address: '2501 Paramount Blvd, Amarillo, TX 79109',
    latitude: 35.1991,
    longitude: -101.8313,
    category: 'climbing'
  },
  {
    name: 'Armadillo Boulders',
    address: '1234 San Pedro Ave, San Antonio, TX 78212',
    latitude: 29.4246,
    longitude: -98.4951,
    category: 'climbing'
  },
  {
    name: 'Armadillo Boulders - San Marcos',
    address: '501 N LBJ Dr, San Marcos, TX 78666',
    latitude: 29.8830,
    longitude: -97.9414,
    category: 'climbing'
  },
  {
    name: 'Austin Bouldering Project',
    address: '979 Springdale Rd, Austin, TX 78702',
    latitude: 30.2711,
    longitude: -97.7437,
    category: 'climbing'
  },
  {
    name: 'Austin Bouldering Project Westgate',
    address: '4477 S Lamar Blvd, Austin, TX 78745',
    latitude: 30.2330,
    longitude: -97.8009,
    category: 'climbing'
  },
  {
    name: 'Basin',
    address: '600 Panther Way, Hewitt, TX 76643',
    latitude: 31.4682,
    longitude: -97.1964,
    category: 'climbing'
  },
  {
    name: 'Boulders Sport Climbing Center',
    address: '305 E Central Texas Expy, Harker Heights, TX 76548',
    latitude: 31.0835,
    longitude: -97.6597,
    category: 'climbing'
  },
  {
    name: 'Canyons Rock Climbing',
    address: '8201 Preston Rd, Frisco, TX 75034',
    latitude: 33.1507,
    longitude: -96.8037,
    category: 'climbing'
  },
  {
    name: 'Cave Climbing Gym',
    address: '1500 Joe Battle Blvd, El Paso, TX 79936',
    latitude: 31.7619,
    longitude: -106.4850,
    category: 'climbing'
  },
  {
    name: 'Climb Capuchin',
    address: '5050 Westheimer Rd, Houston, TX 77056',
    latitude: 29.7372,
    longitude: -95.4605,
    category: 'climbing'
  },
  {
    name: 'CLIMB Woodlands',
    address: '32907 Tamina Rd, Magnolia, TX 77354',
    latitude: 30.2116,
    longitude: -95.4827,
    category: 'climbing'
  },
  {
    name: 'Crux Climbing Center',
    address: '2030 Wilson St, Austin, TX 78704',
    latitude: 30.2405,
    longitude: -97.7697,
    category: 'climbing'
  },
  {
    name: 'Crux Climbing Center Central',
    address: '3806 N I-35, Austin, TX 78722',
    latitude: 30.2968,
    longitude: -97.7288,
    category: 'climbing'
  },
  {
    name: 'Crux Climbing Center Pflugerville',
    address: '1209 W Pecan St, Pflugerville, TX 78660',
    latitude: 30.4393,
    longitude: -97.6200,
    category: 'climbing'
  },
  {
    name: 'Denia Recreation Center Climbing Wall',
    address: '1000 S Bell Ave, Denton, TX 76201',
    latitude: 33.2148,
    longitude: -97.1331,
    category: 'climbing'
  },
  {
    name: 'Dyno-Rock',
    address: '1701 E Lamar Blvd, Arlington, TX 76011',
    latitude: 32.7357,
    longitude: -97.0780,
    category: 'climbing'
  },
  {
    name: 'Elevator Rock',
    address: '4245 Kemp Blvd, Wichita Falls, TX 76308',
    latitude: 33.9137,
    longitude: -98.5228,
    category: 'climbing'
  },
  {
    name: 'Elzie Odom Athletic Center',
    address: '1225 W Mitchell St, Arlington, TX 76013',
    latitude: 32.7299,
    longitude: -97.1208,
    category: 'climbing'
  },
  {
    name: 'Inspire Cypress',
    address: '12345 Jones Rd, Cypress, TX 77429',
    latitude: 29.9688,
    longitude: -95.6972,
    category: 'climbing'
  },
  {
    name: 'Inspire Spring',
    address: '19450 I-45, Spring, TX 77373',
    latitude: 30.0799,
    longitude: -95.3633,
    category: 'climbing'
  },
  {
    name: 'Jerry D. Morris Recreation Center',
    address: '2400 Neal St, Commerce, TX 75428',
    latitude: 33.2470,
    longitude: -95.9000,
    category: 'climbing'
  },
  {
    name: 'Life Time Fitness - Lake Houston',
    address: '7905 FM 1960 Bypass Rd E, Humble, TX 77346',
    latitude: 29.9938,
    longitude: -95.2630,
    category: 'climbing'
  },
  {
    name: 'Main Event Entertainment - Vertical Challenge',
    address: '13301 N I-35, Austin, TX 78753',
    latitude: 30.3816,
    longitude: -97.6789,
    category: 'climbing'
  },
  {
    name: 'McLane Student Life Center',
    address: '1311 S 5th St, Waco, TX 76706',
    latitude: 31.5489,
    longitude: -97.1131,
    category: 'climbing'
  },
  {
    name: 'Mesa Rim Austin',
    address: '1201 W Slaughter Ln, Austin, TX 78748',
    latitude: 30.1745,
    longitude: -97.8231,
    category: 'climbing'
  },
  {
    name: 'Momentum - Katy',
    address: '5337 FM 1463, Katy, TX 77494',
    latitude: 29.7857,
    longitude: -95.7891,
    category: 'climbing'
  },
  {
    name: 'Momentum Indoor Climbing',
    address: '10800 Westpark Dr, Houston, TX 77042',
    latitude: 29.7320,
    longitude: -95.5698,
    category: 'climbing'
  },
  {
    name: 'North Wall',
    address: '12222 Merit Dr, Dallas, TX 75251',
    latitude: 32.8965,
    longitude: -96.7704,
    category: 'climbing'
  },
  {
    name: 'Oso Climbing Gyms',
    address: '1111 Riverfront Blvd, Dallas, TX 75207',
    latitude: 32.7767,
    longitude: -96.8122,
    category: 'climbing'
  },
  {
    name: 'Outdoor Adventure',
    address: '3506 Cullen Blvd, Houston, TX 77204',
    latitude: 29.7174,
    longitude: -95.3414,
    category: 'climbing'
  },
  {
    name: 'Power Spot Climbing',
    address: '303 E Howard Ln, Austin, TX 78753',
    latitude: 30.4005,
    longitude: -97.6789,
    category: 'climbing'
  },
  {
    name: 'Renewed Strength Fitness',
    address: '2001 W Loop 250 N, Midland, TX 79707',
    latitude: 31.9973,
    longitude: -102.1182,
    category: 'climbing'
  },
  {
    name: 'Sam Houston State University Climbing Center',
    address: '1608 Ave J, Huntsville, TX 77340',
    latitude: 30.7135,
    longitude: -95.5502,
    category: 'climbing'
  },
  {
    name: 'Sessions Climbing & Fitness',
    address: '8070 Gateway Blvd E, El Paso, TX 79907',
    latitude: 31.7761,
    longitude: -106.2914,
    category: 'climbing'
  },
  {
    name: 'Siloville Climbing Gym',
    address: '125 Main St, Hico, TX 76457',
    latitude: 31.9815,
    longitude: -98.0322,
    category: 'climbing'
  },
  {
    name: 'SMU Climbing Center',
    address: '6000 Bishop Blvd, Dallas, TX 75205',
    latitude: 32.8412,
    longitude: -96.7844,
    category: 'climbing'
  },
  {
    name: 'Space City Rock Climbing Gym',
    address: '100 E Main St, League City, TX 77573',
    latitude: 29.5074,
    longitude: -95.0949,
    category: 'climbing'
  },
  {
    name: 'St. Mary\'s University',
    address: '1 Camino Santa Maria, San Antonio, TX 78228',
    latitude: 29.4600,
    longitude: -98.5747,
    category: 'climbing'
  },
  {
    name: 'Stephen F. Austin Climbing Wall',
    address: '1936 North St, Nacogdoches, TX 75962',
    latitude: 31.6032,
    longitude: -94.6555,
    category: 'climbing'
  },
  {
    name: 'Stone Co. Climbing',
    address: '1600 University Dr E, College Station, TX 77840',
    latitude: 30.6280,
    longitude: -96.3344,
    category: 'climbing'
  },
  {
    name: 'Stone Moves Indoor Rock Climbing Gym',
    address: '6970 FM 1960 Rd W, Houston, TX 77069',
    latitude: 29.9941,
    longitude: -95.5350,
    category: 'climbing'
  },
  {
    name: 'Summit Carrollton',
    address: '3929 N Interstate 35, Carrollton, TX 75007',
    latitude: 32.9923,
    longitude: -96.8899,
    category: 'climbing'
  },
  {
    name: 'Summit Denton',
    address: '2111 S I-35E, Denton, TX 76205',
    latitude: 33.1895,
    longitude: -97.1338,
    category: 'climbing'
  },
  {
    name: 'Summit Recreational Center',
    address: '315 S 1st St, Temple, TX 76501',
    latitude: 31.0982,
    longitude: -97.3428,
    category: 'climbing'
  },
  {
    name: 'Sun & Ski Sports',
    address: '5700 Westheimer Rd, Houston, TX 77057',
    latitude: 29.7372,
    longitude: -95.4882,
    category: 'climbing'
  },
  {
    name: 'Texas A&M University Indoor Climbing Facility',
    address: '301 George Bush Dr, College Station, TX 77840',
    latitude: 30.6100,
    longitude: -96.3425,
    category: 'climbing'
  },
  {
    name: 'Texas Tech Climbing Center',
    address: '1202 Akron Ave, Lubbock, TX 79409',
    latitude: 33.5779,
    longitude: -101.8552,
    category: 'climbing'
  },
  {
    name: 'The District',
    address: '1111 S Alamo St, San Antonio, TX 78210',
    latitude: 29.4167,
    longitude: -98.4903,
    category: 'climbing'
  },
  {
    name: 'The Houstonian',
    address: '111 N Post Oak Ln, Houston, TX 77024',
    latitude: 29.7633,
    longitude: -95.4618,
    category: 'climbing'
  },
  {
    name: 'The North Texas Outdoor Pursuit Center',
    address: '2000 E Spring Creek Pkwy, Carrollton, TX 75006',
    latitude: 33.0368,
    longitude: -96.8784,
    category: 'climbing'
  },
  {
    name: 'The Wall Indoor Rock Climbing Boerne Gymnastics Center',
    address: '120 S Main St, Boerne, TX 78006',
    latitude: 29.7947,
    longitude: -98.7312,
    category: 'climbing'
  },
  {
    name: 'University of Northern Texas Climbing Wall',
    address: '1155 Union Cir, Denton, TX 76203',
    latitude: 33.2084,
    longitude: -97.1506,
    category: 'climbing'
  },
  {
    name: 'University of Texas at Austin Climbing Wall at Gregory Gymnasium',
    address: '2101 Speedway, Austin, TX 78712',
    latitude: 30.2840,
    longitude: -97.7369,
    category: 'climbing'
  },
  {
    name: 'University of Texas at Dallas University Recreation Climbing Wall',
    address: '800 W Campbell Rd, Richardson, TX 75080',
    latitude: 32.9857,
    longitude: -96.7501,
    category: 'climbing'
  },
  {
    name: 'University of Texas at San Antonio',
    address: '1 UTSA Cir, San Antonio, TX 78249',
    latitude: 29.5844,
    longitude: -98.6194,
    category: 'climbing'
  },
  {
    name: 'UTEP Climbing Gym',
    address: '500 W University Ave, El Paso, TX 79968',
    latitude: 31.7710,
    longitude: -106.5050,
    category: 'climbing'
  },
  {
    name: 'Upper Limits - St. Louis',
    address: '326 S 21st St, St. Louis, MO 63103',
    latitude: 38.6290,
    longitude: -90.2097,
    category: 'climbing'
  },
  {
    name: 'Climb So iLL - New Orleans',
    address: '2800 Royal St, New Orleans, LA 70117',
    latitude: 29.9731,
    longitude: -90.0489,
    category: 'climbing'
  },

  // Climbing Gyms - Canada
  {
    name: 'Hive Climbing - Vancouver',
    address: '115 W 1st Ave, Vancouver, BC V5Y 0H4',
    latitude: 49.2690,
    longitude: -123.1050,
    category: 'climbing'
  },
  {
    name: 'The Hive North Shore - Vancouver',
    address: '1745 W 4th Ave, Vancouver, BC V6J 0B8',
    latitude: 49.2681,
    longitude: -123.1400,
    category: 'climbing'
  },
  {
    name: 'Boulderz Climbing - Calgary',
    address: '58 Ave SE, Calgary, AB T2H 2N3',
    latitude: 50.9908,
    longitude: -114.0373,
    category: 'climbing'
  },
  {
    name: 'Climb Base5 - Toronto',
    address: '1444 Dupont St, Toronto, ON M6P 4H3',
    latitude: 43.6657,
    longitude: -79.4431,
    category: 'climbing'
  },
  {
    name: 'Joe Rockhead\'s - Toronto',
    address: '29 Fraser Ave, Toronto, ON M6K 1Y7',
    latitude: 43.6364,
    longitude: -79.4259,
    category: 'climbing'
  },
  {
    name: 'Allez Up - Montreal',
    address: '3559 St Laurent Blvd, Montreal, QC H2X 2V2',
    latitude: 45.5112,
    longitude: -73.5770,
    category: 'climbing'
  },
  {
    name: 'Bloc Shop - Montreal',
    address: '1356 Bennett St, Montreal, QC H4E 2P6',
    latitude: 45.4680,
    longitude: -73.5956,
    category: 'climbing'
  },
  {
    name: 'Coyote Rock Gym - Ottawa',
    address: '1737 St Laurent Blvd, Ottawa, ON K1G 3V4',
    latitude: 45.4015,
    longitude: -75.6276,
    category: 'climbing'
  },

  // Climbing Gyms - United Kingdom
  {
    name: 'The Castle Climbing Centre - London',
    address: 'Green Lanes, London N4 2HA, UK',
    latitude: 51.5656,
    longitude: -0.1039,
    category: 'climbing'
  },
  {
    name: 'Climb London - Mile End',
    address: 'Haverfield Rd, London E3 5BE, UK',
    latitude: 51.5256,
    longitude: -0.0339,
    category: 'climbing'
  },
  {
    name: 'The Arch Climbing Wall - London',
    address: 'Railway Arches, London SE16 4UG, UK',
    latitude: 51.4947,
    longitude: -0.0544,
    category: 'climbing'
  },
  {
    name: 'Blocyard - London',
    address: '12 The Highway, London E1W 2BX, UK',
    latitude: 51.5101,
    longitude: -0.0568,
    category: 'climbing'
  },
  {
    name: 'Yonder Climbing - Birmingham',
    address: 'Kings Norton, Birmingham B38 8TE, UK',
    latitude: 52.4085,
    longitude: -1.9274,
    category: 'climbing'
  },
  {
    name: 'The Climbing Works - Sheffield',
    address: '44 Mowbray St, Sheffield S3 8EN, UK',
    latitude: 53.3860,
    longitude: -1.4663,
    category: 'climbing'
  },
  {
    name: 'Depot - Manchester',
    address: '41 Chapel St, Manchester M3 5DX, UK',
    latitude: 53.4840,
    longitude: -2.2520,
    category: 'climbing'
  },
  {
    name: 'Awesome Walls - Edinburgh',
    address: '15 South Platt Hill, Edinburgh EH6 5EH, UK',
    latitude: 55.9690,
    longitude: -3.1757,
    category: 'climbing'
  },
  {
    name: 'The Climbing Hangar - Bristol',
    address: 'South St, Bristol BS3 2PT, UK',
    latitude: 51.4399,
    longitude: -2.5984,
    category: 'climbing'
  },

  // Climbing Gyms - Germany
  {
    name: 'Boulderwelt - Munich',
    address: 'Garmischer Str. 8, 81369 München, Germany',
    latitude: 48.1179,
    longitude: 11.5284,
    category: 'climbing'
  },
  {
    name: 'DAV Kletterzentrum - Munich',
    address: 'Thalkirchner Str. 207, 81371 München, Germany',
    latitude: 48.1070,
    longitude: 11.5491,
    category: 'climbing'
  },
  {
    name: 'Boulderworld - Frankfurt',
    address: 'Hanauer Landstr. 208, 60314 Frankfurt, Germany',
    latitude: 50.1109,
    longitude: 8.7231,
    category: 'climbing'
  },
  {
    name: 'Die Boulderei - Berlin',
    address: 'Revaler Str. 99, 10245 Berlin, Germany',
    latitude: 52.5107,
    longitude: 13.4598,
    category: 'climbing'
  },
  {
    name: 'Boulderklub Kreuzberg - Berlin',
    address: 'Luckenwalder Str. 3, 10963 Berlin, Germany',
    latitude: 52.4970,
    longitude: 13.3850,
    category: 'climbing'
  },
  {
    name: 'Kletterfabrik - Cologne',
    address: 'Oskar-Jäger-Str. 173, 50825 Köln, Germany',
    latitude: 50.9619,
    longitude: 6.9231,
    category: 'climbing'
  },
  {
    name: 'Stuntwerk - Cologne',
    address: 'Nußbaumerstraße 25, 50823 Köln, Germany',
    latitude: 50.9480,
    longitude: 6.9160,
    category: 'climbing'
  },
  {
    name: 'Kletterhalle Hamburg',
    address: 'Hannoversche Str. 85, 21079 Hamburg, Germany',
    latitude: 53.4607,
    longitude: 9.9881,
    category: 'climbing'
  },

  // Climbing Gyms - France
  {
    name: 'Arkose - Paris Nation',
    address: '8 Rue de Reuilly, 75012 Paris, France',
    latitude: 48.8438,
    longitude: 2.3939,
    category: 'climbing'
  },
  {
    name: 'Arkose - Paris Massy',
    address: '20 Av. de la Libération, 91300 Massy, France',
    latitude: 48.7290,
    longitude: 2.2850,
    category: 'climbing'
  },
  {
    name: 'MurMur - Paris',
    address: '55 Rue Cartier Bresson, 93500 Pantin, France',
    latitude: 48.8941,
    longitude: 2.4025,
    category: 'climbing'
  },
  {
    name: 'Block\'Out - Lyon',
    address: '23 Rue Alexandre Boutin, 69100 Villeurbanne, France',
    latitude: 45.7640,
    longitude: 4.8790,
    category: 'climbing'
  },
  {
    name: 'Vertical\'Art - Toulouse',
    address: '3 Rue de l\'Abbé Jules Lemire, 31100 Toulouse, France',
    latitude: 43.5603,
    longitude: 1.4130,
    category: 'climbing'
  },
  {
    name: 'Climb Up - Lille',
    address: 'Zone d\'activités, 59650 Villeneuve-d\'Ascq, France',
    latitude: 50.6184,
    longitude: 3.1404,
    category: 'climbing'
  },

  // Climbing Gyms - Netherlands
  {
    name: 'Monk Bouldergym - Amsterdam',
    address: 'Gedempt Hamerkanaal 81, 1021 KP Amsterdam, Netherlands',
    latitude: 52.3963,
    longitude: 4.9206,
    category: 'climbing'
  },
  {
    name: 'Klimhal Amsterdam',
    address: 'Naritaweg 48, 1043 BZ Amsterdam, Netherlands',
    latitude: 52.3984,
    longitude: 4.8334,
    category: 'climbing'
  },
  {
    name: 'Bjoeks Klimcentrum - Utrecht',
    address: 'Kanaalweg 12b, 3526 KM Utrecht, Netherlands',
    latitude: 52.0838,
    longitude: 5.1070,
    category: 'climbing'
  },
  {
    name: 'Neoliet - Rotterdam',
    address: 'Giessenweg 51, 3044 AL Rotterdam, Netherlands',
    latitude: 51.9319,
    longitude: 4.4606,
    category: 'climbing'
  },

  // Climbing Gyms - Spain
  {
    name: 'Sharma Climbing - Barcelona',
    address: 'Carrer de Sant Cugat del Rec, Barcelona, Spain',
    latitude: 41.4036,
    longitude: 2.1934,
    category: 'climbing'
  },
  {
    name: 'Climbat - Barcelona',
    address: 'Carrer del Foc 54, Barcelona, Spain',
    latitude: 41.3995,
    longitude: 2.1852,
    category: 'climbing'
  },
  {
    name: 'Boulder Madrid',
    address: 'Calle de Ramón de Aguinaga, Madrid, Spain',
    latitude: 40.4668,
    longitude: -3.6890,
    category: 'climbing'
  },
  {
    name: 'Sputnik - Madrid',
    address: 'Calle de Bolivia 7, Madrid, Spain',
    latitude: 40.4580,
    longitude: -3.6901,
    category: 'climbing'
  },

  // Climbing Gyms - Italy
  {
    name: 'Urban Wall - Milan',
    address: 'Via Vittorio Veneto 24, Milano, Italy',
    latitude: 45.4642,
    longitude: 9.1900,
    category: 'climbing'
  },
  {
    name: 'King Rock - Rome',
    address: 'Via Raffaele De Cesare 12, Roma, Italy',
    latitude: 41.9028,
    longitude: 12.4964,
    category: 'climbing'
  },
  {
    name: 'Boulder Torino',
    address: 'Via Giordano Bruno 101, Torino, Italy',
    latitude: 45.0703,
    longitude: 7.6869,
    category: 'climbing'
  },

  // Climbing Gyms - Switzerland
  {
    name: 'Café Kraft - Basel',
    address: 'Rebgasse 54, 4058 Basel, Switzerland',
    latitude: 47.5596,
    longitude: 7.5886,
    category: 'climbing'
  },
  {
    name: 'Gaswerk - Bern',
    address: 'Sandrainstrasse 25, 3007 Bern, Switzerland',
    latitude: 46.9483,
    longitude: 7.4389,
    category: 'climbing'
  },
  {
    name: 'Milandia - Zurich',
    address: 'Hagenholzstrasse 60, 8050 Zürich, Switzerland',
    latitude: 47.4156,
    longitude: 8.5567,
    category: 'climbing'
  },

  // Climbing Gyms - Austria
  {
    name: 'Kletterhalle Wien',
    address: 'Erzherzog-Karl-Straße 108, 1220 Wien, Austria',
    latitude: 48.2208,
    longitude: 16.4431,
    category: 'climbing'
  },
  {
    name: 'Block Boulder - Vienna',
    address: 'Lindengasse 41, 1070 Wien, Austria',
    latitude: 48.2028,
    longitude: 16.3518,
    category: 'climbing'
  },

  // Climbing Gyms - Australia
  {
    name: '9 Degrees - Sydney',
    address: '2 Unwins Bridge Rd, St Peters NSW 2044, Australia',
    latitude: -33.9149,
    longitude: 151.1787,
    category: 'climbing'
  },
  {
    name: 'Sydney Indoor Climbing Gym',
    address: '27 Pitt St, Waterloo NSW 2017, Australia',
    latitude: -33.9008,
    longitude: 151.2066,
    category: 'climbing'
  },
  {
    name: 'Urban Climb - Melbourne',
    address: '16 Bolinda St, Richmond VIC 3121, Australia',
    latitude: -37.8169,
    longitude: 145.0059,
    category: 'climbing'
  },
  {
    name: 'Hardrock Climbing - Brisbane',
    address: '50 Montague Rd, South Brisbane QLD 4101, Australia',
    latitude: -27.4795,
    longitude: 153.0168,
    category: 'climbing'
  },
  {
    name: 'Urban Climb - Brisbane',
    address: '220 Montague Rd, West End QLD 4101, Australia',
    latitude: -27.4810,
    longitude: 153.0098,
    category: 'climbing'
  },
  {
    name: 'The Climbing Club - Perth',
    address: '9 Garling St, Perth WA 6000, Australia',
    latitude: -31.9510,
    longitude: 115.8582,
    category: 'climbing'
  },
  {
    name: 'Rocksports - Adelaide',
    address: '273 Morphett Rd, Camden Park SA 5038, Australia',
    latitude: -34.9836,
    longitude: 138.5505,
    category: 'climbing'
  },

  // Climbing Gyms - New Zealand
  {
    name: 'Extreme Edge - Auckland',
    address: '27 Meola Rd, Auckland 1011, New Zealand',
    latitude: -36.8573,
    longitude: 174.7361,
    category: 'climbing'
  },
  {
    name: 'Clip \'n Climb - Christchurch',
    address: '401 Madras St, Christchurch 8011, New Zealand',
    latitude: -43.5320,
    longitude: 172.6362,
    category: 'climbing'
  },
  {
    name: 'Fergs Kayaks Climbing Wall - Wellington',
    address: '5 Waterloo Quay, Wellington 6011, New Zealand',
    latitude: -41.2776,
    longitude: 174.7836,
    category: 'climbing'
  },

  // Climbing Gyms - Japan
  {
    name: 'B-Pump - Tokyo Ogikubo',
    address: '1-chōme-3-1 Kamiogi, Suginami City, Tokyo, Japan',
    latitude: 35.7043,
    longitude: 139.6231,
    category: 'climbing'
  },
  {
    name: 'B-Pump - Tokyo Yokohama',
    address: '1-chōme-7-1 Sakuragicho, Yokohama, Kanagawa, Japan',
    latitude: 35.4495,
    longitude: 139.6317,
    category: 'climbing'
  },
  {
    name: 'NOBOROCK - Tokyo',
    address: '2-chōme-14-13 Kitazawa, Setagaya City, Tokyo, Japan',
    latitude: 35.6606,
    longitude: 139.6670,
    category: 'climbing'
  },
  {
    name: 'T-Wall - Tokyo',
    address: '1-chōme-26-5 Takadanobaba, Shinjuku City, Tokyo, Japan',
    latitude: 35.7128,
    longitude: 139.7044,
    category: 'climbing'
  },
  {
    name: 'Gravity Research - Osaka',
    address: 'Umeda, Kita Ward, Osaka, Japan',
    latitude: 34.7024,
    longitude: 135.4959,
    category: 'climbing'
  },

  // Climbing Gyms - Singapore
  {
    name: 'Boulder+ - Singapore',
    address: '1 Tessensohn Rd, Singapore 217664',
    latitude: 1.3184,
    longitude: 103.8562,
    category: 'climbing'
  },
  {
    name: 'Climb Central - Singapore',
    address: '5 Changi Business Park Central 1, Singapore 486038',
    latitude: 1.3343,
    longitude: 103.9626,
    category: 'climbing'
  },
  {
    name: 'BFF Climb - Singapore',
    address: '201E Tampines St 23, Singapore 527201',
    latitude: 1.3570,
    longitude: 103.9451,
    category: 'climbing'
  },

  // Climbing Gyms - South Korea
  {
    name: 'The Climbing - Seoul',
    address: 'Gangnam-gu, Seoul, South Korea',
    latitude: 37.4979,
    longitude: 127.0276,
    category: 'climbing'
  },
  {
    name: 'Piecemaker - Seoul',
    address: 'Mapo-gu, Seoul, South Korea',
    latitude: 37.5444,
    longitude: 126.9538,
    category: 'climbing'
  },

  // Climbing Gyms - Hong Kong
  {
    name: 'Just Climb - Hong Kong',
    address: 'Siu Lek Yuen, Sha Tin, Hong Kong',
    latitude: 22.3822,
    longitude: 114.1827,
    category: 'climbing'
  },
  {
    name: 'Verm City - Hong Kong',
    address: 'Wong Chuk Hang, Hong Kong',
    latitude: 22.2479,
    longitude: 114.1680,
    category: 'climbing'
  },

  // Climbing Gyms - South Africa
  {
    name: 'CityROCK - Cape Town',
    address: 'Albert Rd, Woodstock, Cape Town, South Africa',
    latitude: -33.9276,
    longitude: 18.4461,
    category: 'climbing'
  },
  {
    name: 'Mountain Club of South Africa - Cape Town',
    address: '97 Hatfield St, Gardens, Cape Town, South Africa',
    latitude: -33.9367,
    longitude: 18.4143,
    category: 'climbing'
  },

  // Climbing Gyms - Brazil
  {
    name: 'Competition Climbing - São Paulo',
    address: 'R. Haddock Lobo, 1307 - Jardins, São Paulo, Brazil',
    latitude: -23.5628,
    longitude: -46.6678,
    category: 'climbing'
  },
  {
    name: 'Rock Inn - Rio de Janeiro',
    address: 'Av. das Américas, 8585 - Barra da Tjuca, Rio de Janeiro, Brazil',
    latitude: -23.0007,
    longitude: -43.3468,
    category: 'climbing'
  },

  // Climbing Gyms - Mexico
  {
    name: 'Climbstation - Mexico City',
    address: 'Calle Oso 127, Del Valle, Mexico City, Mexico',
    latitude: 19.3810,
    longitude: -99.1689,
    category: 'climbing'
  },
  {
    name: 'Rocódromo Polanco - Mexico City',
    address: 'Av. Homero, Polanco, Mexico City, Mexico',
    latitude: 19.4326,
    longitude: -99.1974,
    category: 'climbing'
  },

  // Climbing Gyms - Norway
  {
    name: 'Klatreverket - Oslo',
    address: 'Grefsen Stasjon, 0487 Oslo, Norway',
    latitude: 59.9493,
    longitude: 10.7797,
    category: 'climbing'
  },
  {
    name: 'Oslo Klatresenter',
    address: 'Losbyvegen 10, 1187 Oslo, Norway',
    latitude: 59.8936,
    longitude: 10.8467,
    category: 'climbing'
  },

  // Climbing Gyms - Sweden
  {
    name: 'Klättercentret - Stockholm',
    address: 'Hammarby Fabriksväg 33, 120 30 Stockholm, Sweden',
    latitude: 59.3030,
    longitude: 18.1048,
    category: 'climbing'
  },
  {
    name: 'Karbin - Stockholm',
    address: 'Biblioteksgatan 5, 111 46 Stockholm, Sweden',
    latitude: 59.3342,
    longitude: 18.0743,
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
  console.log(`📍 Will add ${GYM_DATA.length} gyms from around the world\n`);

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

