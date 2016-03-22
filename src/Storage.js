var md5 = require('md5');
var TwtxtTxt = require('./twtxt-utils/TwtxtTxt');
var urlUtils = require('url');
var http = require('http');
var https = require('https');
var moment = require('moment');
var fs = require('fs');
var robots = require('robots');
var info = JSON.parse(fs.readFileSync(__dirname + '/../package.json'));
info.version = info.version || 'dev';

var Storage = function(client, memcached) {

  this.client = client;
  this.memcached = memcached;
  this.robotsParserUrlMap = {};
  this.userAgent = "twtxt-registry/" + info.version;
};

Storage.prototype.addUser = function(url, nickname, cb) {
  var that = this;
  var user = {
    url: url,
    nickname: nickname,
    timestamp: moment().toISOString()
  };

  that.client.create({
    index: 'index',
    type: 'users',
    id: md5(url),
    body: user
  }, cb);
};

Storage.prototype.storeTweet = function(tweet, cb) {
  var that = this;

  that.client.update({
    index: 'index',
    type: 'tweets',
    id: tweet.id,
    body: tweet
  }, function() {
    that.client.create({
      index: 'index',
      type: 'tweets',
      id: tweet.id,
      body: tweet
    }, cb);
  });
};

Storage.prototype.forEachUser = function(cb) {
  var that = this;

  var doScroll = function(scrollId) {
    that.client.scroll({
      scrollId: scrollId,
      type: 'users',
      scroll: '30s'
    }, function(error, response) {
      response.hits.hits.forEach(function (hit) {
        process.nextTick(function() {
          cb(hit._source);
        })
      });

      if (response.hits.hits.length) {
        doScroll(scrollId);
      }

    });
  };

  that.client.search({
    index: 'index',
    scroll: '30s',
    size: 1,
    type: 'users',
    search_type: 'scan'
  }, function(error, response) {
    doScroll(response._scroll_id);
  });
};

Storage.prototype.getTweetsByHashTag = function(hashTag, page, cb) {
  var that = this;

  that.client.search({
    index: 'index',
    type: 'tweets',
    sort: 'timestamp:desc',
    /* FIXME: there must be a better way then a q search */
    q: 'hashTags:"#' + hashTag + '"',
    size: 20,
    from: (page * 20) - 20
  }, function(error, response) {
    var tweets = [];
    response.hits.hits.forEach(function(hit) {
      tweets.push(hit._source);
    });
    cb(tweets);
  });
};

Storage.prototype.searchTweets = function(queryString, page, cb) {
  var that = this;

  var body = {};

  if (queryString) {
    body = {
      query: {
        match: {
          text: queryString
        }
      }
    };
  }

  that.client.search({
    index: 'index',
    type: 'tweets',
    body: body,
    sort: 'timestamp:desc',
    size: 20,
    from: (page * 20) - 20
  }, function(error, response) {
    var tweets = [];
    response.hits.hits.forEach(function(hit) {
      tweets.push(hit._source);
    });
    cb(tweets);
  });
};

Storage.prototype.searchUsers = function(queryString, page, cb) {
  var that = this;

  var body = {};

  if (queryString) {
    body = {
      query: {
        match: {
          nickname: queryString
        }
      }
    };
  }

  that.client.search({
    index: 'index',
    type: 'users',
    body: body,
    sort: 'timestamp:desc',
    size: 20,
    from: (page * 20) - 20
  }, function(error, response) {
    var tweets = [];
    response.hits.hits.forEach(function(hit) {
      tweets.push(hit._source);
    });
    cb(tweets);
  });
};


Storage.prototype.getTweetsByMentions = function(twtxtUrl, page, cb) {
  var that = this;

  that.client.search({
    index: 'index',
    type: 'tweets',
    sort: 'timestamp:desc',
    /* FIXME: there must be a better way then a q search */
    q: 'mentions:"' + twtxtUrl + '"',
    size: 20,
    from: (page * 20) - 20
  }, function(error, response) {
    var tweets = [];
    response.hits.hits.forEach(function(hit) {
      tweets.push(hit._source);
    });
    cb(tweets);
  });
};

