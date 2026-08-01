const axios = require('axios');
const path = require('path');
const { parse } = require('@datasert/cronjs-parser');
const cronjsMatcher = require('@datasert/cronjs-matcher');

const config = {
  key: process.env.TRELLO_KEY,
  token: process.env.TRELLO_TOKEN,
  boardId: process.env.BOARD_ID
};

function getTodayLunchTime() {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return today;
}

// Helper: prüft ob heute in Zeitspanne liegt
function isTodayInRange(firstday, lastday, todayProbe) {
  const start = new Date(firstday);
  const end = new Date(lastday);

  // Zeit auf 00:00 bzw. 23:59 setzen für sauberen Vergleich
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 0, 0);

  return todayProbe >= start && todayProbe <= end;
}

// Helper: prüft optionalen Cron-Ausdruck für heute
function doesCronMatchToday(cronExpression, todayStart) {
  if (cronExpression === undefined || cronExpression === null || String(cronExpression).trim() === '') {
    return true;
  }

  const expr = String(cronExpression).trim();

  try {
    parse(expr);

    return cronjsMatcher.isTimeMatches(
      expr,
      todayStart.toISOString()
    );
  } catch (error) {
    console.log(`  ⚠️ Invalid cron "${expr}" - ${error.message}`);
    return false;
  }
}

function buildDueValue(entry) {
  const hasDueOffsetDays = entry.dueOffsetDays !== undefined;
  const hasDueTime = entry.dueTime !== undefined;

  if (!hasDueOffsetDays && !hasDueTime) {
    return null;
  }

  const dueOffsetDays = hasDueOffsetDays ? Number(entry.dueOffsetDays) : 0;
  const dueTime = hasDueTime ? String(entry.dueTime).trim() : '23:59';

  const isValidOffset = Number.isInteger(dueOffsetDays) && dueOffsetDays >= 0;
  const timeMatch = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(dueTime);

  if (!isValidOffset || !timeMatch) {
    return null;
  }

  const hours = Number(timeMatch[1]);
  const minutes = Number(timeMatch[2]);

  const due = new Date();
  due.setHours(0, 0, 0, 0);
  due.setDate(due.getDate() + dueOffsetDays);
  due.setHours(hours, minutes, 0, 0);

  return due.toISOString();
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
    const todayProbe = getTodayLunchTime();
    const activeSpans = timespans.filter(span =>
      !span.skip &&
      isTodayInRange(span.firstday, span.lastday, todayProbe) &&
      doesCronMatchToday(span.cron, todayProbe)
    );

    if (activeSpans.length === 0) {
      console.log('⚠️ No active timespan found for today (or skipped)');
      return;
    }

    const items = activeSpans.flatMap(span => span.entries);
    console.log(`📝 Using ${items.length} entries from active timespan(s)`);

    // 7. Create cards with proper titles + link detection
    let cardCount = 0;
    let dueCount = 0;
    let skippedDueCount = 0;
    
    for (let i = 0; i < items.length; i++) {
      const entry = items[i];
      const entryName = entry.name; // Access .name property
      const entryLink = entry.link; // Access .link property
      const entryDesc = entry.desc || '' // Access .desc property
      
      if (typeof entryName !== 'string' || entryName.trim() === '') {
        console.log(`  ⚠️ Skipping invalid entry at index ${i}: missing name`);
        continue;
      }
      
      const due = buildDueValue(entry);
      const dueConfigured = entry.dueOffsetDays !== undefined || entry.dueTime !== undefined;
      const isUrl = (typeof entryLink === 'string' && entryLink.trim() !== '');
      
      const queryParts = [
        `key=${config.key}`,
        `token=${config.token}`,
        `idList=${listId}`
      ];

      queryParts.push(`name=${encodeURIComponent(entryName)}`);
      queryParts.push(`desc=${encodeURIComponent(entryDesc)}`);

      if (isUrl) {
        queryParts.push(`urlSource=${encodeURIComponent(entryLink)}`);
      }

      if (due) {
        queryParts.push(`due=${encodeURIComponent(due)}`);
        console.log(`  📝 "${entryName.substring(0, 40)}..." | due ${due}`);
        dueCount++;
      } else {
        if (dueConfigured) {
          console.log(`  ⚠️ Ignoring invalid due config for "${entryName.substring(0, 40)}..."`);
          skippedDueCount++;
        }
        console.log(`  📝 "${entryName.substring(0, 40)}..."`);
      }

      cardCount++;

      const query = queryParts.join('&');
      const { data: card } = await axios.post(`https://api.trello.com/1/cards?${query}`);
      await new Promise(resolve => setTimeout(resolve, 100));

      if (Array.isArray(entry.labels) && entry.labels.length > 0) {
        for (const label of entry.labels) {
          const color = typeof label?.color === 'string' ? label.color.trim() : '';
          const labelName = typeof label?.name === 'string' ? label.name.trim() : '';
          if (!color) continue;
          await axios.post(`https://api.trello.com/1/cards/${card.id}/labels`, null, {
            params: {
              key: config.key,
              token: config.token,
              color,
              ...(labelName ? { name: labelName } : {})
            }
          });
        }
      }
    }

    console.log(`🎉 Feed complete! ${cardCount} cards + ${dueCount} due dates`);

    if (skippedDueCount > 0) {
      console.log(`⚠️ Ignored invalid due config on ${skippedDueCount} entr${skippedDueCount === 1 ? 'y' : 'ies'}`);
    }

  } catch (error) {
    console.error('❌ Feed failed:', error.response?.data || error.message);
    console.error('Status:', error.response?.status);
    process.exit(1);
  }
}

// One-way execution
feedTrello();
