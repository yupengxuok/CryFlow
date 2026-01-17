/**
 * Database Seeding Script
 * Loads CSV data into MongoDB
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Event = require('../src/models/Event');

// CSV parsing function
function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  const headers = lines[0].split(',');
  
  const events = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    const event = {};
    
    headers.forEach((header, index) => {
      const value = values[index]?.trim();
      
      // Handle empty values
      if (!value || value === '') {
        event[header] = null;
        return;
      }
      
      // Parse specific fields
      switch (header) {
        case 'cry_intensity':
          event[header] = parseFloat(value);
          break;
        case 'cry_duration_sec':
        case 'feed_amount_ml':
          event[header] = parseInt(value, 10);
          break;
        case 'diaper_wet':
        case 'diaper_dirty':
          event[header] = value.toLowerCase() === 'true';
          break;
        case 'ts':
          event[header] = new Date(value);
          break;
        default:
          event[header] = value;
      }
    });
    
    events.push(event);
  }
  
  return events;
}

// Main seeding function
async function seedDatabase() {
  try {
    console.log('🌱 Starting database seed...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');
    
    // Clear existing events
    const deleteResult = await Event.deleteMany({});
    console.log(`🗑️  Cleared ${deleteResult.deletedCount} existing events`);
    
    // Parse CSV
    const csvPath = path.join(__dirname, '..', 'cryflow_events_sample.csv');
    const events = parseCSV(csvPath);
    console.log(`📄 Parsed ${events.length} events from CSV`);
    
    // Insert events
    const insertedEvents = await Event.insertMany(events);
    console.log(`✅ Inserted ${insertedEvents.length} events`);
    
    // Show summary
    const summary = await Event.aggregate([
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);
    
    console.log('\n📊 Event Summary:');
    summary.forEach(item => {
      console.log(`   ${item._id}: ${item.count}`);
    });
    
    // Show baby IDs
    const babies = await Event.distinct('baby_id');
    console.log(`\n👶 Baby IDs: ${babies.join(', ')}`);
    
    console.log('\n✨ Database seeding complete!');
    
  } catch (error) {
    console.error('❌ Seeding error:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

// Run seeding
seedDatabase();
