import {stemmer} from 'stemmer'
import md5 from 'md5';
import TwtxtTxt from './twtxt-utils/TwtxtTxt.mjs';
import urlUtils from 'url';
import http from 'http';
import https from 'https';
import fs from 'fs';
import robots from 'robots';

const info = JSON.parse(fs.readFileSync( './package.json'));
info.version = process.env.APP_VERSION || info.version || 'dev';

let Storage = function(datastore) {
  this.datastore = datastore;
  this.robotsParserUrlMap = {};
  this.userAgent = "twtxt-registry/" + info.version;
};

Storage.prototype.addUser = function(url, nickname, cb) {
  console.log("Save user for url", url);

  this.datastore.save({
    key: this.datastore.key(['users', url]),
    data: {
      timestamp: new Date().toJSON(),
      nickname,
      url
    }
  }).then(cb);
};

Storage.prototype.storeTweet = async function(tweet) {
  console.log("Save tweet for id", tweet.id);

  tweet.stems = tweet.text.split(" ").map((word) => {
    return stemmer(word.trim()).trim();
  });

  await this.datastore.save({
    key: this.datastore.key(['tweets', tweet.id]),
    data: tweet
  });
};

Storage.prototype.getAllUsers = async function() {
  const query = this.datastore.createQuery('users');
  const [users] = await query.run();
  return users;
}

Storage.prototype.forEachUser = function(cb) {
  const query = this.datastore.createQuery('users');
  query.run((err, entities) => {
    entities.map((entity) => {
      return entity;
    }).forEach(cb);
  });
};

Storage.prototype.getTweetsByHashTag = function(hashTag, page, cb) {
  const query = this.datastore.createQuery('tweets');
  query.filter('hashTags', '=', hashTag);
  query.order('timestamp',{
    descending: true
  });
  query.offset((page * 20) - 20);
  query.limit(20);
  query.run((err, entities) => {
    cb(entities.map((entity) => {
      return entity;
    }));
  });
};

Storage.prototype.searchTweets = function(queryString, page, cb) {
  const query = this.datastore.createQuery('tweets');
  if (queryString) {
    query.filter('stems', 'IN', stemmer(queryString).split(" "));
  }
  query.order('timestamp',{
    descending: true
  });
  query.offset((page * 20) - 20);
  query.limit(20);
  query.run((err, entities) => {
    cb(entities.map((entity) => {
      return entity;
    }));
  });
};

Storage.prototype.searchUsers = function(queryString, page, cb) {
  const query = this.datastore.createQuery('users');
  if (queryString) {
    query.filter('nickname', '=', queryString);
  }

  query.run((err, entities) => {
    cb(entities.map((entity) => {
      return entity;
    }));
  });
};


Storage.prototype.getTweetsByMentions = function(twtxtUrl, page, cb) {
  const query = this.datastore.createQuery('tweets');
  query.filter('mentions', '=', twtxtUrl);
  query.order('timestamp',{
    descending: true
  });
  query.offset((page * 20) - 20);
  query.limit(20);
  query.run((err, entities) => {
    if (err) {
      throw err;
    }
    cb(entities.map((entity) => {
      return entity;
    }));
  });
};

Storage.prototype.isTimeForCrawl = function (crawlDelay, secondsSinceStartOfDay, updateIntervalInSeconds) {
  if (!crawlDelay) {
    return true;
  }

  let crawlSlotNumberPreviousSlot = Math.floor(secondsSinceStartOfDay / crawlDelay);
  let crawlSlotNumberCurrentSlot = Math.floor((secondsSinceStartOfDay + updateIntervalInSeconds) / crawlDelay);

  if (crawlSlotNumberCurrentSlot > crawlSlotNumberPreviousSlot) {
    return true;
  }

  return false;

  /* secondsSinceStartOfDay:
   * 0
   * 900
   * 1800
   * 2700
   * 3600        ---> Math.floor(3600 / 4000) = 0
   *    --> 4000
   * 4500        ---> Math.floor(4500 / 4000) = 1
   * 5400
   * 6300
   * 7200
   *    --> 8000
   * 8100
   *
   * crawlDelay = 4000
   */


}

