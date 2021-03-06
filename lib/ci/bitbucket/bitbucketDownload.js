'use strict';
const fs = require('fs');
const got = require('got');
const path = require('path');
const { promisify } = require('util');
const { getBuildDir } = require('../../commands/util');
const writeFile = promisify(fs.writeFile);
const stat = promisify(fs.stat);

function toStandardBuildConfig(build) {
  return {
    id: build.build_number,
    uuid: build.uuid,
    createdOn: build.created_on,
    duration: build.duration_in_seconds,
    result: build.state.result.name,
    refType: build.target.ref_type,
    refName: build.target.ref_name
  };
}

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch (err) {
    if (err.code !== 'ENOENT') {
      throw err;
    }
  }
  return false;
}

async function fetchBitbucketPipelines(buildsDir, user, repo) {
  let pagelen = 100;
  let page = 1;
  let total = 0;
  let numberOfPages = 0;

  outer:
  do {
    let res = await got(`https://api.bitbucket.org/2.0/repositories/${user}/${repo}/pipelines/?pagelen=${pagelen}&page=${page}&sort=-created_on`);
    let json = JSON.parse(res.body);
    let builds = json.values;

    for (let build of builds) {
      let date = new Date();
      let filePath = path.join(buildsDir, `${build.build_number}.json`);

      if (await exists(filePath)) {
        break outer;
      }

      if (build.state.name !== 'COMPLETED' || build.trigger.name === 'SCHEDULE') {
        continue;
      }

      build = toStandardBuildConfig(build);

      await writeFile(filePath, JSON.stringify(build));
    }

    total = json.size;
    numberOfPages = parseInt(total / pagelen) + 1;
    console.log(`Page: ${json.page} of ${numberOfPages}, Total Builds: ${json.size}`);
    page++;
  } while ((page - 1) * 100 < total);
}

module.exports = fetchBitbucketPipelines;
