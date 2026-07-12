const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

// Read .env from backend directory
const envPath = path.resolve(__dirname, '../../backend/.env');
const envContent = fs.readFileSync(envPath, 'utf-8');

let mongoUrl = '';
let dbName = '';

envContent.split('\n').forEach(line => {
    if (line.startsWith('MONGO_URL=')) mongoUrl = line.substring(line.indexOf('=') + 1).trim().replace(/^"|"$/g, '');
    if (line.startsWith('DB_NAME=')) dbName = line.substring(line.indexOf('=') + 1).trim().replace(/^"|"$/g, '');
});

// Remove trailing comments or spaces if any from MONGO_URL
mongoUrl = mongoUrl.split(' ')[0];

// Handle unescaped characters in password
mongoUrl = mongoUrl.replace('reaganmbao31?', 'reaganmbao31%3F');

const client = new MongoClient(mongoUrl);

async function connectDb() {
    await client.connect();
    return client.db(dbName);
}

async function getRideById(rideId) {
    const db = await connectDb();
    return db.collection('rides').findOne({ _id: rideId });
}

async function getActiveRidesForStudent(studentId) {
    const db = await connectDb();
    return db.collection('rides').find({ 
        "passengers.student_id": studentId,
        status: { $in: ["pending", "accepted", "in_progress"] }
    }).toArray();
}

async function getDriverStatus(driverId) {
    const db = await connectDb();
    return db.collection('drivers').findOne({ id: driverId });
}

async function auditDatabase() {
    const db = await connectDb();
    
    const activeRides = await db.collection('rides').find({
        status: { $in: ["pending", "accepted", "in_progress"] }
    }).toArray();
    
    let issues = [];
    
    // Check drivers capacity vs passengers
    for (const ride of activeRides) {
        if (ride.driver_id) {
            const driver = await db.collection('drivers').findOne({ id: ride.driver_id });
            if (ride.passenger_count > driver.vehicle_capacity) {
                issues.push(`Ride ${ride._id} has ${ride.passenger_count} passengers but driver ${driver.id} capacity is ${driver.vehicle_capacity}`);
            }
            if (driver.current_ride_id !== ride._id && ride.status !== "pending") {
                issues.push(`Driver ${driver.id} current_ride_id is ${driver.current_ride_id} but should be ${ride._id}`);
            }
        }
    }
    
    return {
        activeRidesCount: activeRides.length,
        issues: issues
    };
}

async function closeDb() {
    await client.close();
}

module.exports = {
    connectDb,
    getRideById,
    getActiveRidesForStudent,
    getDriverStatus,
    auditDatabase,
    closeDb
};
