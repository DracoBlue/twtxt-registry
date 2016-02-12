var md5 = require('md5');
var TwtxtTxt = require('./twtxt-utils/TwtxtTxt');
var urlUtils = require('url');
var http = require('http');
var https = require('https');
var moment = require('moment');

var Storage = function(client, memcached) {

  this.client = client;
  this.memcached = memcached;
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

Storage.prototype.getTweetsByHashTag = function(hashTag, cb) {
  var that = this;

  that.client.search({
    index: 'index',
    type: 'tweets',
    sort: 'timestamp:desc',
    /* FIXME: there must be a better way then a q search */
    q: 'hashTags:"#' + hashTag + '"',
    size: 20
  }, function(error, response) {
    var tweets = [];
    response.hits.hits.forEach(function(hit) {
      tweets.push(hit._source);
    });
    cb(tweets);
  });
};

Storage.prototype.searchTweets = function(queryString, cb) {
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
    size: 20
  }, function(error, response) {
    var tweets = [];
    response.hits.hits.forEach(function(hit) {
      tweets.push(hit._source);
    });
    cb(tweets);
  });
};

Storage.prototype.searchUsers = function(queryString, cb) {
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
    size: 20
  }, function(error, response) {
    var tweets = [];
    response.hits.hits.forEach(function(hit) {
      tweets.push(hit._source);
    });
    cb(tweets);
  });
};


Storage.prototype.getTweetsByMentions = function(twtxtUrl, cb) {
  var that = this;

  that.client.search({
    index: 'index',
    type: 'tweets',
    sort: 'timestamp:desc',
    /* FIXME: there must be a better way then a q search */
    q: 'mentions:"' + twtxtUrl + '"',
    size: 20
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

  clearInterval(this.updatingInterval);

  var updateAllUrls = function() {
    that.forEachUser(function(user) {
      var client = http;
      var urlParts = urlUtils.parse(user.url);

      if (urlParts['protocol'] === "https:") {
        client = https;
      }

      var options = {
        hostname: urlParts['hostname'],
        port: urlParts['port'] || (urlParts['protocol'] === "https:" ? 443 : 80),
        path: urlParts['path'],
        method: 'GET',
        headers: {
        }
      };

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

  this.updatingInterval = setInterval(function() {
    updateAllUrls();
  }, 60000);

  updateAllUrls();
};

module.exports = Storage;