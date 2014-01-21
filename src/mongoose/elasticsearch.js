"use strict";

/**
 * Mongoose middleware providing elasticsearch indexing and searching for
 * models.
 *
 * Uses the database name as the index and the model name as the type when
 * indexing documents in elasticsearch. This can be configured by overriding
 * the `indexName` and/or `typeName` methods.
 */

var elasticsearch = require('elasticsearch');

module.exports = elasticsearchPlugin;

var client = elasticsearchPlugin.client = new elasticsearch.Client();

function elasticsearchPlugin(schema) {

  /**
   * After the document has been saved, index it in elasticsearch.
   */
  schema.post('save', function(doc) {
    client.index({
      index: doc.constructor.indexName(),
      type: doc.constructor.typeName(),
      id: doc.id,
      body: doc.toJSON()
    }, function() {
      doc.emit('es-indexed');
    });
  });

  /**
   * After the document is removed, delete it from elasticsearch.
   */
  schema.post('remove', function(doc) {
    client.delete({
      index: doc.constructor.indexName(),
      type: doc.constructor.typeName(),
      id: doc.id
    }, function() {
      doc.emit('es-removed');
    });
  });

  /**
   * Configure the index name using the database name.
   */
  schema.statics.indexName = function() {
    return this.db.name.toLowerCase();
  };

  /**
   * Configure the type name using the model name.
   */
  schema.statics.typeName = function() {
    return this.modelName.toLowerCase();
  };

  /**
   * Add a search method to models that use this plugin.
   *
   * @param {Object} params An object containing search params
   * @param {String} params.q The elasticsearch query to perform
   * @param {String} params.page Page of results to return
   * @param {String} params.per_page Number of results per page
   * @param {Function} cb Function to call when search is complete
   */
  schema.statics.search = function(params, cb) {
    var page = parseInt(params.page, 10) || 1;
    var perPage = parseInt(params.per_page, 10) || 30;

    if (page < 1 || page > 1000) {
      page = 1;
    }

    if (perPage < 1 || perPage > 100) {
      perPage = 30;
    }

    client.search({
      index: this.indexName(),
      type: this.typeName(),
      q: params.q,
      from: (page - 1) * perPage,
      size: perPage
    }, cb);

  };

  /**
   * Reindex all the documents in this collection using the elasticsearch
   * bulk API.
   */
  schema.statics.reIndex = function(done) {
    var self = this;
    self.find(function(err, docs) {
      if (err) {
        return done(err);
      }

      var body = [];

      docs.forEach(function(doc) {
        // The bulk index API expects a command doc, then a content doc and so on.
        body.push({
          index: {
            _index: self.indexName(),
            _type: self.typeName(),
            _id: doc.id,
          }
        });

        body.push(doc.toJSON());
      });

      // Send the commands and content docs to the bulk API.
      client.bulk({body: body}, done);
    });

  };
}
