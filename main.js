var installBowerPackage = require('./lib/installBowerPackage');
var s3Util = require('s3-util');
var path = require('path');
var os = require('os');
var its = require('its');

/*
  @param config object containing configuration for the operation.
    Required properties:
      pkg - the bower package name or url
      bucket - the name of the S3 bucket to use for the upload
      awsAccessKeyId - the access key id to use when uploading
      awsSecretAccessKey - the secret access key to use when uploading

    Optional properties:
      version - the Bower package version to upload (defaults to latest)
      base - the base directory in the Bower package to upload (defaults to ./)
      select - the glob pattern to use when selecting files to upload (defaults to select all files)
      prefix - the prefix in the bucket to place all the files under (defaults to root of bucket)
*/
module.exports = function(config){
  its.string(config.pkg, "A bower package name or url.");
  its.string(config.bucket, "A bucket name is required.")
  its.string(config.awsAccessKeyId, "A access key id is required.")
  its.string(config.awsSecretAccessKey, "A secret access key is required.")

  // Required config
  var pkg = config.pkg,
    awsAccessKeyId = config.awsAccessKeyId,
    awsSecretAccessKey = config.awsSecretAccessKey,
    bucket = config.bucket;

  // Optional config
  var version = config.version !== undefined ? config.version : 'latest',
    base = config.base !== undefined ? config.base : '',
    select = config.select !== undefined ? config.select : '**/*',
    prefix = config.prefix !== undefined ? config.prefix : '';

  var client = s3Util(awsAccessKeyId, awsSecretAccessKey, bucket);

  var tmpDir = os.tmpdir();

  return installBowerPackage(pkg, version, {
      directory: path.relative(__dirname, tmpDir) // only accepts relative paths
    }).then(function(info){
      var name = info.pkgMeta.name;

      var resolvedBase = path.join(tmpDir, name, base);
      var searchGlob = path.join(resolvedBase, select);
      console.log('Uploading', name + '#' + info.pkgMeta.version, 'to', bucket + '/' + prefix);
      return client.sync(searchGlob, prefix, {
        base: resolvedBase
      });
    });
};
