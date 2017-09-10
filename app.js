/**
 * Copyright 2015 IBM Corp. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const express = require('express');
const Twit = require('twit');
const NaturalLanguageUnderstandingV1 = require('watson-developer-cloud/natural-language-understanding/v1.js');

const app = express();
const nlu = new NaturalLanguageUnderstandingV1({
  version_date: NaturalLanguageUnderstandingV1.VERSION_DATE_2017_02_27,
});
var T = new Twit({
      consumer_key:         'Tj8vSQkq8QkqFkePNafI7uCFV',
      consumer_secret:      'oEzH8UKSB7ICYfwIX8kXoNxMrM5M3WQ4v8qH3mWj4qlBIGZIUg',
      access_token:         '80063168-s145eUD6MuwD7VRyYrSRsK3Rccj3riSHYLlFPJsYn',
      access_token_secret:  'iSUcUX0jCha0MKZvdDeODaXhuMcOw1b8PKCmGcfRvNuzK',
      timeout_ms:           60*1000,  // optional HTTP request timeout to apply to all requests.
});
var streamingTweets = [];
var stream = T.stream('statuses/filter', { track: ['silent sam', '#SilentSam'] })
stream.on('tweet', function (tweet) {
    console.log('tweet from stream: ', tweet);
})
// setup body-parser
const bodyParser = require('body-parser');

app.use(bodyParser.json());

// Bootstrap application settings
require('./config/express')(app);


app.get('/', (req, res) => {
  res.render('index', {
    bluemixAnalytics: !!process.env.BLUEMIX_ANALYTICS,
  });
});

app.post('/api/analyze', (req, res, next) => {
  if (process.env.SHOW_DUMMY_DATA) {
    res.json(require('./payload.json'));
  } else {
    // grab relevant tweets
    T.get('search/tweets', { q: 'banana since:2017-09-10', count: 5 })
    .catch(function (err) {
      console.log('caught error', err.stack)
    })
    .then(function (result) {
      let tweetsFromTwit = [];
      console.log('data from Twit', result.data);
      result.data.statuses.forEach(twitData => {
        tweetsFromTwit.push(twitData.text);
      });

      let NLUResults = [];
      let NLURequests = tweetsFromTwit.map(tweetText => {
        return new Promise((resolve) => {
          nlu.analyze(formatForNLU(tweetText), (err, results) => {
            if (err) {
              return next(err);
            }
            NLUResults.push(results);
          })
        });
      })
      return Promise.all(NLURequests).then(() => {
        return res.json({ query: req.body.query, NLUResults});
      });
    })
  }
});

function formatForNLU(string) {
  return {
    "text": string,
    "features": {
      "entities": {
        "emotion": true,
        "sentiment": true,
        "limit": 20
      },
      "keywords": {
        "emotion": true,
        "sentiment": true,
        "limit": 20
      }
    }
  }
}

// error-handler settings
require('./config/error-handler')(app);

module.exports = app;
