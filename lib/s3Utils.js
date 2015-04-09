var mime = require('mime');
var zlib = require('zlib');
var knox = require('knox');
var glob = require('glob');
var fs = require('fs');
var q = require('q');
var path = require('path');
var its = require('its');

var pauseStream = require('pause-stream');

var TO_GZIP = [
  'text/html',
  'text/plain',
  'text/xml',
  'text/css',
  'text/javascript',
  'application/javascript'
];

module.exports = function createApi(awsAccessKeyId, awsSecretAccessKey, bucketName){
  its.string(awsAccessKeyId);
  its.string(awsSecretAccessKey);
  its.string(bucketName);

  var client = knox.createClient({
    key: awsAccessKeyId,
    secret: awsSecretAccessKey,
    bucket: bucketName
  });

  var api = {};

  api.diff = function(base, searchGlob, prefix) {
    var deferred = q.defer();

    glob(searchGlob, function(err, files){
      if(err){
        deferred.reject(err);
        return;
      }

      var localFiles = files.filter(function(filePath){
        var stat = fs.statSync(filePath);
        return stat.isFile();
      }).map(function(file){
        return path.relative(base, file);
      });

      api.list(prefix).then(function(data){
        var remoteFiles = data.Contents;
        var removedFiles = [];
        var remoteFileMap = {};
        remoteFiles.forEach(function(remoteFile){
            var fileName = path.relative(prefix, remoteFile.Key);
            remoteFileMap[fileName] = remoteFile;
        });

        var remoteFileNames = Object.keys(remoteFileMap);
        var existingFiles = [];
        var filesToRemove = remoteFileNames.filter(function(remoteFile){
          if(localFiles.indexOf(remoteFile) === -1){
            return true;
          } else {
            existingFiles.push(remoteFile);
            return false;
          }
        });

        var newFiles = localFiles.filter(function(newFile){
          return existingFiles.indexOf(newFile) === -1;
        });

        deferred.resolve({
          new: newFiles,
          existing: existingFiles,
          removed: filesToRemove
        });
      }).catch(function(e){
        deferred.reject(e);
      });
    });

    return deferred.promise;
  };

  /*
    @param stream the data stream to put in destination
    @param destinationPath the path to where to put the stream
    @param an object or function(stream, destinationPath) which returns an object
      containing the optional parameters (such as headers) for this put request.
  */
  api.putStream = function(stream, destinationPath, options){
    var deferred = q.defer();

    options = options || {};

    if(typeof options === 'function') {
      options = options(stream, destinationPath);
    }

    var additionalHeaders = options.headers || {};

    var headers = {};

    Object.keys(additionalHeaders).forEach(function(headerName){
      headers[headerName] = additionalHeaders[headerName];
    });

    var mimeType = mime.lookup(destinationPath);
    var shouldGzip = TO_GZIP.indexOf(mimeType) !== -1;
    if(shouldGzip){
      stream = stream.pipe(zlib.createGzip());
      headers['Content-Encoding'] = 'gzip';
    }

    if(headers['Content-Type'] === undefined){
      headers['Content-Type'] = mimeType;
    }

    var contentLength = 0;
    var streamBuffer = pauseStream();
    streamBuffer.pause();

    stream.on('data', function(data){
      contentLength += data.length;
      streamBuffer.write(data);
    });

    stream.on('end', function(){
      headers['Content-Length'] = contentLength;

      client.putStream(streamBuffer, destinationPath, headers, function(err, res){
        if(err) {
          console.error('Error occurred in putting', destinationPath, err);
          deferred.resolve();
        } else {
          res.resume();
          deferred.resolve();
        }
      });

      streamBuffer.resume();
    });

    stream.on('error', function(err){
      console.error('Error in putting files', err);
      deferred.reject(err);
    });

    return deferred.promise;
  };

  api.putFile = function(filePath, destinationPath, options){
    //console.info('Putting', filePath, 'to', destinationPath);
    var stream = fs.createReadStream(filePath);
    return api.putStream(stream, destinationPath, options);
  };

  api.putGlob = function(searchGlob, destination, options){
    options = options || {};
    var base = options.base || '';

    //console.log('Putting', searchGlob, 'to', destination);

    return api.diff(base, searchGlob, destination).then(function(data){
      var toRemove = data.removed.map(function(filePath){
        return destination + '/' + filePath;
      });

      var upsertFiles = data.existing.concat(data.new);

      if(toRemove.length > 0){
        return api.deleteMultiple(toRemove).then(function(){
          return upsertFiles;
        });
      } else {
        return upsertFiles;
      }
    }).then(function(upsertFiles){
      var promises = upsertFiles.map(function(filePath){
        var sourcePath = path.join(base, filePath);
        var destinationPath = path.join(destination, filePath);
        return api.putFile(sourcePath, destinationPath, options);
      });

      return q.all(promises);
    });
  };

  api.putDirectory = function(directory, destination, options){
    //console.log('Putting', directory, 'to', destination);
    var searchGlob = directory + '/**/*';
    options.base = directory;
    return api.putGlob(searchGlob, destination, options);
  };

  api.deleteMultiple = function(resourcePaths){
    var deferred = q.defer();

    client.deleteMultiple(resourcePaths, function(err, res){
      if(err) return deferred.reject(err);
      deferred.resolve();
    });

    return deferred.promise;
  };

  api.delete = function(resourcePath){
    //console.log('Deleting', resourcePath);
    return api.deleteMultiple([resourcePath]);
  };

  api.deletePrefix = function(prefix){
    //console.log('Deleting', prefix);

    return api.getFiles(prefix).then(function(files){
      var deferred = q.defer();

      client.deleteMultiple(files, function(err, res){
        if(err) return deferred.reject(err);
        deferred.resolve(files);
      });

      return deferred.promise;
    });
  };


  api.head = function(resourcePath){
    var deferred = q.defer();

    client.head(resourcePath).on('response', function(res){
      deferred.resolve(res);
    }).end();

    return deferred.promise;
  };

  api.getFiles = function(prefix){
    //console.log('Getting files for prefix', prefix);

    var deferred = q.defer();

    client.list({ prefix: prefix }, function(err, data){
      if(err) return deferred.reject(err);

      var files = data.Contents.map(function(obj){
        return obj.Key;
      });

      deferred.resolve(files);
    });

    return deferred.promise;
  };

  api.list = function(prefix){
    var deferred = q.defer();

    client.list({ prefix: prefix }, function(err, data){
      if(err) return deferred.reject(err);
      deferred.resolve(data);
    });

    return deferred.promise;
  };

  api.updateAcl = function(prefix, acl){
    //console.log('Updating acl for', prefix, 'to', acl);

    return api.getFiles(prefix).then(function(files){
      var promises = files.map(function(file){
        var deferred = q.defer();

        var filePath = '/' + file;
        client.request('PUT', filePath + '?acl', { 'x-amz-acl': acl }).on('response', function(res){
          if(res.statusCode === 200) deferred.resolve();
          else deferred.reject(res);
        }).on('error', function(err){
          deferred.reject(err);
        }).end();

        return deferred.promise;
      });

      return q.all(promises);
    });
  };

  api.copy = function(fromPrefix, toPrefix){
    //console.log('Copying', fromPrefix, 'to', toPrefix);

    return api.getFiles(fromPrefix).then(function(files){
      var promises = files.map(function(file){
        var deferred = q.defer();

        var replaceRegex = new RegExp('^' + fromPrefix);
        var sourcePath = '/' + file;
        var destinationPath = '/' + file.replace(replaceRegex, toPrefix);
        console.log(sourcePath, ' -> ', destinationPath);
        client.copyFile(sourcePath, destinationPath, function(err, res){
          if(err) return deferred.reject(err);
          deferred.resolve(res);
        });
        return deferred.promise;
      });

      return q.all(promises);
    });
  };


  return api;
};