Storage.prototype.getRobotsTxtParserForUrl = async function (robotsTxtUrl) {
  return new Promise((resolve, reject) => {
    new robots.RobotsParser(
        robotsTxtUrl,
        this.userAgent,
        (parser, success) => {
          if (success) {
            resolve(parser);
          } else {
            reject(new Error('Cannot create parser for ' + robotsTxtUrl));
          }
        }
    );
  });
};

Storage.prototype.executeUpdate = async function (updateInterval) {
  const now = new Date();
  const lastUpdate = Math.ceil(now.getTime() / 1000);

  let users = await this.getAllUsers();

  await Promise.all(users.map(async (user) => {
    var client = http;
    var options = urlUtils.parse(user.url);

    if (options['protocol'] === "https:") {
      client = https;
    }

    options.headers = {
      "User-Agent": this.userAgent
    };

    options.method = 'GET';

    var robotsTxtOptions = JSON.parse(JSON.stringify(options));
    robotsTxtOptions.path = "/robots.txt";
    robotsTxtOptions.pathname = "/robots.txt";
    var robotsTxtUrl = urlUtils.format(robotsTxtOptions);

    let robotsUrlParser = null;

    try {
      robotsUrlParser = await this.getRobotsTxtParserForUrl(robotsTxtUrl);
    } catch (error) {
      return ;
    }

    let crawlDelay = Math.ceil(robotsUrlParser.getCrawlDelay(this.userAgent));

    /* default delay is 100 times a day (if it is 900 and seconds is 60. our setting is after 120/60 seconds) */

    console.log("CrawlDelay: ", crawlDelay, " for ", robotsTxtUrl);
    console.log("last update at", lastUpdate, "update interval is ", updateInterval);

    if (!this.isTimeForCrawl(crawlDelay, lastUpdate, updateInterval)) {
      console.log("does not match crawlDelay! STOP");
      return ;
    }

    console.log("does match crawlDelay! FETCH");

    let {access, url, reason} = await (new Promise((resolve, reject) => {
      robotsUrlParser.canFetch(this.userAgent, options.path,  (access, url, reason) => {
        resolve({
          access, url, reason
        });
      });
    }));

    if (!access) {
      console.error("not allowed to fetch", user.url, "because of " + robotsTxtUrl + ":", reason.type, " statusCode:", reason.statusCode);
      return ;
    }

    let lastModifiedEntity = null;

    try {
      const [lastModifiedEntity] = await this.datastore.get(this.datastore.key(['last-modified-since', user.url]));
    } catch (error) {
    }

    if (lastModifiedEntity) {
      options.headers['If-Modified-Since'] = lastModifiedEntity['timestamp'];
    }

    let {statusCode, body, lastModified} = await (new Promise((resolve, reject) => {
      client.request(options, (res) => {
        let body = [];
        res.on('data', (chunk) => {
          body.push(chunk);
        }).on('end', () => {
          resolve({
            body: Buffer.concat(body).toString(),
            statusCode: res.statusCode,
            lastModified: res.headers['last-modified']
          });
        });
      }).on('error', reject).end();
    }));

    if (statusCode === 304) {
      return ;
    }

    var txt = new TwtxtTxt(user.url, user.nickname, body);

    await Promise.all(txt.getTweets().map(async (tweet) => {
      if (tweet.body.length > 1500) {
        console.log('Skip tweet - has more than 1500 body letters.');
      } else {
        await this.storeTweet(tweet);
      }
    }));

    if (lastModified) {
      // FIXME: ttl 60*60*24
      await this.datastore.save([{
        'key': this.datastore.key(['last-modified-since', user.url]),
        'data': {
          'timestamp': lastModified
        }
      }]);
    };
  }));
};

Storage.prototype.startUpdating = function(updateInterval) {
  clearInterval(this.updatingInterval);

  let execute = () => {
    this.executeUpdate(updateInterval);
  };

  this.updatingInterval = setInterval(() => {
    execute();
  }, updateInterval * 1000);

  execute();
};


export default Storage;