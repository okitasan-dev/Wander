// Where the tests find the app, their fixtures, and where they write screenshots
const path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '..'), FIX = path.join(__dirname, 'fixtures'), OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, {recursive: true});
module.exports = {ROOT, FIX, OUT};
