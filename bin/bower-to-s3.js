#!/usr/bin/env node

var program = require('commander');
var bowerToS3 = require('../');
var pkg = require('../package.json');
program
  .usage('[options] package bucket')
  .option('-b, --base [directory]', 'The base directory within the Bower package to use. (Defaults to "./")', './')
  .option('-s, --select [glob pattern]', 'The glob pattern to use in the base directory when selecting files to upload. (Defaults to "**/*")', '**/*')
  .option('-v, --version [number]', 'The package version to upload. If fuzzy the latest matching one is used. (Defaults to latest release)', 'latest')
  .option('-p, --prefix [prefix]', 'The prefix in the S3 bucket to upload to. (Defaults to root of the S3 bucket)', '')
  .option('--keyId [key id]', 'The AWS Access Key Id to use when uploading files.', process.env.AWS_ACCESS_KEY_ID)
  .option('--accessKey [access key]', 'The AWS Access Key to use when uploading files.', process.env.AWS_SECRET_ACCESS_KEY)
  .parse(process.argv);

var pkg = program.args[0];
var bucket = program.args[1];

bowerToS3({
  pkg: pkg,
  awsAccessKeyId: program.keyId,
  awsSecretAccessKey: program.accessKey,
  bucket: bucket,
  version: program.version,
  base: program.base,
  select: program.select,
  prefix: program.prefix
}).catch(function(e){
  console.error(e.toString(), e.stack);
});
