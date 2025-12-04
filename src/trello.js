const axios = require('axios');
const fs = require('fs');
const path = require('path');

const config = {
  key: process.env.TRELLO_KEY,
  token: process.env.TRELLO_TOKEN,
  boardId: process.env.BOARD_ID
};

async function feedTrello() {
  try {
    // 1. Generate today's date: DD.MM.YYYY
    const now = new Date();
    const today = `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}.${now.getFullYear()}`;
    console.log(`📅 Feeding Trello list for: ${today}`);

    // 2. Get existing lists
    const listsResponse = await axios.get(
      `https://api.trello.com/1/boards/${config.boardId}/lists?key=${config.key}&token=${config.token}`
    );

    // 3. Check if today's list exists
    const existingList = listsResponse.data.find(list => list.name === today);
    let listId;
    if (existingList) {
      console.log(`✅ List "${today}" exists: ${existingList.id}`);
      listId = existingList.id;
    } else {
      // 4. Create new list
      const newListResponse = await axios.post(
        `https://api.trello.com/1/lists?name=${encodeURIComponent(today)}&idBoard=${config.boardId}&key=${config.key}&token=${config.token}`
      );
      listId = newListResponse.data.id;
      console.log(`✅ Created list "${today}": ${listId}`);
    }

    // 5. Read items.txt from repo
    const filePath = path.join(__dirname, '..', 'data', 'items.txt');
    const content = fs.readFileSync(filePath, 'utf8');
    const items = content
      .split('\n')
      .map(item => item.trim())
      .filter(item => item.length > 0);

    console.log(`📝 Feeding ${items.length} items from data/items.txt`);

    // 6. Create card for each item (one-way feed)
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      await axios.post(
        `https://api.trello.com/1/cards?name=${encodeURIComponent(item)}&idList=${listId}&key=${config.key}&token=${config.token}`
      );
      console.log(`  ✅ Fed card ${i + 1}: "${item.substring(0, 50)}..."`);
      
      // Rate limit: 100ms delay
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`🎉 Feed complete! ${today} list has ${items.length} cards`);

  } catch (error) {
    console.error('❌ Feed failed:', error.response?.data || error.message);
    console.error('Status:', error.response?.status);
    process.exit(1);
  }
}

// One-way execution
feedTrello();