Storage.prototype.startUpdating = function() {
  var that = this;

  var lastUpdate = 0;
  var seconds = 60;

  clearInterval(this.updatingInterval);

  var updateAllUrls = function() {

    lastUpdate++;

    if (lastUpdate > (60 * 24 * 60) / seconds) {
      lastUpdate = 0;
    }

    that.forEachUser(function(user) {
      var client = http;
      var options = urlUtils.parse(user.url);

      if (options['protocol'] === "https:") {
        client = https;
      }

      options.headers = that.userAgent;
      options.method = 'GET';

      var robotsTxtOptions = JSON.parse(JSON.stringify(options));
      robotsTxtOptions.path = "/robots.txt";
      robotsTxtOptions.pathname = "/robots.txt";
      var robotsTxtUrl = urlUtils.format(robotsTxtOptions);

      var fetchUrlIfAllowed = function(parser) {
        /* default delay is 100 times a day */
        var crawlDelay = Math.ceil((parser.getCrawlDelay(that.userAgent) || 900) / seconds);

        //console.log("CrawlDelay: " + parser.getCrawlDelay(that.userAgent) + " for " + robotsTxtUrl);
        //console.log("number is at", lastUpdate, "delay is at", crawlDelay,  "% is at", lastUpdate % crawlDelay);

        if (crawlDelay != 0 && lastUpdate % crawlDelay != 0) {
          //console.log("does not match crawlDelay! STOP");
          return ;
        }

        //console.log("does match crawlDelay! FETCH");

        parser.canFetch(that.userAgent, options.path, function (access, url, reason) {
          if (!access) {
            console.error("not allowed to fetch", user.url, "because of " + robotsTxtUrl + ":", reason.type, " statusCode:", reason.statusCode);
            return ;
          }

          var key = md5(user.url);

          that.memcached.get('last-modified-since-' + key, function(err, memcacheData) {

            if (memcacheData) {
              options.headers['If-Modified-Since'] = memcacheData;
            }

            var req = client.request(options, function(res) {
              var body = [];
              res.on('data', function(chunk) {
                body.push(chunk);
              }).on('end', function() {
                if (res.statusCode == 304) {
                  return ;
                }
                body = Buffer.concat(body).toString();

                var txt = new TwtxtTxt(user.url, user.nickname, body);
                txt.getTweets().forEach(function(tweet) {
                  that.storeTweet(tweet, function() {
                  });
                });

                if (res.headers['last-modified']) {
                  that.memcached.set('last-modified-since-' + key, res.headers['last-modified'], 60*60*24, function() {
                  });
                }
              });

            }).on('error', function (e) {});
            req.end();
          });
        });
      };


      if (!that.robotsParserUrlMap[robotsTxtUrl]) {
        console.log("Creating robots.txt parser for:", robotsTxtUrl);
        that.robotsParserUrlMap[robotsTxtUrl] = new robots.RobotsParser(
          robotsTxtUrl,
          that.userAgent,
          function (parser, success) {
            fetchUrlIfAllowed(that.robotsParserUrlMap[robotsTxtUrl]);
          }
        );

        /* update the parser once in a day */
        setInterval(function() {
          console.log("Recreating robots.txt parser for:", robotsTxtUrl);
          that.robotsParserUrlMap[robotsTxtUrl] = new robots.RobotsParser(
            robotsTxtUrl,
            that.userAgent
          );
        }, 24 * 60 * 60000);
      } else {
        fetchUrlIfAllowed(that.robotsParserUrlMap[robotsTxtUrl]);
      }
    });
  };

  this.updatingInterval = setInterval(function() {
    updateAllUrls();
  }, seconds * 1000); // check every minute for the crawl delay (fallback to 100 times a day!)

  updateAllUrls();
};

module.exports = Storage;
