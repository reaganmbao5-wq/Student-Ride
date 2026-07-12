#!/usr/bin/env node
/**
 * move_driver.js — Physical Testing GPS Movement Simulator
 *
 * Automates driver GPS movement during manual testing so you only
 * need to handle the real UI decisions (Accept, Arrived, Start, Complete).
 *
 * Usage:
 *   node qa_env/move_driver.js --driver driver_a@qa.com --mode to_student
 *   node qa_env/move_driver.js --driver driver_b@qa.com --mode to_student_a
 *   node qa_env/move_driver.js --driver driver_b@qa.com --mode to_student_b
 *   node qa_env/move_driver.js --driver driver_a@qa.com --mode to_destination
 *   node qa_env/move_driver.js --driver driver_a@qa.com --mode loop --speed fast
 *
 * Modes:
 *   to_student      — Move from driver's last location toward Student A pickup
 *   to_student_a    — Same as above
 *   to_student_b    — Move from current position toward Student B pickup
 *   to_destination  — Move toward the ride's dropoff location
 *   loop            — Loop around a small area (map smoke test)
 *
 * Speed:
 *   normal (default) — 2s per step (realistic)
 *   fast             — 500ms per step (for map smoke test)
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// ─── Configuration ──────────────────────────────────────────────────────────

// Use --online flag to target the live Render backend instead of localhost
// Or set BACKEND_URL env var:  BACKEND_URL=https://... node qa_env/move_driver.js ...
const ONLINE_URL = 'https://student-ride-backend-manual.onrender.com';
const LOCAL_URL  = process.env.BACKEND_URL || 'http://localhost:8000';
const useOnline  = process.argv.includes('--online');
const BACKEND_URL = useOnline ? ONLINE_URL : LOCAL_URL;

if (useOnline) {
  console.log(`🌐 [ONLINE MODE] Targeting: ${ONLINE_URL}`);
} else {
  console.log(`🖥️  [LOCAL MODE]  Targeting: ${LOCAL_URL}`);
}

// QA account passwords
const QA_PASSWORD = 'password123';

// Fixed Kabwe area coordinates (same area used by seed data)
const KABWE_BASE = { lat: -14.440, lng: 28.445 };

// Simulated locations for QA testing — these match seed_qa_data.py coordinates
const LOCATIONS = {
  driver_a:      { lat: -14.441, lng: 28.444 },
  driver_b:      { lat: -14.439, lng: 28.447 },
  driver_c:      { lat: -14.437, lng: 28.443 },
  driver_d:      { lat: -14.403, lng: 28.283 },
  student_a:     { lat: -14.442, lng: 28.446 },  // Student A's typical pickup
  student_b:     { lat: -14.436, lng: 28.448 },  // Student B's typical pickup
  student_c:     { lat: -14.438, lng: 28.442 },
  destination_a: { lat: -14.455, lng: 28.450 },  // Typical dropoff
  destination_b: { lat: -14.430, lng: 28.460 },
};

// ─── Argument Parsing ────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const get = (flag) => {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : null;
};

const driverEmail = get('--driver') || 'driver_a@qa.com';
const mode = get('--mode') || 'to_student';
const speed = get('--speed') || 'normal';
const steps = parseInt(get('--steps') || '20', 10);
const intervalMs = speed === 'fast' ? 500 : 2000;

// Derive driver ID prefix from email (driver_a@qa.com → driver_a)
const driverKey = driverEmail.replace('@qa.com', '').replace('.', '_');

// ─── HTTP helpers ────────────────────────────────────────────────────────────

function httpPost(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const isHttps = parsed.protocol === 'https:';
    const lib = isHttps ? https : http;
    const data = JSON.stringify(body);

    const req = lib.request({
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        ...headers,
      },
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
        catch { resolve({ status: res.statusCode, data: body }); }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// ─── Login ───────────────────────────────────────────────────────────────────

async function login(email, password) {
  console.log(`🔐 Logging in as ${email}...`);
  const res = await httpPost(`${BACKEND_URL}/api/auth/login`, { email, password });
  if (res.status !== 200) {
    throw new Error(`Login failed (${res.status}): ${JSON.stringify(res.data)}`);
  }
  console.log(`✅ Logged in as ${res.data.user.name}`);
  return res.data.access_token;
}

// ─── Location update ─────────────────────────────────────────────────────────

async function updateLocation(token, lat, lng) {
  const res = await httpPost(
    `${BACKEND_URL}/api/drivers/location`,
    { latitude: lat, longitude: lng },
    { Authorization: `Bearer ${token}` }
  );
  if (res.status !== 200) {
    console.warn(`⚠️  Location update failed: ${res.status}`);
  }
}

// ─── Movement engine ─────────────────────────────────────────────────────────

function interpolate(from, to, n) {
  const points = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    points.push({
      lat: from.lat + (to.lat - from.lat) * t,
      lng: from.lng + (to.lng - from.lng) * t,
    });
  }
  return points;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function moveTo(token, from, to, label) {
  const waypoints = interpolate(from, to, steps);
  console.log(`\n🚗 Moving ${label}...`);
  console.log(`   From: ${from.lat.toFixed(5)}, ${from.lng.toFixed(5)}`);
  console.log(`   To:   ${to.lat.toFixed(5)}, ${to.lng.toFixed(5)}`);
  console.log(`   Steps: ${steps} @ ${intervalMs}ms each (${((steps * intervalMs)/1000).toFixed(1)}s total)\n`);

  for (let i = 0; i < waypoints.length; i++) {
    const p = waypoints[i];
    const pct = Math.round((i / waypoints.length) * 100);
    process.stdout.write(`\r   [${pct}%] lat=${p.lat.toFixed(5)}, lng=${p.lng.toFixed(5)}   `);
    await updateLocation(token, p.lat, p.lng);
    await sleep(intervalMs);
  }

  console.log(`\n   ✅ Arrived at ${label}`);
  return to;
}

// ─── Loop mode (map smoke test) ───────────────────────────────────────────────

async function loopMode(token) {
  const center = LOCATIONS[driverKey] || KABWE_BASE;
  const radius = 0.003;
  let iteration = 0;

  console.log(`\n🔁 Loop mode — Ctrl+C to stop\n`);

  while (true) {
    iteration++;
    const angle = (iteration * 30 * Math.PI) / 180;
    const target = {
      lat: center.lat + radius * Math.sin(angle),
      lng: center.lng + radius * Math.cos(angle),
    };
    process.stdout.write(`\r   [Loop ${iteration}] lat=${target.lat.toFixed(5)}, lng=${target.lng.toFixed(5)}   `);
    await updateLocation(token, target.lat, target.lng);
    await sleep(intervalMs);
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n=== 🚕 Driver Movement Simulator ===`);
  console.log(`   Driver: ${driverEmail}`);
  console.log(`   Mode:   ${mode}`);
  console.log(`   Speed:  ${speed} (${intervalMs}ms/step)`);
  console.log(`=====================================\n`);

  const token = await login(driverEmail, QA_PASSWORD);

  const driverStart = LOCATIONS[driverKey] || KABWE_BASE;

  switch (mode) {
    case 'to_student':
    case 'to_student_a': {
      await moveTo(token, driverStart, LOCATIONS.student_a, 'Student A pickup');
      console.log('\n📣 Driver is at Student A. Tap "I\'ve Arrived" in the app now.');
      break;
    }

    case 'to_student_b': {
      const currentPos = LOCATIONS.student_a; // came from student A
      await moveTo(token, currentPos, LOCATIONS.student_b, 'Student B pickup');
      console.log('\n📣 Driver is at Student B. Tap "I\'ve Arrived" in the app now.');
      break;
    }

    case 'to_destination': {
      // Try student_b → dest first (shared), fallback to student_a → dest (private)
      const fromPos = LOCATIONS.student_b || LOCATIONS.student_a;
      const dest = LOCATIONS[`destination_a`];
      await moveTo(token, fromPos, dest, 'Destination');
      console.log('\n📣 At destination. Tap "Complete Ride" in the app now.');
      break;
    }

    case 'full_private': {
      // Full automated private ride journey
      let pos = driverStart;
      pos = await moveTo(token, pos, LOCATIONS.student_a, 'Student A pickup');
      console.log('\n📣 At Student A. Tap "I\'ve Arrived" then "Start Ride" in the app. Waiting 10s...\n');
      await sleep(10000);
      pos = await moveTo(token, pos, LOCATIONS.destination_a, 'Destination');
      console.log('\n📣 At destination. Tap "Complete Ride" in the app.');
      break;
    }

    case 'full_shared': {
      // Full automated shared ride journey (A → B → destination)
      let pos = driverStart;
      pos = await moveTo(token, pos, LOCATIONS.student_a, 'Student A pickup');
      console.log('\n📣 At Student A. Tap "I\'ve Arrived" then "Start Ride". Waiting 10s...\n');
      await sleep(10000);
      pos = await moveTo(token, pos, LOCATIONS.student_b, 'Student B pickup');
      console.log('\n📣 At Student B. Tap "I\'ve Arrived" then "Start Ride". Waiting 10s...\n');
      await sleep(10000);
      pos = await moveTo(token, pos, LOCATIONS.destination_a, 'Destination');
      console.log('\n📣 At destination. Tap "Complete Ride" in the app.');
      break;
    }

    case 'loop': {
      await loopMode(token);
      break;
    }

    default:
      console.error(`❌ Unknown mode: ${mode}`);
      console.error('Valid modes: to_student, to_student_a, to_student_b, to_destination, full_private, full_shared, loop');
      process.exit(1);
  }

  console.log('\n✅ Simulator complete.\n');
}

main().catch(err => {
  console.error('\n❌ Simulator error:', err.message);
  process.exit(1);
});
