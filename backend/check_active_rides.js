const mongoose = require('mongoose');

async function checkActiveRides() {
  const url = 'mongodb+srv://admin:reaganmbao31?@cluster0.mucpxu8.mongodb.net/mulungushi_rides?appName=Cluster0';
  
  try {
    await mongoose.connect(url);
    console.log('Connected to MongoDB via Mongoose');
    
    const db = mongoose.connection.db;
    const rides = db.collection('rides');
    
    // Find all rides that are not completed, cancelled, or finished
    const activeRides = await rides.find({ 
      status: { $nin: ['completed', 'cancelled', 'declined', 'expired', 'finished'] } 
    }).toArray();
    
    console.log(`\nFound ${activeRides.length} active rides:`);
    
    for (const ride of activeRides) {
      console.log('\n--------------------------------------------------');
      console.log(`Ride ID: ${ride._id}`);
      console.log(`Status: ${ride.status}`);
      console.log(`Ride Mode: ${ride.ride_mode || 'N/A'}`);
      console.log(`Created At: ${ride.created_at || ride.createdAt}`);
      console.log(`Student ID: ${ride.student_id}`);
      
      if (ride.student_name) console.log(`Student Name: ${ride.student_name}`);
      if (ride.driver_id) console.log(`Driver ID: ${ride.driver_id}`);
      
      // Look up student and driver details if needed
      const student = await db.collection('users').findOne({ _id: ride.student_id });
      if (student) console.log(`Student Details: ${student.first_name} ${student.last_name} (${student.email})`);
      
      if (ride.driver_id) {
        const driver = await db.collection('users').findOne({ _id: ride.driver_id });
        if (driver) console.log(`Driver Details: ${driver.first_name} ${driver.last_name} (${driver.email})`);
      }
      
      // Shared ride context?
      if (ride.shared_students && ride.shared_students.length > 0) {
        console.log(`Shared Students: ${JSON.stringify(ride.shared_students)}`);
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

checkActiveRides();
