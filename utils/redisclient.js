const Redis = require('ioredis');

const MAX_SEARCH_RESULTS = 1000;

const redis = new Redis({
  host: '127.0.0.1',
  port: 6379,
  password:null,
});

const performSearch = async (index, ...query) => {
  try {
    // Return the first MAX_SEARCH_RESULTS matching documents.
    //modify the search result.

    const searchResults = await redis.call('FT.SEARCH', index, query, 'LIMIT', '0', MAX_SEARCH_RESULTS);

    // An empty search result looks like [ 0 ].
    if (searchResults.length === 1) {
      return [];
    }
    //console.log(searchResults);
    // Actual results look like:
    //
    // [ 3, 'hashKey', ['fieldName', 'fieldValue', ...],
    //      'hashKey', ['fieldName, 'fieldValue', ...], ... ]
    /*
    const results = [];
    for (let n = 2; n < searchResults.length; n += 2) {
      const result = {};
      const fieldNamesAndValues = searchResults[n];

      for (let m = 0; m < fieldNamesAndValues.length; m += 2) {
        const k = fieldNamesAndValues[m]; 
        const v = fieldNamesAndValues[m + 1];
        result[k] = v;
      }
      results.push(result);
    }
    */
    return searchResults;
  } catch (error) {
    // A malformed query or unknown index etc causes an exception type error.
    console.error("Error performing search:",error);
    throw error;
    return [];
  }
};

function searchResultsConverter(resultArray){
  if (resultArray.length === 1) {
    return [];
  }
  const results = [];
    for (let n = 2; n < resultArray.length; n += 2) {
      const result = {};
      const fieldNamesAndValues = resultArray[n];

      for (let m = 0; m < fieldNamesAndValues.length; m += 2) {
        const k = fieldNamesAndValues[m]; 
        const v = fieldNamesAndValues[m + 1];
        result[k] = v;
      }
      results.push(result);
    }
  return results
}

async function countMatchingHashes(pattern) {
  let count = 0;
  let cursor = '0'; 

  do {
    const [newCursor, keys] = await redis.scan(cursor, 'MATCH', pattern);
    for (const key of keys) {
      const type = await redisClient.type(key);
      if (type === 'hash') {
        count++;
      }
    }
    cursor = newCursor;
  } while (cursor !== '0');

  return count;
}

const createIndexes = async () => {
  console.log('Dropping any existing indexes, creating new indexes...');

  const usersIndexKey = 'myApp:usersidx';
  const locationsIndexKey = 'myApp:locationsidx';
  const ratingIndexKey = 'myApp:ratingsidx';
  const pipeline = redis.pipeline();
  pipeline.call('FT.DROPINDEX', usersIndexKey);
  pipeline.call('FT.DROPINDEX', locationsIndexKey);
  pipeline.call('FT.DROPINDEX', ratingIndexKey);
  pipeline.call('FT.CREATE', usersIndexKey, 'ON', 'HASH', 'PREFIX', '1', 'myApp:users', 'SCHEMA', 'email', 'TAG', 'SORTABLE', 'firstName', 'TEXT', 'SORTABLE', 'lastName', 'TEXT', 'SORTABLE');
  pipeline.call('FT.CREATE', locationsIndexKey, 'ON', 'HASH', 'PREFIX', '1', 'myApp:locations', 'SCHEMA', 'name','TAG','SORTABLE','category', 'TAG', 'SORTABLE', 'location', 'TAG', 'SORTABLE', 'numStars', 'NUMERIC', 'SORTABLE', 'numRating', 'NUMERIC', 'SORTABLE','avgRating', 'NUMERIC', 'SORTABLE');
  pipeline.call('FT.CREATE', ratingIndexKey, 'ON', 'HASH', 'PREFIX', '1', 'myApp:ratings', 'SCHEMA', 'userId', 'TAG', 'SORTABLE', 'locationId', 'TAG', 'SORTABLE', 'rating', 'NUMERIC', 'SORTABLE');
  const responses = await pipeline.exec();

  if (responses.length === 6 && responses[3][1] === 'OK' && responses[4][1] === 'OK' && responses[5][1] === 'OK') {
    console.log('Created indexes.');
  } else {
    console.log('Unexpected error creating indexes :(');
    console.log(responses);
  }
};

module.exports = {
  getClient: () => redis,
  getKeyName: (...args) => `${"myApp"}:${args.join(':')}`,
  performSearch,
  countMatchingHashes,
  createIndexes,
  searchResultsConverter
};
