"use strict";

module.exports = (socket) => {

  //-----------------------------------------
  // SEARCH
  //-----------------------------------------

  socket.on('search', (data, cb) => {
    cb = cb || _.noop;
    entries.search(data.terms).then((results) => {
      cb(results);
    });
  });

  //-----------------------------------------
  // UPLOADS
  //-----------------------------------------

  socket.on('uploadsGetFolders', (data, cb) => {
    cb = cb || _.noop;
    upl.getUploadsFolders().then((f) => {
      cb(f);
    })
  });

  socket.on('uploadsCreateFolder', (data, cb) => {
    cb = cb || _.noop;
    upl.createUploadsFolder(data.foldername).then((f) => {
      cb(f);
    });
  });

  socket.on('uploadsGetImages', (data, cb) => {
    cb = cb || _.noop;
    upl.getUploadsFiles('image', data.folder).then((f) => {
      cb(f);
    });
  });

  socket.on('uploadsDeleteFile', (data, cb) => {
    cb = cb || _.noop;
    upl.deleteUploadsFile(data.uid).then((f) => {
      cb(f);
    });
  });

};