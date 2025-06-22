const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

// Path setup
const dataDir = path.join(__dirname, '../data');
const calculatedDataDir = path.join(dataDir, 'Calculated Data');

// Index symbols
const indices = ['NIFTY', 'NIFTYBANK', 'SENSEX'];
const dataTypes = ['INDEX', 'FUTURES'];

// Calculate HMA (Hull Moving Average)
function calculateHMA(values, length = 55) {
  // WMA calculation helper
  const wma = (vals, period) => {
    if (vals.length < period) return null;
    let sum = 0, denom = 0;
    for (let i = 0; i < period; i++) {
      sum += vals[vals.length - 1 - i] * (period - i);
      denom += (period - i);
    }
    return sum / denom;
  };
  
  if (values.length < length) return Array(values.length).fill(null);
  
  const sqrtLen = Math.floor(Math.sqrt(length));
  let wmaHalf = [], wmaFull = [], diff = [], hmaArr = [];
  
  for (let i = 0; i < values.length; i++) {
    wmaHalf.push(wma(values.slice(0, i + 1), Math.floor(length / 2)));
    wmaFull.push(wma(values.slice(0, i + 1), length));
    
    if (wmaHalf[i] !== null && wmaFull[i] !== null) {
      diff.push(2 * wmaHalf[i] - wmaFull[i]);
    } else {
      diff.push(null);
    }
    
    hmaArr.push(null); // placeholder
  }
  
  for (let i = 0; i < values.length; i++) {
    if (i + 1 >= length) {
      const sub = diff.slice(0, i + 1);
      hmaArr[i] = wma(sub, sqrtLen);
    }
  }
  
  return hmaArr;
}

// Read a CSV file and return its contents as an array of objects
async function readCSVFile(filePath) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      resolve([]);
      return;
    }
    
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (error) => reject(error));
  });
}

// Get all data files for a specific index and data type
function getDataFiles(indexSymbol, dataType) {
  const files = fs.readdirSync(dataDir);
  return files.filter(file => 
    file.startsWith(`${indexSymbol}_${dataType}_`) && 
    file.endsWith('.csv') && 
    !file.includes('_CE_') && 
    !file.includes('_PE_')
  );
}

// Process data for a specific index and data type
async function processData(indexSymbol, dataType) {
  console.log(`Processing ${indexSymbol} ${dataType}...`);
  
  // Get all data files
  const files = getDataFiles(indexSymbol, dataType);
  console.log(`Found ${files.length} files for ${indexSymbol} ${dataType}`);
  
  if (files.length === 0) {
    console.log(`No files found for ${indexSymbol} ${dataType}`);
    return;
  }
  
  // Read all data
  let allData = [];
  for (const file of files) {
    const filePath = path.join(dataDir, file);
    const data = await readCSVFile(filePath);
    allData = allData.concat(data);
  }
  
  // Sort by timestamp
  allData.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  
  // Remove duplicates based on timestamp
  const uniqueData = [];
  const timestampSet = new Set();
  for (const item of allData) {
    if (!timestampSet.has(item.timestamp)) {
      timestampSet.add(item.timestamp);
      uniqueData.push(item);
    }
  }
  
  // Keep only the last 3 days of data (approximately 375*3 = 1125 minutes)
  let consolidatedData = uniqueData;
  if (uniqueData.length > 1125) {
    consolidatedData = uniqueData.slice(uniqueData.length - 1125);
  }
  
  // Calculate HMA on close prices
  const closes = consolidatedData.map(row => parseFloat(row.close || row.price || 0));
  const hma55 = calculateHMA(closes, 55);
  
  // Add HMA to data
  const dataWithHMA = consolidatedData.map((row, index) => ({
    timestamp: row.timestamp,
    symbol: row.symbol,
    open: row.open || row.price || 0,
    high: row.high || row.price || 0, 
    low: row.low || row.price || 0,
    close: row.close || row.price || 0,
    volume: row.volume || 0,
    HMA55: hma55[index] !== null ? hma55[index].toFixed(2) : ''
  }));
  
  // Write consolidated file
  const outputPath = path.join(dataDir, `${indexSymbol}_${dataType}.csv`);
  const csvWriter = createCsvWriter({
    path: outputPath,
    header: [
      { id: 'timestamp', title: 'timestamp' },
      { id: 'symbol', title: 'symbol' },
      { id: 'open', title: 'open' },
      { id: 'high', title: 'high' },
      { id: 'low', title: 'low' },
      { id: 'close', title: 'close' },
      { id: 'volume', title: 'volume' },
      { id: 'HMA55', title: 'HMA55' }
    ]
  });
  
  await csvWriter.writeRecords(dataWithHMA);
  console.log(`Created consolidated file for ${indexSymbol}_${dataType} with ${dataWithHMA.length} records`);
  
  return dataWithHMA.length;
}

// Main function to migrate all data
async function migrateToConsolidatedFiles() {
  console.log('Starting migration to consolidated files...');
  
  // Create directories if they don't exist
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  // Remove old calculated data directory if it exists
  if (fs.existsSync(calculatedDataDir)) {
    console.log('Removing old calculated data directory...');
    fs.rmSync(calculatedDataDir, { recursive: true, force: true });
  }
  
  const results = {};
  
  // Process each index and data type
  for (const index of indices) {
    results[index] = {};
    for (const dataType of dataTypes) {
      try {
        const count = await processData(index, dataType);
        results[index][dataType] = count;
      } catch (error) {
        console.error(`Error processing ${index} ${dataType}:`, error);
        results[index][dataType] = 'ERROR';
      }
    }
  }
  
  console.log('Migration completed!');
  console.log('Results:');
  console.log(JSON.stringify(results, null, 2));
}

// Run the migration
migrateToConsolidatedFiles().catch(error => {
  console.error('Migration failed:', error);
}); 