const axios = require('axios');
//require('dotenv').config();

// DEBUG - Print ALL env vars
console.log('=== DEBUG ENV ===');
console.log('TRELLO_KEY:', process.env.TRELLO_KEY ? `${process.env.TRELLO_KEY.substring(0,4)}...` : 'MISSING');
console.log('TRELLO_TOKEN length:', process.env.TRELLO_TOKEN ? process.env.TRELLO_TOKEN.length : 'MISSING');
console.log('BOARD_ID:', process.env.BOARD_ID ? `${process.env.BOARD_ID.substring(0,4)}...` : 'MISSING');
console.log('================');

const config = {
  key: process.env.TRELLO_KEY,
  token: process.env.TRELLO_TOKEN,
  boardId: process.env.BOARD_ID
};

// Print config
console.log('CONFIG key:', config.key ? `${config.key.substring(0,4)}...` : 'MISSING');
console.log('CONFIG boardId:', config.boardId ? `${config.boardId.substring(0,4)}...` : 'MISSING');

async function createList() {
  try {
    // Generate current date: DD.MM.YYYY
    const now = new Date();
    const today = `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}.${now.getFullYear()}`;
    
    console.log(`Creating list for: ${today}`);
    
    // 1. Get existing lists
    const listsResponse = await axios.get(
      `https://api.trello.com/1/boards/${config.boardId}/lists?key=${config.key}&token=${config.token}`
    );
    
    // 2. Check if list exists
    const existingList = listsResponse.data.find(list => list.name === today);
    if (existingList) {
      console.log(`List "${today}" already exists: ${existingList.id}`);
      return; // Exit - no action needed
    }
    
    // 3. Create new list only if missing
    const newListResponse = await axios.post(
      `https://api.trello.com/1/lists?name=${encodeURIComponent(today)}&idBoard=${config.boardId}&key=${config.key}&token=${config.token}`
    );
    
    console.log(`✅ Created new list "${today}": ${newListResponse.data.id}`);
    
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

createList();
