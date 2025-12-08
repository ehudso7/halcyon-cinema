#!/usr/bin/env node

/**
 * Journey Verification Script
 * Ensures every journey defined in journeys.yaml has a corresponding test file.
 * Exits with non-zero status if any journey is missing a test file.
 */

const fs = require('fs');
const path = require('path');

// Simple YAML parser for our specific structure
function parseSimpleYaml(content) {
  const journeys = [];
  const lines = content.split('\n');
  let currentJourney = null;

  for (const line of lines) {
    const idMatch = line.match(/^\s+-\s+id:\s*(\S+)/);
    const nameMatch = line.match(/^\s+name:\s*(.+)/);
    const tagsMatch = line.match(/^\s+tags:\s*\[([^\]]+)\]/);

    if (idMatch) {
      if (currentJourney) {
        journeys.push(currentJourney);
      }
      currentJourney = { id: idMatch[1] };
    } else if (nameMatch && currentJourney) {
      currentJourney.name = nameMatch[1].trim();
    } else if (tagsMatch && currentJourney) {
      currentJourney.tags = tagsMatch[1].split(',').map(t => t.trim());
    }
  }

  if (currentJourney) {
    journeys.push(currentJourney);
  }

  return journeys;
}

function main() {
  const journeysPath = path.join(__dirname, '..', 'journeys.yaml');
  const testsDir = path.join(__dirname, '..', 'tests', 'journeys');

  // Check if journeys.yaml exists
  if (!fs.existsSync(journeysPath)) {
    console.error('ERROR: journeys.yaml not found at:', journeysPath);
    process.exit(1);
  }

  // Parse journeys
  const content = fs.readFileSync(journeysPath, 'utf-8');
  const journeys = parseSimpleYaml(content);

  if (journeys.length === 0) {
    console.error('ERROR: No journeys found in journeys.yaml');
    process.exit(1);
  }

  console.log(`Found ${journeys.length} journeys in journeys.yaml\n`);

  // Ensure tests directory exists
  if (!fs.existsSync(testsDir)) {
    fs.mkdirSync(testsDir, { recursive: true });
  }

  // Check each journey for a test file
  const missing = [];
  const present = [];
  const critical = [];

  for (const journey of journeys) {
    const testFile = path.join(testsDir, `${journey.id}.spec.ts`);
    const isCritical = journey.tags && journey.tags.includes('critical');

    if (fs.existsSync(testFile)) {
      present.push({ ...journey, testFile });
    } else {
      missing.push({ ...journey, testFile });
      if (isCritical) {
        critical.push(journey);
      }
    }
  }

  // Report results
  console.log('JOURNEY STATUS:');
  console.log('===============\n');

  for (const j of present) {
    const tags = j.tags ? `[${j.tags.join(', ')}]` : '';
    console.log(`  ${j.id}: TEST FILE ✅ ${tags}`);
  }

  for (const j of missing) {
    const tags = j.tags ? `[${j.tags.join(', ')}]` : '';
    console.log(`  ${j.id}: TEST FILE ❌ ${tags}`);
  }

  console.log('\n---');
  console.log(`Total: ${journeys.length} | Present: ${present.length} | Missing: ${missing.length}`);

  if (critical.length > 0) {
    console.log(`\n⚠️  CRITICAL JOURNEYS WITHOUT TESTS: ${critical.length}`);
    for (const j of critical) {
      console.log(`    - ${j.id}: ${j.name}`);
    }
  }

  if (missing.length > 0) {
    console.log('\nTo create missing test files, add:');
    for (const j of missing) {
      console.log(`  tests/journeys/${j.id}.spec.ts`);
    }
    process.exit(1);
  }

  console.log('\n✅ All journeys have test files!');
  process.exit(0);
}

main();
