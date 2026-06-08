const axios = require('axios');
const path = require('path');

const config = {
  key: process.env.TRELLO_KEY,
  token: process.env.TRELLO_TOKEN,
  boardId: process.env.BOARD_ID
};

// Helper: prüft ob heute in Zeitspanne liegt
function isTodayInRange(firstday, lastday) {
  const today = new Date();
  const start = new Date(firstday);
  const end = new Date(lastday);

  // Zeit auf 00:00 setzen für sauberen Vergleich
  today.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  return today >= start && today <= end;
}

async function feedTrello() {
  try {
    // 1. Generate today's date: DD.MM.YYYY
    const now = new Date();
    const todayString = `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}.${now.getFullYear()}`;
    console.log(`📅 Feeding Trello list for: ${todayString}`);

    // 2. Get existing lists
    const listsResponse = await axios.get(
      `https://api.trello.com/1/boards/${config.boardId}/lists?key=${config.key}&token=${config.token}`
    );

    // 3. Check if today's list exists
    const existingList = listsResponse.data.find(list => list.name === todayString);
    let listId;

    if (existingList) {
      console.log(`✅ List "${todayString}" exists: ${existingList.id}`);
      listId = existingList.id;
    } else {
      // 4. Create new list
      const newListResponse = await axios.post(
        `https://api.trello.com/1/lists?name=${encodeURIComponent(todayString)}&idBoard=${config.boardId}&key=${config.key}&token=${config.token}`
      );
      listId = newListResponse.data.id;
      console.log(`✅ Created list "${todayString}": ${listId}`);
    }

    // 5. Read JSON
    const filePath = path.join(__dirname, '..', 'data', 'items.json');
    const timespans = require(filePath);

    // 6. Finde passende Zeitspanne
    const activeSpans = timespans.filter(span =>
      !span.skip && isTodayInRange(span.firstday, span.lastday)
    );

    if (activeSpans.length === 0) {
      console.log('⚠️ No active timespan found for today (or skipped)');
      return;
    }

    const items = activeSpans.flatMap(span => span.entries);
    console.log(`📝 Using ${items.length} entries from active timespan`);

    // 7. Create cards with proper titles + link detection
    let linkCount = 0, textCount = 0;
    for (let i = 0; i < items.length; i++) {
      const item = items[i].name; // Access .name property
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
