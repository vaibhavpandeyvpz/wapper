const fs = require("fs");
const path = require("path");
const tmp = require("tmp");

function newFilePath(suffix = "") {
  return tmp.tmpNameSync({
    postfix: suffix,
    tmpdir: path.resolve(path.join(__dirname, "..", "uploads")),
  });
}

async function saveBufferAs(path, buffer) {
  return new Promise((resolve, reject) => {
    fs.writeFile(path, buffer, function (err) {
      if (err) {
        reject();
        return;
      }

      resolve();
    });
  });
}

module.exports = {
  newFilePath,
  saveBufferAs,
};
