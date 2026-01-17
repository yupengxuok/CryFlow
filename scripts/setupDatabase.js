/**
 * Database Setup Script
 * Creates collections and indexes for CryFlow
 */
require('dotenv').config();
const mongoose = require('mongoose');

async function setupDatabase() {
  try {
    console.log('🔧 Starting database setup...');
    
    // Connect to MongoDB (without deprecated options)
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    const db = mongoose.connection.db;
    
    // Create collections if they don't exist
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    
    if (!collectionNames.includes('babies')) {
      await db.createCollection('babies');
      console.log('✅ Created babies collection');
    }
    
    if (!collectionNames.includes('events')) {
      await db.createCollection('events');
      console.log('✅ Created events collection');
    }
    
    if (!collectionNames.includes('analyses')) {
      await db.createCollection('analyses');
      console.log('✅ Created analyses collection');
    }
    
    if (!collectionNames.includes('actions')) {
      await db.createCollection('actions');
      console.log('✅ Created actions collection');
    }
    
    // Create indexes for babies
    console.log('\n📊 Creating indexes for babies...');
    await db.collection('babies').createIndex(
      { baby_id: 1 },
      { unique: true, name: 'baby_id_unique_idx' }
    );
    await db.collection('babies').createIndex({ created_at: 1 });
    await db.collection('babies').createIndex({ deleted_at: 1 });
    console.log('✅ Babies indexes created');
    
    // Create indexes for events
    console.log('\n📊 Creating indexes for events...');
    await db.collection('events').createIndex(
      { baby_id: 1, ts: -1 },
      { name: 'baby_timeline_idx' }
    );
    await db.collection('events').createIndex(
      { baby_id: 1, type: 1, ts: -1 },
      { name: 'baby_type_timeline_idx' }
    );
    await db.collection('events').createIndex({ created_at: 1 });
    await db.collection('events').createIndex(
      { baby_id: 1, ts: -1 },
      {
        partialFilterExpression: { deleted_at: null },
        name: 'active_events_idx'
      }
    );
    console.log('✅ Events indexes created');
    
    // Create indexes for analyses
    console.log('\n📊 Creating indexes for analyses...');
    await db.collection('analyses').createIndex(
      { baby_id: 1, ts: -1 },
      { name: 'baby_analysis_timeline_idx' }
    );
    await db.collection('analyses').createIndex(
      { analysis_id: 1 },
      { unique: true, name: 'analysis_id_unique_idx' }
    );
    await db.collection('analyses').createIndex(
      { 'analyzed_events.event_id': 1 },
      { name: 'event_reference_idx' }
    );
    await db.collection('analyses').createIndex(
      { baby_id: 1, 'hypotheses.label': 1, ts: -1 },
      { name: 'hypothesis_label_idx' }
    );
    console.log('✅ Analyses indexes created');
    
    // Create indexes for actions
    console.log('\n📊 Creating indexes for actions...');
    await db.collection('actions').createIndex(
      { baby_id: 1, ts: -1 },
      { name: 'baby_actions_timeline_idx' }
    );
    await db.collection('actions').createIndex(
      { analysis_id: 1 },
      { name: 'analysis_actions_idx' }
    );
    await db.collection('actions').createIndex(
      { action_id: 1 },
      { unique: true, name: 'action_id_unique_idx' }
    );
    await db.collection('actions').createIndex(
      { baby_id: 1, 'outcome.status': 1, ts: -1 },
      { name: 'action_outcome_idx' }
    );
    console.log('✅ Actions indexes created');
    
    // List all indexes
    console.log('\n📋 Index Summary:');
    const eventIndexes = await db.collection('events').indexes();
    console.log(`   events: ${eventIndexes.length} indexes`);
    
    const analysisIndexes = await db.collection('analyses').indexes();
    console.log(`   analyses: ${analysisIndexes.length} indexes`);
    
    const actionIndexes = await db.collection('actions').indexes();
    console.log(`   actions: ${actionIndexes.length} indexes`);
    
    console.log('\n✨ Database setup complete!');
    console.log('\n📝 Next steps:');
    console.log('   1. Run: npm run seed');
    console.log('   2. Run: npm run dev');
    console.log('   3. Test: curl http://localhost:3000/v1/health');
    
  } catch (error) {
    console.error('❌ Setup error:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

// Run setup
setupDatabase();
