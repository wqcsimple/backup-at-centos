/**
 * @author whis admin@wwhis.com
 * @Created 3/28/17
 */
const fs = require('fs');
const path = require('path');
const Util = require('./lib/util');
var Config = require('./config');
const log4js = require('log4js');

var Qiniu = require("qiniu");

var Glob = require("glob");

log4js.configure({
    appenders: [{
        type: 'console',
        layout: {
            pattern: '[%r] [%p][%c] - %m%n'
        }
    }]
});
var log = log4js.getLogger();

var UploadFolderList = Config.UPLOAD_FOLDER_LIST;
var UploadBucket = Config.COS_BUCKET;
var UploadBucketKey = Config.COS_KEY;


var CoreQiniu = {
    init: function () {
        Qiniu.conf.ACCESS_KEY = Config.ACCESS_KEY;
        Qiniu.conf.SECRET_KEY = Config.SECRET_KEY;
    },

    getUploadToken: function (bucket, key) {

        var putPolicy = new Qiniu.rs.PutPolicy(bucket + ":" + key);
        return putPolicy.token();
    },

    uploadFile: function (uploadToken, key, localFile) {

        let extra = new Qiniu.io.PutExtra();
        return new Promise(function (resolve, reject) {
            Qiniu.io.putFile(uploadToken, key, localFile, extra, function (err, ret) {
                if (!err) {
                    // 上传成功， 处理返回值
                    // console.log(ret.hash, ret.key, ret.persistentId);
                    resolve(ret);
                } else {
                    // 上传失败， 处理返回代码
                    reject(ret);
                }
            });
        })
    },

    getFileInfo: function (bucket, key) {
        let client = new Qiniu.rs.Client();
        return new Promise((resolve, reject) => {
            client.stat(bucket, key, function (err, ret) {
                if (err) {
                    // console.log(ret.hash, ret.fsize, ret.putTime, ret.mimeType);
                    resolve(false);
                } else {
                    resolve(true);
                }
            });
        });
    }

};

var CoreFile = {
    // 获取指定目录下的文件列表
    getFileList: function () {
        var length = UploadFolderList.length;
        for (var i = 0; i < length; i++) {
            var folder = UploadFolderList[i];

            log.info(folder);

            var pattern = folder + "/**";

            Glob(pattern, {nodir: true, stat: true}, function (err, files) {
                if (err) throw err;

                log.info("files => ", files);

                if (files.length > 0) {
                    CoreFile.processFileList(files);
                }
            })
        }
    },

    processFileList: function (files) {
        files.forEach(function (filePath) {
            fs.exists(filePath, function (exists) {
                if (exists) {
                    let filename = CoreFile.getProcessFileName(filePath);

                    log.info('upload file: ' + filename);

                    let key = UploadBucketKey + filename;
                    let uploadToken = CoreQiniu.getUploadToken(UploadBucket, key);
                    CoreQiniu.getFileInfo(UploadBucket, key)
                        .then(fileExists => {
                            if (!fileExists) {
                                return CoreQiniu.uploadFile(uploadToken, key, filePath);
                            }
                            return filePath + " 已经上传";
                        })
                        .then(result => {
                            log.info(result);
                        })
                        .catch(err => {
                            log.info('upload error');
                            log.error(err);
                        })
                }
            })
        })
    },

    getProcessFileName: function (filePath) {
        var ext = path.extname(filePath);       // 根据路径获取文件扩展名
        var filename = path.basename(filePath); // 根据路径获取文件名

        return filename;
        // return Util.date('YmdHis') + Util.rand(1000, 9999) + '-' + filename;
    },

    init: function () {
        CoreQiniu.init();
        CoreFile.getFileList();
    }
};



CoreFile.init();




