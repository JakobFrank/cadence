const PORT = 8080;
const IP = '198.37.25.185';
const DB_URL = 'mongodb://localhost:27017/cadence';
const MUSIC_DIR = '/home/ken/Music';


var express = require('express');
var path = require('path');
var bodyParser = require('body-parser');
var MongoClient = require('mongodb').MongoClient;
var mm = require('musicmetadata');

var app = express();


// Parse incoming data
app.use(bodyParser.urlencoded({
  extended: true
}));

// Point to publicly served files
app.use(express.static(path.join(__dirname, 'public')));


// Connect to database. Populate.
MongoClient.connect(DB_URL, function (err, db) {
  if (err) {
    return console.log(err);
  }

  // Create a music collection.
  db.createCollection("music", function (err, res) {
    if (err) {
      throw err;
    }
  })

  // Walk the directory
  var fs = require('fs');
  var walk = function (dir, done) {
    fs.readdir(dir, function (error, list) {
      if (error) {
        return done(error);
      }
      var i = 0;
      (function next() {
        var file = list[i++];
        if (!file) {
          return done(null);
        }
        file = dir + '/' + file;
        fs.stat(file, function (error, stat) {
          if (stat && stat.isDirectory()) {
            walk(file, function (error) {
              next();
            });
          } else {
            var parser = mm(fs.createReadStream(file), function (err, metadata) {
              if (err) {
                next();
              }
              // Insert the object to the database
              db.collection("music").update({
                path: file
              }, {
                $set: {
                  'title': metadata.title,
                  "artist": metadata.artist,
                  "album": metadata.album
                }
              }, {
                upsert: true
              })
            })
          };
          next();
        });
      })();
    });
  };

  // optional command line params
  //      source for walk path
  process.argv.forEach(function (val, index, array) {
    if (val.indexOf('source') !== -1) {
      MUSIC_DIR = val.split('=')[1];
    }
  });

  walk(MUSIC_DIR, function (error) {
    if (error) {
      throw error;
    }
  });

  console.log("Database updated.");
});


// Search, directed from aria.js AJAX
app.post('/search', function (req, res) {
  console.log("Received: " + JSON.stringify(req.body));
  // Web Server Console:
  // Received: {"search":"railgun"}
  var query = {
    title: req.body.search,
    artist: req.body.search,
    album: req.body.search
  };

  // Database search
  MongoClient.connect(DB_URL, function (err, db) {
    if (err) {
      return console.log(err);
    }

    db.collection("music").find(query).toArray(function(err,results){
      console.log("FOUND");
      console.log(results);
    })

    db.close();
  });

  res.send("OK from ARIA!");
  res.end();
});

var server = app.listen(PORT, IP);