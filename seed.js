const { MongoClient } = require('mongodb');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

// const MONGODB_URI = process.env.DATABASE_URL;
const MONGODB_URI = 'mongodb://localhost:27018/whatsapp-system1'

async function seed() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('🌱 Connected to MongoDB');
    
    const db = client.db();
    
    // Create collections if they don't exist
    const collections = ['tenants', 'usergroups', 'users'];
    for (const collection of collections) {
      if (!(await db.listCollections({ name: collection }).hasNext())) {
        await db.createCollection(collection);
        console.log(`✅ Created collection: ${collection}`);
      }
    }
    
    // Create default tenant
    const tenantId = uuidv4();
    const tenant = await db.collection('tenants').insertOne({
      tenantId,
      name: 'Default Tenant',
      description: 'Default tenant for testing',
      isActive: true,
      settings: {},
      createdAt: new Date(),
      updatedAt: new Date()
    });
    console.log('✅ Tenant created:', tenantId);
    
    // Create default user group
    const groupId = uuidv4();
    const userGroup = await db.collection('usergroups').insertOne({
      groupId,
      tenantId,
      name: 'Admin Group',
      description: 'Default admin group',
      permissions: [
        'create_user', 'delete_user', 'manage_users',
        'manage_groups', 'assign_users_to_groups',
        'link_devices', 'send_messages', 'manage_devices',
        'view_logs', 'view_contacts', 'view_groups',
        'manage_contacts', 'manage_groups', 'system_admin'
      ],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    console.log('✅ User group created:', groupId);
    
    // Create admin user
    const hashedPassword = await bcrypt.hash('admin123', 10);
    const adminUser = await db.collection('users').insertOne({
      userId: uuidv4(),
      tenantId,
      username: 'admin@example.com',
      password: hashedPassword,
      groupId,
      email: 'admin@example.com',
      phoneNumber: '+1234567890',
      isAdmin: true,
      name: 'Admin User',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    console.log('✅ Admin user created: admin@example.com');
    
    console.log('\n🎉 Seed completed successfully!');
    console.log('📧 Login credentials:');
    console.log('   Username: admin@example.com');
    console.log('   Password: admin123');
    console.log('   Tenant ID:', tenantId);
    console.log('   Group ID:', groupId);
    
  } catch (error) {
    console.error('❌ Seed failed:', error);
  } finally {
    await client.close();
  }
}

seed();
