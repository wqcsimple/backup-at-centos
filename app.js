/**
 * @author whis admin@wwhis.com
 * @Created 3/28/17
 */
const fs = require('fs');
const path = require('path');
let Config = require('./config');

let log4js = require('log4js');
let Log = log4js.getLogger();
Log.level = 'debug';

let Qiniu = require("qiniu");

let Glob = require("glob");

var UploadFolderList = Config.UPLOAD_FOLDER_LIST;
var UploadBucket = Config.COS_BUCKET;
var UploadBucketKey = Config.COS_KEY;


var CoreQiniu = {
    init: function () {
        Qiniu.conf.ACCESS_KEY = Config.ACCESS_KEY;
        Qiniu.conf.SECRET_KEY = Config.SECRET_KEY;
    },

    getMac: function () {
        return new Qiniu.auth.digest.Mac(Qiniu.conf.ACCESS_KEY, Qiniu.conf.SECRET_KEY);
    },

    getConfig: function () {
        let config = new Qiniu.conf.Config();
        config.zone = Qiniu.zone.Zone_z2;
        // 是否使用https域名
        //config.useHttpsDomain = true;
        // 上传是否使用cdn加速
        //config.useCdnDomain = true;
        return config;
    },

    getBucketManager() {
        return new Qiniu.rs.BucketManager(CoreQiniu.getMac(), CoreQiniu.getConfig());
    },

    getUploadToken: function (bucket, key) {
        let options = {
            scope: bucket,
            saveKey: key
        };
        let putPolicy = new Qiniu.rs.PutPolicy(options);

        return putPolicy.uploadToken(CoreQiniu.getMac());
    },

    uploadFile: function (uploadToken, key, localFile) {
        let Client = new Qiniu.form_up.FormUploader(CoreQiniu.getConfig());
        let putExtra = new Qiniu.form_up.PutExtra();
        return new Promise(function (resolve, reject) {
            Client.putFile(uploadToken, key, localFile, putExtra, function (err, ret, respInfo) {
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
        let client = CoreQiniu.getBucketManager();
        return new Promise((resolve, reject) => {
            client.stat(bucket, key, function (err, ret, respInfo) {
                if (respInfo.statusCode === 612) {
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
        let length = UploadFolderList.length;
        for (let i = 0; i < length; i++) {
            let folder = UploadFolderList[i];

            Log.info(folder);

            let pattern = folder + "/**";

            Glob(pattern, {nodir: true, stat: true}, function (err, files) {
                if (err) throw err;

                Log.info("files => ", files);

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

                    Log.info('upload file: ' + filename);

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
                            Log.info(result);
                        })
                        .catch(err => {
                            Log.info('upload error');
                            Log.error(err);
                        })
                }
            })
        })
    },

    getProcessFileName: function (filePath) {
        let ext = path.extname(filePath);       // 根据路径获取文件扩展名
        let filename = path.basename(filePath); // 根据路径获取文件名

        return filename;
        // return Util.date('YmdHis') + Util.rand(1000, 9999) + '-' + filename;
    },

    init: function () {
        CoreQiniu.init();
        CoreFile.getFileList();
    }
};


CoreFile.init();




