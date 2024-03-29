import dotenv from 'dotenv';
dotenv.config();

import Storage from './Storage.mjs';
import express from 'express';
import {Datastore} from "@google-cloud/datastore";
import http from "http";
import fs from "fs";
import plainApi from './plainApi.mjs';



// Create an express instance and set a port variable
var app = express();
var port = process.env.PORT || 8080;

// Disable etag headers on responses
app.disable('etag');

var storage = new Storage(
  new Datastore()
);

app.use('/api/plain/', plainApi(storage));

app.get('/', function (req, res) {
  var response = [
    "<!DOCTYPE html>",
    "<html>",
    "<head>",
    "<title>twtxt registry</title>",
    "</head>",
    "<body>",
    "<h1>Twtxt Registry</h1>",
    '<p>This is a hosted registry for <a href="https://github.com/buckket/twtxt">https://github.com/buckket/twtxt</a>. The registry software is developed by <a href="https://dracoblue.net">dracoblue</a> and you may find the source code at <a href="https://github.com/DracoBlue/twtxt-registry">https://github.com/DracoBlue/twtxt-registry</a>.</p>',
    '<p>The api doc can be found at <a href="/swagger-ui/">/swagger-ui/</a>.</p>',
    "<body>",
    "</html>"
  ];
  res.set('Content-Type', 'text/html');
  res.send(response.join("\n"));
});

var renderSwaggerInitializerJson = function(req, res) {
  var response = fs.readFileSync(  './node_modules/swagger-ui-dist/swagger-initializer.js').toString();
  response = response.replace("https://petstore.swagger.io/v2/swagger.json", "/api/swagger.json");

  res.set('Content-Type', 'application/json');
  res.send(response);
};
var renderSwaggerHtml = function(req, res) {
  var response = fs.readFileSync(  './node_modules/swagger-ui-dist/index.html').toString();
  res.set('Content-Type', 'text/html');
  res.send(response);
};

app.get("/swagger-ui/swagger-initializer.js", renderSwaggerInitializerJson);
app.get("/swagger-ui/index.html", renderSwaggerHtml);
app.get("/swagger-ui/", renderSwaggerHtml);

app.get("/api/swagger.json", function(req, res) {
  res.set('Content-Type', 'application/json');
  var response = JSON.parse(fs.readFileSync( './src/swagger.json').toString());
  var info = JSON.parse(fs.readFileSync('./package.json'));
  response.info.version = info.version || 'dev';
  res.send(JSON.stringify(response));
});

// Set /public as our static content dir
app.use("/swagger-ui/", express.static("./node_modules/swagger-ui-dist/"));

var server = http.createServer(app).listen(port, function() {
  console.log('twtxt registry listening on port ' + port);
  if (process.env.START_UPDATING) {
    const updateInterval = parseInt(process.env.UPDATING_INTERVAL || "900", 10);
    storage.startUpdating(updateInterval);
  }
});

storage.addUser("https://buckket.org/twtxt.txt", "buckket", function() {
});

storage.addUser("https://buckket.org/twtxt_news.txt", "twtxt_news", function() {
});

storage.addUser("https://dracoblue.net/twtxt.txt", "dracoblue", function() {
});
