const { MongoClient } = require('mongodb');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

// const MONGODB_URI = process.env.DATABASE_URL;
const MONGODB_URI = 'mongodb://localhost:27017/whatsapp-system3'

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
      } else {
        console.log(`ℹ️  Collection already exists: ${collection}`);
      }
    }
    
    // Check if default tenant already exists
    let existingTenant = await db.collection('tenants').findOne({ name: 'Default Tenant' });
    let tenantId;
    
    if (existingTenant) {
      tenantId = existingTenant.tenantId;
      console.log(`ℹ️  Default tenant already exists: ${tenantId}`);
    } else {
      // Create default tenant
      tenantId = uuidv4();
      await db.collection('tenants').insertOne({
        tenantId,
        name: 'Default Tenant',
        description: 'Default tenant for testing',
        isActive: true,
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log(`✅ Tenant created: ${tenantId}`);
    }
    
    // Check if default user group already exists
    let existingGroup = await db.collection('usergroups').findOne({ name: 'Admin Group', tenantId });
    let groupId;
    
    if (existingGroup) {
      groupId = existingGroup.groupId;
      console.log(`ℹ️  Admin group already exists: ${groupId}`);
    } else {
      // Create default user group
      groupId = uuidv4();
      await db.collection('usergroups').insertOne({
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
      console.log(`✅ User group created: ${groupId}`);
    }
    
    // Check if admin user already exists
    let existingUser = await db.collection('users').findOne({ username: 'admin@example.com' });
    
<<<<<<< Current (Your changes)
    if (existingUser) {
      console.log(`ℹ️  Admin user already exists: ${existingUser.userId}`);
      console.log(`ℹ️  Using existing tenant ID: ${existingUser.tenantId}`);
      console.log(`ℹ️  Using existing group ID: ${existingUser.groupId}`);
      
      // Update the user to ensure they have the correct tenant and group
      await db.collection('users').updateOne(
        { username: 'admin@example.com' },
        { 
          $set: { 
            tenantId: tenantId,
            groupId: groupId,
            updatedAt: new Date()
          }
        }
      );
      console.log(`✅ Admin user updated with current tenant and group`);
    } else {
      // Create admin user
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await db.collection('users').insertOne({
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
      console.log(`✅ Admin user created: admin@example.com`);
    }
    
    console.log('\n🎉 Seed completed successfully!');
    console.log('📧 Login credentials:');
    console.log('   Email: admin@example.com');
=======
    // Create admin user
    const hashedPassword = await bcrypt.hash('admin123', 10);
    const adminUsername = 'admin';
    const adminUser = await db.collection('users').insertOne({
      userId: uuidv4(),
      tenantId,
      username: adminUsername,
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
    console.log(`✅ Admin user created: ${adminUsername}`);
    
    console.log('\n🎉 Seed completed successfully!');
    console.log('🔐 Login credentials:');
    console.log(`   Username: ${adminUsername}`);
>>>>>>> Incoming (Background Agent changes)
    console.log('   Password: admin123');
    console.log('   Tenant ID:', tenantId);
    console.log('   Group ID:', groupId);
    
  } catch (error) {
    console.error('❌ Seed failed:', error);
    console.log('💡 This might be due to existing data. Check the logs above for details.');
  } finally {
    await client.close();
  }
}

seed();
