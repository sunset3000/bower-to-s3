#bower-to-s3

> Publish [bower](http://bower.io/) packages to [S3](http://aws.amazon.com/s3/)

Bower to S3 synchronizes an S3 bucket + prefix with the contents of a given
Bower package.

## Usage via the Command Line
```sh
# Install as a global executable
$ npm install -g bower-to-s3
$ bower-to-s3 -h # print help
  Usage: bower-to-s3 [options] package bucket

  Options:

    -h, --help                   output usage information
    -b, --base [directory]       The base directory within the Bower package to use. (Defaults to "./")
    -s, --select [glob pattern]  The glob pattern to use in the base directory when selecting files to upload. (Defaults to "**/*")
    -v, --version [number]       The package version to upload. If fuzzy the latest matching one is used. (Defaults to latest release)
    -p, --prefix [prefix]        The prefix in the S3 bucket to upload to. (Defaults to root of the S3 bucket)
    --keyId [key id]             The AWS Access Key Id to use when uploading files.
    --accessKey [access key]     The AWS Access Key to use when uploading files.
```

## Usage via the API
```sh
# Install as a local package
$ npm install --save bower-to-s3
```

```javascript
// Inside a JavaScript file...

var bowerToS3 = require('bower-to-s3');

bowerToS3({
  // Required options
  // A bower package name or url.
  pkg: 'my-package',

  // Required. The AWS Access Key Id to use when uploading the package.
  awsAccessKeyId: 'abcdef',

  // The AWS Secret Access Key to use when uploading the package.
  awsSecretAccessKey: '123456',

  // The S3 bucket name to upload the package to.
  bucket: 'the-s3-bucket',

  // Optional options
  // The version of the bower package to use. Defaults to latest release.
  version: '1.8',

  // The base directory in the bower package to upload. Defaults to './'.
  base: './dist',

  // The glob pattern to use when selecting files to upload. Defaults to '**/*'.
  select: '**/*.js',

  // The prefix within the S3 bucket to upload the files to. Defaults to ''.
  prefix: 'version-1.8'
}).then(function(){
  // The bowerToS3 call returns a promise, use .then to be notified of completion.
}).catch(function(e){
  // Errors can be caught by using .catch
});
```
