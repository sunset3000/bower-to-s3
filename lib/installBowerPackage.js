var bower = require('bower');
var semver = require('semver');
var q = require('q');

/**
  @param repoUrl the bower repository address
  @param version the semver version (approximate is ok) to install
  @returns a promise with the resolved version that was installed
*/
module.exports = function installVersion(repoUrl, version, options){
  var deferred = q.defer();
  options = options || {};
  version = version || 'latest';

  bower.commands.info(repoUrl)
    .on('end', function(data){
      var resolvedVersion,
        versions = data.versions;

      if(version === 'latest') {
        resolvedVersion = data.latest.version;
      } else {
        resolvedVersion = semver.maxSatisfying(versions, version);
      }

      if(resolvedVersion === null){
        deferred.reject(new Error('Unable to determine version for ' + version));
      }

      var repoWithVersion = repoUrl + '#' + resolvedVersion;

      bower.commands.uninstall([data.latest.name], {}, options).on('end', function(done){
        bower.commands.install([repoWithVersion], {force: true}, options).on('end', function(installed){
          // Bower returns a map of package name to package info
          var info = installed[Object.keys(installed)[0]];
          deferred.resolve(info);
        });
      });
    });

  return deferred.promise;
};
