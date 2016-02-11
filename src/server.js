// Require our dependencies
var express = require('express');
var elasticsearch = require('elasticsearch');
var Storage = require('./Storage');
var plainApi = require('./plainApi');
var http = require('http');

// Create an express instance and set a port variable
var app = express();
var port = process.env.PORT || 8080;

// Disable etag headers on responses
app.disable('etag');

var storage = new Storage(
  new elasticsearch.Client({
    host: (process.env.ELASTICSEARCH_HOST || "localhost") + ":" + (process.env.ELASTICSEARCH_PORT || "9200"),
    log: 'warning'
  })
);

app.use('/api/plain/', plainApi(storage));

var server = http.createServer(app).listen(port, function() {
  console.log('twtxt registry listening on port ' + port);
  storage.startUpdating();
});

storage.addUrl("https://buckket.org/twtxt.txt", function() {
});

storage.addUrl("https://buckket.org/twtxt_news.txt", function() {
});

storage.addUrl("https://dracoblue.net/twtxt.txt", function() {
});