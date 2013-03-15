"use strict";

var express     = require('express'),
    collections = require('./collections');

var app = module.exports = express();

app.get('/', function (req, res) {
  res.jsonp({foo: 'bar'});
});


/*
  Check that the collection is in the allowed list.
*/
app.param('collection', function (req, res, next, collection) {

  if (! collections[collection]) {
    res
      .status(404)
      .jsonp({
        error: "collection '" + collection + "' not found"
      });
  } else {
    next();
  }
});

app.get('/:collection', function (req, res) {
  res.send("FIXME");
});
