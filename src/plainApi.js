var plainApi = function(storage) {
  var express = require('express');
  var api = express.Router();
  var url = require('url');

  var renderAuthorForTweet = function(tweet) {
    if (tweet.author_nickname) {
      return '@<' + tweet.author_nickname + ' ' + tweet.author_url + '>';
    }

    return '@<' + tweet.author_url + '>';
  };

  api.use(function (req, res, next) {
    res.set('Content-Type', 'text/plain');
    next();
  });

  api.get('/tags/:tag', function (req, res) {
    if (!req.params.tag) {
      res.status(400);
      res.end();
      return;
    }

    storage.getTweetsByHashTag("#" + req.params.tag, function (tweets) {
      var response = [];

      tweets.forEach(function (tweet) {
        response.push(renderAuthorForTweet(tweet) + "\t" + tweet.timestamp + "\t" + tweet.text);
      });
      res.send(response.join("\n"));
    })
  });

  api.get('/tweets', function (req, res) {
    storage.searchTweets(req.query.q || '', function (tweets) {
      var response = [];

      tweets.forEach(function (tweet) {
        response.push(renderAuthorForTweet(tweet) + "\t" + tweet.timestamp + "\t" + tweet.text);
      });
      res.send(response.join("\n"));
    })
  });

  api.get('/mentions', function (req, res) {
    if (!req.query.url) {
      res.status(400);
      res.send("`url` must be provided.");
      res.end();
      return;
    }

    storage.getTweetsByMentions(req.query.url, function (tweets) {
      var response = [];

      tweets.forEach(function (tweet) {
        response.push(renderAuthorForTweet(tweet) + "\t" + tweet.timestamp + "\t" + tweet.text);
      });
      res.send(response.join("\n"));
    })
  });

  api.post('/users', function (req, res) {
    if (!req.query.url || !req.query.nickname) {
      res.status(400);
      res.send("`nickname` and `url` must be provided.");
      return;
    }

    if (!req.query.nickname.match(/^[A-Za-z0-9_-]+$/)) {
      res.status(400);
      res.send("`nickname` must match ^[A-Za-z0-9_-]+$");
      return ;
    }

    var urlParts = url.parse(req.query.url);
    if (!urlParts['hostname'] || !urlParts['protocol'] || (urlParts['protocol'] != 'https:' && urlParts['protocol'] != 'http:') ) {
      res.status(400);
      res.send("`url` must provide hostname and either protocol as http or https!");
      return ;
    }

    storage.addUser(req.query.url, req.query.nickname, function () {
      res.send("OK");
    });
  });

  api.get('/users', function (req, res) {
    storage.searchUsers(req.query.q || '', function (users) {
      var response = [];

      users.forEach(function (user) {
        response.push(user.url + "\t" + user.timestamp + "\t" + user.nickname);
      });
      res.send(response.join("\n"));
    })
  });

  return api;
};

module.exports = plainApi;