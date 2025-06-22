const axios = require('axios');

// Test script to verify monitoring functionality changes
async function testMonitoring() {
  console.log('🧪 Testing monitoring functionality...');
  
  try {
    // 1. Get current monitoring status
    console.log('Step 1: Checking current monitoring status...');
    const monitoringResponse = await axios.get('http://localhost:5000/api/monitoring/status');
    console.log('Current monitoring status:', monitoringResponse.data);
    
    // 2. Add a test option to monitoring
    console.log('\nStep 2: Adding test option to monitoring...');
    const addOptionResponse = await axios.post('http://localhost:5000/api/monitoring/add', {
      symbol: 'NSE:NIFTY24JUN25000CE',
      type: 'CE',
      lots: 1,
      targetPoints: 50,
      stopLossPoints: 30,
      entryMethod: 'MARKET'
    });
    console.log('Add option response:', addOptionResponse.data);
    
    // 3. Get updated monitoring list
    console.log('\nStep 3: Getting updated monitoring list...');
    const updatedMonitoringResponse = await axios.get('http://localhost:5000/api/monitoring/list');
    console.log('Updated monitoring list:', updatedMonitoringResponse.data);
    
    // 4. Remove the test option from monitoring
    if (updatedMonitoringResponse.data && updatedMonitoringResponse.data.length > 0) {
      const testOption = updatedMonitoringResponse.data.find(item => item.symbol === 'NSE:NIFTY24JUN25000CE');
      if (testOption) {
        console.log('\nStep 4: Removing test option from monitoring...');
        const removeResponse = await axios.delete(`http://localhost:5000/api/monitoring/remove/${testOption.id}`);
        console.log('Remove response:', removeResponse.data);
      }
    }
    
    // 5. Get final monitoring list
    console.log('\nStep 5: Getting final monitoring list...');
    const finalMonitoringResponse = await axios.get('http://localhost:5000/api/monitoring/list');
    console.log('Final monitoring list:', finalMonitoringResponse.data);
    
    console.log('\n✅ Testing completed successfully');
  } catch (error) {
    console.error('❌ Error during testing:', error.response ? error.response.data : error.message);
  }
}

// Run the test
testMonitoring(); 