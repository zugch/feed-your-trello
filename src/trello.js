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

    // 6. Create cards with proper titles + link detection
    let linkCount = 0, textCount = 0;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const isUrl = item.match(/^https?:\/\//i);

      let query;
      if (isUrl) {
        // LINK CARD: Short title + full URL in url param
        const title = item.replace(/^https?:\/\/(www\.)?/, '').split('/')[0] || 'Link';
        query = `key=${config.key}&token=${config.token}&idList=${listId}&name=${encodeURIComponent(title)}&urlSource=${encodeURIComponent(item)}`;
        console.log(`  🔗 "${title}" → ${item}`);
        linkCount++;
      } else {
        // TEXT CARD: Use item as-is
        query = `key=${config.key}&token=${config.token}&idList=${listId}&name=${encodeURIComponent(item)}`;
        console.log(`  📝 "${item.substring(0, 40)}..."`);
        textCount++;
      }

      await axios.post(`https://api.trello.com/1/cards?${query}`);
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`🎉 Feed complete! ${linkCount} links + ${textCount} text cards`);

  } catch (error) {
    console.error('❌ Feed failed:', error.response?.data || error.message);
    console.error('Status:', error.response?.status);
    process.exit(1);
  }
}

// One-way execution
feedTrello();